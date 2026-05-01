**MinIO Bucket Setup Guide** (for your local development + future self-hosted Lalela chat app)

### Why Buckets Matter in MinIO
MinIO is S3-compatible object storage. A **bucket** is like a top-level folder/container for your files (chat images, documents, avatars, etc.).  
You should create **one dedicated bucket** for your app (e.g., `lalela`) to keep things organized and secure.

### Recommended Bucket Strategy for Your App

- **Main bucket**: `lalela` (or `lalela-chat`)
  - Subfolders (prefixes): `chat-images/`, `avatars/`, `documents/`, `temp/`
- **Optional separate buckets** (later): `lalela-public`, `lalela-backups`

**Best Practice Tips**:
- Use **versioning** if you want to keep old versions of images.
- Set **lifecycle rules** to auto-delete temporary files.
- Apply **bucket policies** for security (private by default, signed URLs for access).
- Never use the root credentials in your app — create a dedicated user with limited permissions.

### How to Set Up the Bucket (Local Development)

#### Option 1: Using MinIO Console (Easiest for Local Dev)

1. Make sure MinIO is running (from your `docker-compose.yml` or manually).
2. Open the MinIO Console in your browser:
   - URL: `http://192.168.31.96:9001` (or `http://localhost:9001`)
   - Login with:
     - **Access Key**: `lalela` (or whatever you set as `MINIO_ROOT_USER`)
     - **Secret Key**: your strong password

3. Click **Create Bucket**:
   - Bucket Name: `lalela`
   - Leave other options default for now (you can enable Versioning later)
   - Click **Create**

4. (Optional) Create folders inside:
   - `chat-images/`
   - `avatars/`

#### Option 2: Using MinIO Client (`mc`) – Recommended for Scripts/Automation

Install the MinIO Client (`mc`):

```bash
# On Linux / macOS
curl https://dl.min.io/client/mc/release/linux-amd64/mc --create-dirs -o /usr/local/bin/mc
chmod +x /usr/local/bin/mc
```

Configure alias (run once):

```bash
mc alias set lalela http://192.168.31.96:9000 lalela StrongPassword123!ChangeMe
```

Create the bucket:

```bash
mc mb lalela/lalela
```

Create subfolders (optional):

```bash
mc mb lalela/lalela/chat-images
mc mb lalela/lalela/avatars
```

List buckets to verify:

```bash
mc ls lalela
```

#### Option 3: Automatic Creation in Docker Compose

You can add a helper service in `docker-compose.yml` that creates the bucket on startup (good for consistent local setup).

### Security & Best Practices for Your Chat App

- **Make bucket private** by default.
- Generate **presigned URLs** (temporary signed links) from your backend when users need to upload or view images.
- Create a dedicated MinIO user (not root) with policy that only allows access to the `lalela` bucket.
- For production: Enable TLS (HTTPS) and use proper bucket policies.

### Next Steps for You

1. Start MinIO (via Docker Compose or manually).
2. Create the `lalela` bucket using the Console or `mc`.
3. Test uploading a file from your mobile app using the code I gave earlier.
4. Update your mobile code to use the correct MinIO endpoint (`http://192.168.31.96:9000` for local).

