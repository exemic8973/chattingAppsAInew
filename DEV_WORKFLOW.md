# Development Workflow Guide 🔄

This guide explains the dev/prod branch workflow for this project.

## 📋 Branch Structure

### Branches

1. **`main`** (Production)
   - ✅ Production-ready code only
   - ✅ Deployed to Zeabur/production environment
   - ✅ Protected - only merge from development after testing
   - ✅ Tagged with version numbers (v1.0.0, v1.1.0, etc.)

2. **`development`** (Development)
   - 🔧 Active development and testing
   - 🔧 Local testing environment
   - 🔧 All new features and fixes go here first
   - 🔧 Merged to main only when confirmed working

## 🚀 Workflow Steps

### For Local Development & Testing

#### 1. Switch to Development Branch
```bash
git checkout development
```

#### 2. Make Your Changes
- Edit code
- Add features
- Fix bugs
- Test locally

#### 3. Test Locally
```bash
# Install dependencies (if needed)
npm install

# Run development server
npm run dev
```

Test your changes at `http://localhost:3000`

#### 4. Commit to Development Branch
```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "Description of what you changed"
```

#### 5. Push to Development Branch (Optional)
```bash
# Push to remote development branch
git push origin development
```

### For Production Release

#### 1. Verify Everything Works on Development
- ✅ All features working
- ✅ No errors in console
- ✅ Authentication working
- ✅ Socket.IO connecting properly
- ✅ Rooms can be created and joined
- ✅ Messages sending/receiving

#### 2. Merge to Main (Production)
```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge development into main
git merge development

# Push to production
git push origin main
```

#### 3. Tag Version (For Major Updates)
```bash
# Create a new version tag
git tag -a v1.1.0 -m "Version 1.1.0 - Description of changes"

# Push tags to GitHub
git push origin main --tags
```

## 📁 Environment Files

### Local Development (`.env.local`)
```env
JWT_SECRET=local-development-secret-key
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### Production (Zeabur Environment Variables)
```env
JWT_SECRET=<secure-64-char-random-string>
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_SOCKET_URL=https://chattingappsainew.zeabur.app
CLIENT_URL=https://chattingappsainew.zeabur.app
FRONTEND_URL=https://chattingappsainew.zeabur.app
NEXT_PUBLIC_FRONTEND_URL=https://chattingappsainew.zeabur.app
```

## 🔍 Quick Reference Commands

### Check Current Branch
```bash
git branch
# * indicates current branch
```

### Switch Branches
```bash
# Switch to development
git checkout development

# Switch to main (production)
git checkout main
```

### View Changes
```bash
# See what files changed
git status

# See line-by-line changes
git diff
```

### Undo Changes (Before Commit)
```bash
# Discard changes to a file
git checkout -- filename

# Discard all changes
git reset --hard
```

## 📊 Workflow Diagram

```
┌─────────────────┐
│   Development   │  ← Work here for new features
│     Branch      │
└────────┬────────┘
         │
         │ Test locally
         │ (npm run dev)
         │
         ▼
    ✅ Confirmed
    working?
         │
         ▼
┌─────────────────┐
│      Main       │  ← Production (Zeabur)
│     Branch      │
└─────────────────┘
         │
         ▼
    🏷️ Tag version
    (v1.1.0, etc.)
```

## 🎯 Best Practices

### DO ✅
- ✅ Always work on `development` branch
- ✅ Test thoroughly before merging to main
- ✅ Write clear commit messages
- ✅ Keep commits small and focused
- ✅ Pull latest changes before starting work

### DON'T ❌
- ❌ Don't commit directly to main
- ❌ Don't push broken code to main
- ❌ Don't forget to test locally first
- ❌ Don't merge without confirming it works
- ❌ Don't commit `.env.local` (use `.env.example`)

## 🆘 Troubleshooting

### "I'm on the wrong branch!"
```bash
# Check current branch
git branch

# Switch to correct branch
git checkout development
```

### "I committed to main by accident!"
```bash
# Don't panic! You can move the commit
git checkout development
git cherry-pick <commit-hash>
git checkout main
git reset --hard HEAD~1
```

### "I want to start fresh"
```bash
# Discard all local changes
git checkout development
git reset --hard origin/development
```

## 📝 Example Workflow

```bash
# 1. Start working
git checkout development
git pull origin development

# 2. Make changes
# ... edit files ...

# 3. Test locally
npm run dev
# Test in browser at http://localhost:3000

# 4. Commit
git add .
git commit -m "Add new chat feature"

# 5. Test again (optional)
npm run build
npm start

# 6. If everything works, merge to production
git checkout main
git pull origin main
git merge development
git push origin main

# 7. Done! Zeabur auto-deploys from main
```

## 🔐 Production Deployment

When you push to `main` branch, Zeabur automatically:
1. Detects the push
2. Builds the application
3. Runs `npm run build`
4. Starts with `npm start`
5. Deploys to production URL

**No manual deployment needed!**

## 📞 Need Help?

- Check this guide first
- Use `git status` to see current state
- Use `git log` to see commit history
- Create a backup branch: `git checkout -b backup-branch`
