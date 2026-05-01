**✅ Guide to run **PostgreSQL + MinIO** locally using Docker.

### 1. Create `docker-compose.yml`

Create a file called `docker-compose.yml` in your project root with this content:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: lalela
      POSTGRES_USER: lalela
      POSTGRES_PASSWORD: StrongPassword123!ChangeMe
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: lalela
      MINIO_ROOT_PASSWORD: StrongPassword123!ChangeMe
    ports:
      - "9000:9000"   # API / S3 endpoint
      - "9001:9001"   # Web Console
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

---

### 2. Start the Services

Run these commands in your project folder:

```bash
# Start both services in the background
docker compose up -d

# See logs (useful for debugging)
docker compose logs -f
```

To see only specific service logs:

```bash
docker compose logs -f postgres
docker compose logs -f minio
```

---

### 3. Verify Everything is Running

```bash
# Check running containers
docker compose ps
```

You should see both `postgres` and `minio` as `Up`.

---

### 4. Test the Services

**MinIO:**
- Open browser → `http://192.168.31.96:9001` (or `http://localhost:9001`)
- Login with:
  - **Access Key**: `lalela`
  - **Secret Key**: `StrongPassword123!ChangeMe`
- Create a bucket named `lalela`

**PostgreSQL:**
```bash
# Test connection
docker compose exec postgres psql -U lalela -d lalela -c "\l"
```

---

### 5. Useful Docker Commands

```bash
# Stop services
docker compose down

# Restart only one service
docker compose restart minio
docker compose restart postgres

# View logs
docker compose logs -f minio

# Completely remove volumes (reset database/storage - be careful!)
docker compose down -v
```

---

### Next Recommended Steps

Once these are running:
1. Update your `server/index.ts` to connect to PostgreSQL + MinIO


Create the lalela bucket in MinIO  ----IN PROGRESS



############Connect your mobile app to these local services?

**✅ Perfect!** Here's exactly **how to connect your Expo React Native app** to your local backend.

### 1. Create a Config File (`lib/config.ts`)

Create folder `lib/` and file `config.ts`:

```ts
// lib/config.ts
import Constants from 'expo-constants';

const localhost = '192.168.31.96';   // ← Your local machine IP

export const API_BASE_URL = __DEV__
  ? `http://${localhost}:3030`      // Uses nginx proxy (recommended)
  : 'https://yourdomain.com';       // For production later

export const SOCKET_URL = __DEV__
  ? `http://${localhost}:3030`
  : 'https://yourdomain.com';
```

### 2. Create Socket Connection (`lib/socket.ts`)

```ts
// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';

export const socket: Socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
});

// Optional: Debug logs
socket.on('connect', () => {
  console.log('✅ Socket connected to backend');
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

export default socket;
```

### 3. Usage Examples in Your App

#### Join a Community & Listen for Messages

```tsx
import socket from '../lib/socket';
import { useEffect } from 'react';

useEffect(() => {
  // Join a community room
  socket.emit('join-community', communityId);

  // Listen for new messages
  socket.on('new-message', (message) => {
    console.log('New message received:', message);
    // Update your chat state here
    setMessages(prev => [...prev, message]);
  });

  return () => {
    socket.off('new-message');
  };
}, [communityId]);
```

#### Send a Message

```tsx
const sendMessage = () => {
  if (!messageText.trim()) return;

  socket.emit('send-message', {
    communityId,
    userId: currentUser.id,
    content: messageText,
    messageType: 'text',
    createdAt: new Date().toISOString(),
  });

  setMessageText('');
};
```

#### Upload Image + Send

```tsx
const sendImage = async (uri: string) => {
  const imageUrl = await uploadToMinIO(uri);   // from previous code

  socket.emit('send-message', {
    communityId,
    userId: currentUser.id,
    content: "📸 Photo",
    image_url: imageUrl,
    messageType: 'image',
  });
};
```

### 4. Important Tips for Local Development

- **On Physical Device**: Use your computer's local IP (`192.168.31.96`) — **not** `localhost` or `10.0.2.2`.
- **Expo Go vs Dev Client**: Use **Dev Client** (`expo run:android` or `expo run:ios`) for best WebRTC + Socket.io support.
- **Network Permission**: On Android, make sure your app has network permissions (usually automatic with Expo).


