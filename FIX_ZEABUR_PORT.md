# 🚨 URGENT: Fix Zeabur Environment Variable

Your Socket.IO is still trying to connect to port 3001, but the server runs on port 3000.

## The Problem

Your logs show:
```
🔌 Creating new socket for user ... connecting to: chattingappsainew.zeabur.app:3001
```

This is WRONG. It should be:
```
🔌 Creating new socket for user ... connecting to: chattingappsainew.zeabur.app
```

## The Solution

### Step 1: Go to Zeabur Dashboard
1. Open https://dash.zeabur.com
2. Click on your project
3. Click on your service (chattingAppsAInew)
4. Click on **"Variables"** tab

### Step 2: Find NEXT_PUBLIC_SOCKET_URL

Look for this variable. It probably says:
```
NEXT_PUBLIC_SOCKET_URL = https://chattingappsainew.zeabur.app:3001
```

### Step 3: Edit the Variable

Click the **Edit** button (pencil icon) and change it to:
```
NEXT_PUBLIC_SOCKET_URL = https://chattingappsainew.zeabur.app
```

**REMOVE THE `:3001` COMPLETELY!**

### Step 4: Save and Redeploy

1. Click **"Save"** or **"Update"**
2. Click **"Redeploy"** button (you MUST redeploy for changes to take effect)
3. Wait for deployment to complete

### Step 5: Verify

After redeployment, check your browser console. You should now see:
```
🔌 Creating new socket for user ... connecting to: https://chattingappsainew.zeabur.app
🔍 NEXT_PUBLIC_SOCKET_URL from env: https://chattingappsainew.zeabur.app
```

## Complete Environment Variables

Make sure ALL these are set correctly in Zeabur (NO port numbers):

```env
JWT_SECRET=4ba71446ee7f27ac3e17ea734aae632b5ad536f8eb2d58179b137a31688d6e78
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_SOCKET_URL=https://chattingappsainew.zeabur.app
CLIENT_URL=https://chattingappsainew.zeabur.app
FRONTEND_URL=https://chattingappsainew.zeabur.app
NEXT_PUBLIC_FRONTEND_URL=https://chattingappsainew.zeabur.app
```

## About the 401 Login Error

The 401 "Invalid credentials" error is separate. Make sure you're using:
- **Correct email** (that you signed up with)
- **Correct password**

Or create a new account if you forgot your credentials.
