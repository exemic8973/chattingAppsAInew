const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

// Initialize Next.js
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
console.log('🔐 Integrated server JWT_SECRET configured:', JWT_SECRET ? 'Yes (length: ' + JWT_SECRET.length + ')' : 'No');

// Room ID generation function
const generateRoomId = () => {
  const adjectives = ['RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'PURPLE', 'ORANGE', 'PINK'];
  const nouns = ['STAR', 'MOON', 'SUN', 'SKY', 'WAVE', 'FIRE', 'ICE', 'WIND'];
  const numbers = Math.floor(100 + Math.random() * 900);

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj}-${noun}-${numbers}`;
};

// User storage
const users = new Map();
const userSessions = new Map();

// Room storage
const rooms = new Map();
const connectedUsers = new Map();

// Initialize room with message storage
const createRoom = (roomId, passcode, creator, creatorName) => {
  return {
    id: roomId,
    passcode: passcode,
    creator: creator,
    creatorName: creatorName,
    participants: [],
    messages: [],
    createdAt: new Date().toISOString()
  };
};

nextApp.prepare().then(() => {
  const app = express();
  const httpServer = createServer(app);

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CLIENT_URL || '*'
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));
  app.use(express.json());

  // Socket.io setup
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL || '*'
        : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Authentication event
    socket.on('authenticate', (data) => {
      try {
        const { token } = data;

        console.log('🔑 Authentication attempt for socket:', socket.id);

        if (!token) {
          socket.emit('auth-error', { message: 'No token provided' });
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        let storedUser = users.get(decoded.email);
        if (!storedUser) {
          storedUser = {
            id: decoded.userId || 'jwt-user-' + Date.now(),
            email: decoded.email,
            password: 'jwt-authenticated',
            userName: decoded.userName || decoded.email.split('@')[0] || 'Unknown User',
            createdAt: new Date().toISOString()
          };
          users.set(decoded.email, storedUser);
          console.log('✅ Created user from JWT:', storedUser);
        }

        userSessions.set(storedUser.id, storedUser);
        socket.user = storedUser;
        socket.userId = storedUser.id;

        console.log(`✅ Socket ${socket.id} authenticated as user ${storedUser.userName}`);
        socket.emit('auth-success', { user: storedUser });

      } catch (error) {
        console.error('💥 Socket authentication error:', error);
        socket.emit('auth-error', { message: 'Authentication failed', details: error.message });
      }
    });

    // Create room event
    socket.on('create-room', (data) => {
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required to create rooms' });
        return;
      }

      let { roomId, passcode, userName } = data;

      if (!roomId) {
        roomId = generateRoomId();
      }

      if (rooms.has(roomId)) {
        socket.emit('error', { message: 'Room already exists' });
        return;
      }

      const room = createRoom(roomId, passcode, socket.user.email, userName);

      room.participants.push({
        id: socket.user.id,
        name: userName,
        socketId: socket.id,
        isCreator: true,
        joinedAt: new Date().toISOString()
      });

      rooms.set(roomId, room);
      socket.join(roomId);

      const shareUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || `http://localhost:${port}`}/room/${roomId}`;

      console.log(`🎉 Room created: ${roomId} by ${userName}`);
      socket.emit('room-created', { roomId, passcode, shareUrl });
    });

    // Join room event
    socket.on('join-room', (data) => {
      const { roomId, passcode, userName } = data;

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.passcode !== passcode) {
        socket.emit('error', { message: 'Invalid passcode' });
        return;
      }

      const userId = socket.user ? socket.user.id : `guest-${socket.id}`;
      const existingParticipant = room.participants.find(p => p.id === userId);

      if (existingParticipant) {
        existingParticipant.socketId = socket.id;
        socket.emit('room-joined', {
          roomId,
          users: room.participants.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isCreator
          })),
          messages: room.messages || []
        });
        socket.join(roomId);
        return;
      }

      const participant = {
        id: userId,
        name: userName,
        socketId: socket.id,
        isCreator: socket.user ? socket.user.email === room.creator : false,
        joinedAt: new Date().toISOString()
      };

      room.participants.push(participant);
      socket.join(roomId);

      if (!room.messages) {
        room.messages = [];
      }

      socket.emit('room-joined', {
        roomId,
        users: room.participants.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isCreator
        })),
        messages: room.messages
      });

      socket.to(roomId).emit('user-joined', {
        userName,
        user: {
          id: participant.id,
          name: participant.name,
          isHost: participant.isCreator
        },
        participantCount: room.participants.length
      });
    });

    // Chat message event
    socket.on('chat-message', (data) => {
      const { roomId, message, messageId } = data;

      const room = rooms.get(roomId);
      if (!room) return;

      const participant = room.participants.find(p => p.socketId === socket.id);
      if (!participant) return;

      const chatMessage = {
        id: messageId || uuidv4(),
        userName: participant.name,
        content: message,
        timestamp: new Date().toISOString(),
        userId: participant.id,
        type: 'text'
      };

      if (!room.messages) {
        room.messages = [];
      }
      room.messages.push(chatMessage);

      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }

      io.to(roomId).emit('new-message', chatMessage);
    });

    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
      if (socket.userId) {
        userSessions.delete(socket.userId);
      }
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rooms: Array.from(rooms.keys()),
      connectedUsers: io.engine.clientsCount
    });
  });

  // Let Next.js handle all other routes
  app.all('*', (req, res) => {
    return nextHandler(req, res);
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Integrated server running on http://localhost:${port}`);
    console.log(`🔑 JWT Secret length: ${JWT_SECRET.length}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🌐 Next.js ready`);
  });
});
