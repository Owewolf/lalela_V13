import 'dotenv/config';
import 'express-async-errors'; // must be imported before express — auto-forwards async errors to next(err)
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import apiRouter from './api.js';
import { sendPushToUser } from './services/pushService.js';
import { registerNotificationEmitter } from './services/notificationService.js';
import prisma from './db.js';
import { startCronJobs } from './billing/cronService.js';

const app = express();
const httpServer = createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────
//
// Browsers reject `Access-Control-Allow-Origin: *` whenever the response also
// sets `Access-Control-Allow-Credentials: true`. When ALLOWED_ORIGINS is unset
// or contains `*` we therefore reflect the request origin instead of emitting
// a literal wildcard, which keeps preflighted requests (e.g. multipart uploads
// with an Authorization header) working from any front-end host.

const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOriginsRaw.includes('*');
const allowedOrigins = allowedOriginsRaw.filter((o) => o !== '*');

const corsOriginFn: cors.CorsOptions['origin'] = (origin, callback) => {
  // Non-browser clients (curl, mobile native fetch) have no Origin header.
  if (!origin) return callback(null, true);
  if (allowAnyOrigin) return callback(null, origin);
  if (allowedOrigins.includes(origin)) return callback(null, origin);
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

app.use(cors({ origin: corsOriginFn, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── REST API ─────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// ─── Socket.io ────────────────────────────────────────────────────────────────

// Cap a single WebSocket frame at 256 KB. Anything larger should go over REST
// (image/file uploads return a URL; the URL is what travels over the socket).
// This prevents a single oversized frame from OOM-killing the okhttp reader
// on Android clients (see java.lang.OutOfMemoryError in WebSocketReader).
const SOCKET_MAX_PAYLOAD_BYTES = 256 * 1024;

const io = new SocketServer(httpServer, {
  cors: { origin: corsOriginFn, methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: SOCKET_MAX_PAYLOAD_BYTES,
});

registerNotificationEmitter((targetUserId, notification) => {
  io.to(`user:${targetUserId}`).emit('notification:new', notification);
});

// Bound any free-form text we pass through over the socket so a single buggy
// or malicious client cannot broadcast multi-megabyte strings to every peer.
const MAX_MESSAGE_TEXT = 8 * 1024;       // chat message body
const MAX_POST_JSON = 64 * 1024;          // serialized post / emergency payload
const truncate = (s: unknown, n: number) =>
  typeof s === 'string' && s.length > n ? s.slice(0, n) : s;
const jsonByteLength = (v: unknown) => {
  try { return Buffer.byteLength(JSON.stringify(v) ?? '', 'utf8'); } catch { return Infinity; }
};

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

  // Join a personal room so peers can signal this user by userId
  socket.join(`user:${userId}`);

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
    attachmentUrl?: string;
  }) => {
    if (!data?.conversationId) return;
    // Bound text to keep frames small for every recipient.
    const safe = {
      ...data,
      text: truncate(data.text, MAX_MESSAGE_TEXT) as string | undefined,
      attachmentUrl: truncate(data.attachmentUrl, 2048) as string | undefined,
    };
    socket.to(`conversation:${safe.conversationId}`).emit('message:new', {
      ...safe,
      senderId: userId,
      createdAt: new Date().toISOString(),
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
    if (!data?.communityId) return;
    if (jsonByteLength(data.post) > MAX_POST_JSON) {
      console.warn(`[socket] dropped oversized post:new from ${userId}`);
      return;
    }
    socket.to(`community:${data.communityId}`).emit('post:new', data.post);
  });

  socket.on('emergency:update', (data: { communityId: string; emergency: unknown }) => {
    if (!data?.communityId) return;
    if (jsonByteLength(data.emergency) > MAX_POST_JSON) {
      console.warn(`[socket] dropped oversized emergency:update from ${userId}`);
      return;
    }
    socket.to(`community:${data.communityId}`).emit('emergency:update', data.emergency);
  });

  // ── WebRTC signaling ─────────────────────────────────────────────────────
  // All targets are userId strings; peers join `user:<userId>` on connect.

  socket.on('call:ring', (data: { target: string; callerName: string; type: string }) => {
    socket.to(`user:${data.target}`).emit('call:ring', {
      from: userId,
      callerName: data.callerName,
      type: data.type,
    });
    // Push notification for backgrounded/offline callee
    sendPushToUser(data.target, {
      title: `${data.callerName} is calling…`,
      body: data.type === 'video' ? 'Incoming video call' : 'Incoming voice call',
      data: { type: 'incoming-call', callerId: userId, callerName: data.callerName, callType: data.type },
    }).catch(() => { /* non-critical */ });
  });

  socket.on('webrtc:offer', (data: { target: string; caller: string; callerName: string; sdp: unknown; type: string }) => {
    socket.to(`user:${data.target}`).emit('webrtc:offer', {
      from: userId,
      caller: data.caller,
      callerName: data.callerName,
      sdp: data.sdp,
      type: data.type,
    });
  });

  socket.on('webrtc:answer', (data: { target: string; sdp: unknown }) => {
    socket.to(`user:${data.target}`).emit('webrtc:answer', { from: userId, sdp: data.sdp });
  });

  socket.on('webrtc:ice', (data: { target: string; candidate: unknown }) => {
    socket.to(`user:${data.target}`).emit('webrtc:ice', { from: userId, candidate: data.candidate });
  });

  socket.on('call:ended', (data: { target: string }) => {
    socket.to(`user:${data.target}`).emit('call:ended', { from: userId });
  });

  socket.on('call:rejected', (data: { target: string }) => {
    socket.to(`user:${data.target}`).emit('call:rejected', { from: userId });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${userId} (${socket.id})`);
  });
});

// Expose io so routes can emit to specific rooms
export { io };

// ─── Start ────────────────────────────────────────────────────────────────────

// ─── Keep alive on unhandled errors ─────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const PORT = Number(process.env.PORT ?? 4000);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Lalela API + Socket.io running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  startCronJobs(prisma);
});

