# Zeabur Environment Variables Setup

## ⚠️ CRITICAL: Update Your Environment Variables

Since we switched to the **integrated server** (single port), you need to update your Zeabur environment variables.

## Required Environment Variables in Zeabur

Go to your Zeabur dashboard → Your Project → Service → **Variables** tab and set:

```env
JWT_SECRET=4ba71446ee7f27ac3e17ea734aae632b5ad536f8eb2d58179b137a31688d6e78
NODE_ENV=production
PORT=3000
```

## 🚨 IMPORTANT: Socket.IO URL

**REMOVE PORT 3001 from NEXT_PUBLIC_SOCKET_URL**

The Socket.IO server now runs on the **same port** as Next.js (port 3000).

### ❌ WRONG (Old Setup):
```env
NEXT_PUBLIC_SOCKET_URL=https://your-app.zeabur.app:3001
```

### ✅ CORRECT (Integrated Server):
```env
NEXT_PUBLIC_SOCKET_URL=https://chattingappsainew.zeabur.app
```

**Replace `chattingappsainew.zeabur.app` with your actual Zeabur URL**

## Complete Environment Variables

Set these in Zeabur:

```env
JWT_SECRET=4ba71446ee7f27ac3e17ea734aae632b5ad536f8eb2d58179b137a31688d6e78
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_SOCKET_URL=https://chattingappsainew.zeabur.app
CLIENT_URL=https://chattingappsainew.zeabur.app
FRONTEND_URL=https://chattingappsainew.zeabur.app
NEXT_PUBLIC_FRONTEND_URL=https://chattingappsainew.zeabur.app
```

## After Updating

1. Click **"Save"** in Zeabur
2. Click **"Redeploy"** to apply the new environment variables
3. Wait for the deployment to complete
4. Check the logs for:
   ```
   🚀 Integrated server running on http://localhost:3000
   🔑 JWT Secret length: 64
   📡 Socket.IO ready
   🌐 Next.js ready
   ```

## Verify It's Working

After redeployment, the WebSocket should connect to:
```
wss://chattingappsainew.zeabur.app/socket.io/...
```

NOT:
```
wss://chattingappsainew.zeabur.app:3001/socket.io/...  ❌
```

If you see `:3001` in the WebSocket URL, the environment variable wasn't updated correctly.
