# Branch Information 🌿

## Repository Structure

This repository uses a **two-branch workflow** for safe development and deployment.

## 📊 Branches

### 🔧 `development` (Development/Testing)
- **Purpose**: All development and local testing
- **Status**: Active development
- **Protected**: No
- **Auto-Deploy**: No

**Use this for:**
- New features
- Bug fixes
- Testing changes locally
- Experimentation

**URL**: https://github.com/exemic8973/chattingAppsAInew/tree/development

---

### ✅ `main` (Production)
- **Purpose**: Production-ready code only
- **Status**: Stable, deployed to Zeabur
- **Protected**: Should be
- **Auto-Deploy**: Yes (Zeabur)

**Use this for:**
- Confirmed working code
- Production releases
- Version tags

**URL**: https://github.com/exemic8973/chattingAppsAInew/tree/main

## 🔄 Workflow

```
┌─────────────────────────────────────┐
│         DEVELOPMENT BRANCH          │
│                                     │
│  1. Make changes                    │
│  2. Test locally (npm run dev)      │
│  3. Commit & push                   │
│  4. Verify everything works         │
└──────────────┬──────────────────────┘
               │
               │ When confirmed working
               │
               ▼
┌─────────────────────────────────────┐
│           MAIN BRANCH               │
│                                     │
│  1. Merge from development          │
│  2. Auto-deploys to Zeabur          │
│  3. Tag version (optional)          │
│  4. Users access production app     │
└─────────────────────────────────────┘
```

## 🎯 Current Status

- ✅ `main` branch: v1.0.0 (Production)
- 🔧 `development` branch: Active development
- 📦 Both branches synced as of last commit

## 📚 Documentation

- **DEV_WORKFLOW.md** - Complete workflow guide
- **SETUP_LOCAL_DEV.md** - Local development setup
- **ZEABUR_ENV_SETUP.md** - Production deployment

## 🚀 Quick Commands

### Switch to Development
```bash
git checkout development
```

### Switch to Production (Main)
```bash
git checkout main
```

### Check Current Branch
```bash
git branch
# * indicates current branch
```

## ⚠️ Important Rules

1. **NEVER** commit directly to `main` for testing
2. **ALWAYS** test on `development` first
3. **ONLY** merge to `main` when confirmed working
4. Keep `.env.local` for local development only

## 🏷️ Version Tags

Production releases on `main` branch:
- `v1.0.0` - First working release (Current)
- Future versions will follow semantic versioning

## 🔐 Branch Protection (Recommended)

On GitHub, you should protect the `main` branch:

1. Go to: Settings → Branches → Branch protection rules
2. Add rule for `main`
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass
   - ✅ Do not allow force pushes

This prevents accidental direct commits to production.
