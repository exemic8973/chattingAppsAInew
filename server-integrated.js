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

  // Don't use global middleware that consumes request body
  // Next.js needs to handle its own requests without interference

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
        console.error('🔐 JWT_SECRET being used (length):', JWT_SECRET.length);
        console.error('🔐 JWT_SECRET first 10 chars:', JWT_SECRET.substring(0, 10));
        console.error('📝 Error name:', error.name);
        console.error('📝 Error message:', error.message);
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
      console.log('🚪 Join room event received:', data);
      const { roomId, passcode, userName, persistentUserId } = data;

      const room = rooms.get(roomId);
      if (!room) {
        console.log('❌ Room not found:', roomId);
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      console.log('🔑 Checking passcode for room:', roomId);
      if (room.passcode !== passcode) {
        console.log('❌ Invalid passcode for room:', roomId);
        socket.emit('error', { message: 'Invalid passcode' });
        return;
      }
      console.log('✅ Passcode valid for room:', roomId);

      // 🔥 CRITICAL FIX: Use persistent user ID from client to prevent duplicates on reconnect
      const userId = socket.user ? socket.user.id : (persistentUserId || `guest-${socket.id}`);
      console.log('👤 User ID for joining:', userId);
      console.log('👤 Persistent User ID from client:', persistentUserId);

      // 🔥 FIX: Find existing participant by NAME or ID (in case of mismatched IDs from cached code)
      const existingParticipant = room.participants.find(p =>
        p.id === userId || p.name === userName
      );
      console.log('🔍 Existing participant found:', existingParticipant ? existingParticipant.name : 'None');

      if (existingParticipant) {
        console.log('🔄 Existing participant rejoining:', existingParticipant.name);
        existingParticipant.socketId = socket.id;

        // 🔥 FIX: Update participant ID if they now have a persistent ID (upgrade from guest-xxx)
        if (persistentUserId && existingParticipant.id.startsWith('guest-')) {
          console.log(`⬆️ Upgrading participant ID from ${existingParticipant.id} to ${persistentUserId}`);
          existingParticipant.id = persistentUserId;
        }

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
        console.log('✅ Existing participant rejoined room:', roomId);
        return;
      }

      console.log('👤 New participant joining:', userName);
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

      // 🔥 CRITICAL FIX: Remove duplicate participants with same name (from old sessions)
      const uniqueParticipants = room.participants.filter((p, index, self) =>
        index === self.findIndex(t => t.name === p.name)
      );

      if (uniqueParticipants.length !== room.participants.length) {
        console.log(`⚠️ Removed ${room.participants.length - uniqueParticipants.length} duplicate participants`);
        room.participants = uniqueParticipants;
      }

      console.log('📤 Emitting room-joined to user:', userName);
      console.log('👥 Participants in room:', room.participants.length);
      console.log('💬 Messages in room:', room.messages.length);

      socket.emit('room-joined', {
        roomId,
        users: room.participants.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isCreator
        })),
        messages: room.messages
      });

      console.log('✅ User joined room successfully:', userName);

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

  // Health check endpoint - simple, no middleware
  app.get('/api/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rooms: Array.from(rooms.keys()),
      connectedUsers: io.engine.clientsCount
    }));
  });

  // Let Next.js handle all other routes - pass raw request/response
  // Use app.use instead of app.all to avoid path-to-regexp issues
  app.use((req, res) => {
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
