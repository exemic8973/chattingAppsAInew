# Real-Time Chat Application 💬

A modern, real-time chat application with authentication, private rooms, and **group video broadcasting**, built with Next.js, TypeScript, and Socket.IO.

**Version**: 2.0.0 (Group Broadcasting Release)

## 🔗 Repository

**GitHub**: https://github.com/exemic8973/chattingAppsAInew

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/exemic8973/chattingAppsAInew)

## ✨ Features

### Authentication & Security
- ✅ **User Registration**: Secure signup with email and password
- ✅ **JWT Authentication**: Token-based authentication system
- ✅ **Password Encryption**: Bcrypt password hashing
- ✅ **Session Management**: Persistent login sessions

### Real-Time Chat
- ✅ **Private Rooms**: Create password-protected chat rooms
- ✅ **Room Codes**: Auto-generated unique room IDs (e.g., RED-STAR-123)
- ✅ **Instant Messaging**: Real-time chat with Socket.IO
- ✅ **Message History**: Previous messages visible to new joiners
- ✅ **Participant List**: See who's in the room

### 🎙️ Group Video Broadcasting (NEW!)
- ✅ **Auto-Broadcast**: Host automatically streams when creating room
- ✅ **No Explicit Calls**: Participants request to join instead
- ✅ **Call List System**: 
  - Host invites participants OR
  - Participants request to join call
- ✅ **Host Controls**: Mute/unmute and toggle video anytime
- ✅ **Group Calling**: Multiple participants can join single broadcast
- ✅ **Per-Remote Peers**: Individual WebRTC connection per participant
- ✅ **Multi-Video Grid**: Display all participants in grid layout
- ✅ **Audio Activity Detection**: Visual indicators for who's speaking
- ✅ **Volume Controls**: Adjust microphone and speaker volumes

### Multi-Language Support
- 🌍 **English & Chinese**: Full i18n support
- 🔄 **Language Switcher**: Toggle languages on the fly

### Modern Architecture
- 🚀 **Integrated Server**: Single-port deployment (Next.js + Socket.IO)
- 📦 **Production-Ready**: Optimized for Zeabur, Render, Railway
- 🔌 **WebSocket/Polling**: Automatic transport fallback
- 🎨 **Responsive UI**: TailwindCSS + Bootstrap 5

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS, Bootstrap 5, Bootstrap Icons
- **Real-time Communication**: Socket.IO
- **WebRTC**: Simple-peer for peer-to-peer connections
- **Backend**: Node.js with Express and Socket.IO

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Modern web browser with WebRTC support

### Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/exemic8973/chattingAppsAInew.git
cd chattingAppsAInew
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` and set:
```env
JWT_SECRET=your-secret-key-here
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open your browser:** Navigate to `http://localhost:3000`

### Production Deployment (Integrated Server)

1. **Build the application:**
```bash
npm run build
```

2. **Start production server:**
```bash
npm start
```

This runs the integrated server (Next.js + Socket.IO on port 3000).

## Usage

### Creating a Room

1. Enter your name on the home page
2. Click "Create Room"
3. Share the Room ID and passcode with friends
4. Copy the share link for easy access

### Joining a Room

1. Click on a shared room link or navigate to `/room/[ROOM_ID]`
2. Enter your name and the 6-digit passcode
3. Start chatting!

### Voice & Video Calls

1. Click the phone icon for voice calls or camera icon for video calls
2. The other participant will receive a call notification
3. Accept or reject the call
4. End the call when finished

## 🌐 Deployment to Zeabur

See [ZEABUR_ENV_SETUP.md](./ZEABUR_ENV_SETUP.md) for detailed deployment instructions.

**Quick Setup:**
1. Connect GitHub repository to Zeabur
2. Set environment variables (see below)
3. Deploy!

### Required Environment Variables

```env
JWT_SECRET=<64-char-random-string>
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_SOCKET_URL=https://your-app.zeabur.app
CLIENT_URL=https://your-app.zeabur.app
FRONTEND_URL=https://your-app.zeabur.app
NEXT_PUBLIC_FRONTEND_URL=https://your-app.zeabur.app
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📜 Scripts

```bash
npm run dev              # Development mode (Next.js only)
npm run build            # Build for production
npm start                # Production (integrated server)
npm run start:split      # Production (separate servers)
npm run server           # Socket.IO server only
npm run lint             # ESLint
```

## Browser Support

This application requires modern browsers with WebRTC support:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Security Notes

- Room passcodes provide basic access control
- All communication is encrypted using standard web protocols
- No personal data is stored on servers
- WebRTC connections are peer-to-peer when possible

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License