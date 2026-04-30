**✅ Here is the complete, detailed Developer Migration Guide.**

-

```markdown
# Migration Guide: Firebase → Full Self-Hosted Stack (Minimal Disruption)

**Project**: `lalela_native` (Expo + React Native)  
**Goal**: Remove **all** Firebase/Google dependencies and run 100% self-hosted on Axxess VPS with P2P WebRTC.

**Target Stack** (Best Long-Term + Minimal Changes):

| Layer                | Technology                              | Reason |
|----------------------|-----------------------------------------|--------|
| Mobile App           | Expo + React Native (keep everything)   | Existing code stays mostly untouched |
| Backend              | Node.js + Express + Socket.io           | You already have `server/index.ts` |
| Database             | PostgreSQL                              | Powerful, reliable, cheap |
| Realtime             | Socket.io                               | Replaces Firestore listeners |
| File Storage         | MinIO (S3-compatible)                   | Drop-in replacement |
| Voice/Video          | `react-native-webrtc` + Coturn TURN     | True P2P calls |
| Auth                 | JWT (simple)                            | Lightweight |
| Push Notifications   | Expo Notifications + self-hosted        | Keep existing |
| Hosting              | Axxess VPS + Docker Compose             | Full control |

---

## Step-by-Step Migration

### Step 1: Update Dependencies (5 mins)

Update your `package.json`:

```json
{
  "dependencies": {
    "@expo/metro-runtime": "~6.1.2",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-community/slider": "5.0.1",
    "@teovilla/react-native-web-maps": "^0.9.5",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dotenv": "^17.2.3",
    "expo": "~54.0.34",
    "expo-constants": "~18.0.13",
    "expo-dev-client": "~5.0.0",
    "expo-document-picker": "~14.0.8",
    "expo-file-system": "~19.0.21",
    "expo-image-picker": "~17.0.11",
    "expo-linking": "~8.0.12",
    "expo-location": "~19.0.8",
    "expo-notifications": "~0.32.17",
    "expo-router": "~6.0.23",
    "expo-sharing": "~14.0.8",
    "expo-splash-screen": "~31.0.13",
    "expo-status-bar": "~3.0.9",
    "express": "^4.21.2",
    "lucide-react-native": "^1.9.0",
    "nativewind": "^4.2.3",
    "nodemailer": "^8.0.5",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.5",
    "react-native-gesture-handler": "~2.28.0",
    "react-native-google-places-autocomplete": "^2.6.4",
    "react-native-maps": "1.20.1",
    "react-native-qrcode-svg": "^6.3.21",
    "react-native-reanimated": "~4.1.1",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-svg": "15.12.1",
    "react-native-web": "^0.21.0",
    "react-native-worklets": "0.5.1",
    "socket.io-client": "^4.8.1",
    "axios": "^1.7.7",
    "jwt-decode": "^4.0.0"
  },
  "devDependencies": {
    "@config-plugins/react-native-webrtc": "^1.0.0",
    "@types/express": "^4.17.21",
    "@types/nodemailer": "^8.0.0",
    "@types/react": "~19.1.0",
    "babel-preset-expo": "~54.0.10",
    "react-native-webrtc": "^124.0.0",
    "tsx": "^4.21.0",
    "typescript": "~5.9.2"
  }
}
```

Run:
```bash
npm install
npx expo install expo-dev-client
npx expo install react-native-webrtc @config-plugins/react-native-webrtc
```

### Step 2: Expo Config (`app.json` or `app.config.js`)

```json
{
  "expo": {
    "plugins": [
      "@config-plugins/react-native-webrtc",
      "expo-dev-client"
    ]
  }
}
```

### Step 3: Backend Server (`server/index.ts`)

Replace your current file with this:

```ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-community', (communityId: string) => {
    socket.join(communityId);
  });

  socket.on('send-message', (message) => {
    io.to(message.communityId).emit('new-message', message);
    // TODO: Save to PostgreSQL
  });

  // WebRTC Signaling
  socket.on('webrtc-offer', (data) => socket.to(data.target).emit('webrtc-offer', data));
  socket.on('webrtc-answer', (data) => socket.to(data.target).emit('webrtc-answer', data));
  socket.on('ice-candidate', (data) => socket.to(data.target).emit('ice-candidate', data));

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Self-hosted server running on port ${PORT}`);
});
```

Run with: `npm run server:dev`

### Step 4: Mobile Socket Connection

Create `lib/socket.ts`:

```ts
import io from 'socket.io-client';

export const socket = io('http://YOUR-VPS-IP:4000', {
  reconnection: true,
  reconnectionAttempts: 5,
});

// Usage example in a chat screen:
socket.emit('join-community', communityId);

socket.on('new-message', (message) => {
  // Update your chat state
});
```

### Step 5: Full Docker Compose (Axxess VPS)

Create `docker-compose.yml` in your project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://postgres:lalela@localhost:5432/lalela
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lalela
DB_USER=postgres
DB_PASSWORD=lalela

  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: lalela
      MINIO_ROOT_PASSWORD: ChangeThisToStrongPassword123!
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  backend:
    build: .
    restart: unless-stopped
    depends_on: [postgres, minio]
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000

  coturn:
    image: coturn/coturn:latest
    network_mode: host
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
```

### Step 6: Next Actions (After Basic Migration)

1. Add Prisma + PostgreSQL schema
2. Implement JWT authentication
3. Create WebRTC Call Screen
4. Deploy to Axxess VPS
5. Add image upload to MinIO


