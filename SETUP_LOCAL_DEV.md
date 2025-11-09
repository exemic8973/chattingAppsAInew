# Local Development Setup Guide 🛠️

Quick guide to set up your local development environment.

## 🚀 Quick Start

### 1. Clone and Switch to Development Branch
```bash
# Clone repository (if not already done)
git clone https://github.com/exemic8973/chattingAppsAInew.git
cd chattingAppsAInew

# Switch to development branch
git checkout development
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:
```bash
# Create .env.local from example
cp .env.example .env.local
```

Edit `.env.local` with these values for local development:
```env
JWT_SECRET=local-development-secret-key-for-testing
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

**Note**: `.env.local` is in `.gitignore` so it won't be committed to Git.

### 4. Start Development Server
```bash
npm run dev
```

The application will start on `http://localhost:3000`

## 📝 What You Can Test Locally

### Authentication
1. Sign up with a new account
2. Log in with existing credentials
3. Session persistence (refresh page)

### Room Creation
1. Click "Create Room"
2. Enter your name
3. Room is created with unique ID
4. Copy share link

### Chat Functionality
1. Open room in two browser windows/tabs
2. Send messages from one window
3. See them appear instantly in the other
4. Test with multiple participants

### Language Switching
1. Click language switcher (top right)
2. Toggle between English and Chinese
3. Verify translations update

## 🔍 Testing Checklist

Before merging to production, verify:

- [ ] Sign up works
- [ ] Login works
- [ ] Room creation works
- [ ] Room joining works (with correct passcode)
- [ ] Messages send/receive in real-time
- [ ] Socket.IO connects successfully
- [ ] No errors in browser console
- [ ] No errors in terminal/server logs
- [ ] Language switcher works
- [ ] Multiple users can join same room
- [ ] Participant list updates correctly

## 🐛 Common Issues & Fixes

### Issue: "Cannot connect to Socket.IO"
**Solution**: Make sure `NEXT_PUBLIC_SOCKET_URL=http://localhost:3000` (no port 3001!)

### Issue: "Invalid credentials" when logging in
**Solution**: Make sure you're using the correct email/password, or sign up a new account

### Issue: "Port 3000 is already in use"
**Solution**:
```bash
# Kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

### Issue: Build errors about types
**Solution**:
```bash
# Clean build and reinstall
rm -rf .next node_modules
npm install
npm run build
```

## 📦 Available Scripts

```bash
npm run dev              # Start development server (Next.js only)
npm run build            # Build for production
npm start                # Start production server (integrated)
npm run lint             # Run ESLint
```

## 🎯 Development vs Production Differences

### Development (`.env.local`)
- Uses `http://localhost:3000`
- JWT_SECRET can be simple string
- Detailed error messages
- Hot reloading enabled

### Production (Zeabur env vars)
- Uses `https://your-app.zeabur.app`
- JWT_SECRET must be secure 64-char string
- Minimal error details (security)
- Optimized build

## ✅ Ready for Production?

When everything works on `development` branch:

1. **Test thoroughly** (use checklist above)
2. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
3. **Merge to main** (see DEV_WORKFLOW.md):
   ```bash
   git checkout main
   git merge development
   git push origin main
   ```
4. **Zeabur auto-deploys** from main branch

## 📚 Related Documentation

- `DEV_WORKFLOW.md` - Development workflow guide
- `ZEABUR_ENV_SETUP.md` - Production deployment guide
- `README.md` - Project overview
- `RELEASE_NOTES_v1.0.0.md` - Version 1.0.0 details

## 🆘 Need Help?

1. Check error messages in:
   - Browser console (F12)
   - Terminal/command prompt

2. Common fixes:
   - Restart dev server
   - Clear browser cache
   - Delete `.next` folder and rebuild

3. Review this guide and related docs

Happy coding! 🎉
