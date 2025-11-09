# Instant Messenger - Cross-Platform Chat Application

A modern, real-time instant messenger application with voice and video calling capabilities, built with Next.js, TypeScript, and WebRTC.

## Repository

**GitHub Repository**: https://github.com/exemic8973/chattingAppsAInew

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/exemic8973/chattingAppsAInew)

## Features

- **Room-based Chat**: Create private chat rooms with unique IDs and passcodes
- **Real-time Messaging**: Instant text chat using Socket.IO
- **Voice & Video Calls**: Peer-to-peer calling using WebRTC
- **Cross-Platform**: Works on desktop, mobile, and tablet devices
- **Modern UI**: Beautiful glass morphism design with Bootstrap and Tailwind CSS
- **No Registration Required**: Start chatting immediately with room sharing

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

### Installation

1. Clone the repository:
```bash
git clone https://github.com/exemic8973/chattingAppsAInew.git
cd chattingAppsAInew
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Start the development server:
```bash
# Start the backend server
npm run server

# In a new terminal, start the frontend
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

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

## Environment Variables

- `NEXT_PUBLIC_SERVER_URL`: WebSocket server URL (default: http://localhost:3001)
- `CLIENT_URL`: Frontend application URL (default: http://localhost:3000)

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run server`: Start WebSocket server
- `npm run lint`: Run ESLint

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