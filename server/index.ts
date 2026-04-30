import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import apiRouter from './api.js';

const app = express();
const httpServer = createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '*').split(',');
app.use(cors({ origin: allowedOrigins.includes('*') ? '*' : allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── REST API ─────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins.includes('*') ? '*' : allowedOrigins, methods: ['GET', 'POST'] },
});

// Auth middleware — verify JWT on socket handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('Authentication required'));

  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new Error('Server misconfiguration'));

  try {
    const payload = jwt.verify(token, secret) as { userId: string; email: string };
    (socket as typeof socket & { userId: string }).userId = payload.userId;
    next();
  } catch {
    next(new Error('Token expired or invalid'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket as typeof socket & { userId: string }).userId;
  console.log(`[socket] connected: ${userId} (${socket.id})`);

  // ── Room membership ──────────────────────────────────────────────────────

  socket.on('join:community', (communityId: string) => {
    socket.join(`community:${communityId}`);
  });

  socket.on('leave:community', (communityId: string) => {
    socket.leave(`community:${communityId}`);
  });

  socket.on('join:conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('leave:conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // ── Chat ─────────────────────────────────────────────────────────────────

  socket.on('message:send', (data: {
    conversationId: string;
    text?: string;
    type?: string;
    attachment_url?: string;
  }) => {
    // Broadcast to all participants in the conversation room (excluding sender)
    socket.to(`conversation:${data.conversationId}`).emit('message:new', {
      ...data,
      senderId: userId,
      created_at: new Date().toISOString(),
    });
  });

  socket.on('typing:start', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
      userId,
      conversationId: data.conversationId,
    });
  });

  socket.on('typing:stop', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      userId,
      conversationId: data.conversationId,
    });
  });

  // ── Live location ────────────────────────────────────────────────────────

  socket.on('location:update', (data: {
    communityId: string;
    latitude: number;
    longitude: number;
    isSecurity?: boolean;
  }) => {
    const event = data.isSecurity ? 'security:location' : 'member:location';
    socket.to(`community:${data.communityId}`).emit(event, {
      userId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Community broadcasts ─────────────────────────────────────────────────

  socket.on('post:new', (data: { communityId: string; post: unknown }) => {
    socket.to(`community:${data.communityId}`).emit('post:new', data.post);
  });

  socket.on('emergency:update', (data: { communityId: string; emergency: unknown }) => {
    socket.to(`community:${data.communityId}`).emit('emergency:update', data.emergency);
  });

  // ── WebRTC signaling ─────────────────────────────────────────────────────

  socket.on('webrtc:offer', (data: { target: string; offer: unknown }) => {
    socket.to(data.target).emit('webrtc:offer', { from: socket.id, offer: data.offer });
  });

  socket.on('webrtc:answer', (data: { target: string; answer: unknown }) => {
    socket.to(data.target).emit('webrtc:answer', { from: socket.id, answer: data.answer });
  });

  socket.on('webrtc:ice', (data: { target: string; candidate: unknown }) => {
    socket.to(data.target).emit('webrtc:ice', { from: socket.id, candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${userId} (${socket.id})`);
  });
});

// Expose io so routes can emit to specific rooms
export { io };

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Lalela API + Socket.io running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

