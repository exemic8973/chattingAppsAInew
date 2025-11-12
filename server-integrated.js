const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const next = require('next');
const { userOps, roomOps, messageOps } = require('./database');

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

// In-memory session storage (socket connections)
const userSessions = new Map();
const connectedUsers = new Map();

// Room participants (active connections) - not persisted
const roomParticipants = new Map(); // roomId -> [participants]

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

  // Trust proxy - CRITICAL for Zeabur/reverse proxy platforms
  app.set('trust proxy', 1);

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
    socket.on('authenticate', async (data) => {
      try {
        const { token } = data;

        console.log('🔑 Authentication attempt for socket:', socket.id);

        if (!token) {
          socket.emit('auth-error', { message: 'No token provided' });
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Try to find user in database
        let storedUser = await userOps.findByEmail(decoded.email);

        if (!storedUser) {
          // Create user from JWT if not exists
          storedUser = {
            id: decoded.userId || 'jwt-user-' + Date.now(),
            email: decoded.email,
            password: 'jwt-authenticated',
            userName: decoded.userName || decoded.email.split('@')[0] || 'Unknown User',
            createdAt: new Date().toISOString()
          };

          try {
            await userOps.create(storedUser);
            console.log('✅ Created user in database from JWT:', storedUser.userName);
          } catch (dbError) {
            // User might already exist (race condition), try to fetch again
            storedUser = await userOps.findByEmail(decoded.email);
            if (!storedUser) {
              throw dbError; // Re-throw if still not found
            }
          }
        }

        userSessions.set(storedUser.id, storedUser);
        socket.user = storedUser;
        socket.userId = storedUser.id;

        console.log(`✅ Socket ${socket.id} authenticated as user ${storedUser.userName || storedUser.user_name}`);
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
    socket.on('create-room', async (data) => {
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required to create rooms' });
        return;
      }

      let { roomId, passcode, userName } = data;

      if (!roomId) {
        roomId = generateRoomId();
      }

      try {
        // Check if room exists in database
        const existingRoom = await roomOps.findById(roomId);
        if (existingRoom) {
          socket.emit('error', { message: 'Room already exists' });
          return;
        }

        // Create room in database
        const room = {
          id: roomId,
          passcode: passcode,
          creator: socket.user.email,
          creatorName: userName,
          createdAt: new Date().toISOString()
        };

        await roomOps.create(room);
        console.log(`💾 Room saved to database: ${roomId}`);

        // Initialize room participants in memory
        const participant = {
          id: socket.user.id,
          name: userName,
          socketId: socket.id,
          isCreator: true,
          joinedAt: new Date().toISOString()
        };

        roomParticipants.set(roomId, [participant]);
        socket.join(roomId);

        const shareUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || `http://localhost:${port}`}/room/${roomId}`;

        console.log(`🎉 Room created: ${roomId} by ${userName}`);
        socket.emit('room-created', { roomId, passcode, shareUrl });
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // Join room event
    socket.on('join-room', async (data) => {
      try {
        console.log('🚪 Join room event received:', data);
        const { roomId, passcode, userName, persistentUserId } = data;

        // Load room from database
        const room = await roomOps.findById(roomId);
        if (!room) {
          console.log('❌ Room not found in database:', roomId);
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

        // 🔥 CRITICAL FIX: Join socket to room IMMEDIATELY so it receives all broadcasts
        socket.join(roomId);
        console.log('🔗 Socket joined room:', roomId);

        // 🔥 CRITICAL FIX: Use persistent user ID from client to prevent duplicates on reconnect
        const userId = socket.user ? socket.user.id : (persistentUserId || `guest-${socket.id}`);
        console.log('👤 User ID for joining:', userId);
        console.log('👤 Persistent User ID from client:', persistentUserId);

        // Get or initialize participants list for this room
        let participants = roomParticipants.get(roomId) || [];

        // 🔥 FIX: Find existing participant by NAME or ID (in case of mismatched IDs from cached code)
        const existingParticipant = participants.find(p =>
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

          // Load chat history from database
          const messages = await messageOps.getByRoomId(roomId, 100);
          console.log(`📜 Loaded ${messages.length} messages from database for room ${roomId}`);

          socket.emit('room-joined', {
            roomId,
            users: participants.map(p => ({
              id: p.id,
              name: p.name,
              isHost: p.id === room.creator || socket.user?.email === room.creator
            })),
            messages: messages
          });
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

        participants.push(participant);

        // 🔥 CRITICAL FIX: Remove duplicate participants with same name (from old sessions)
        const uniqueParticipants = participants.filter((p, index, self) =>
          index === self.findIndex(t => t.name === p.name)
        );

        if (uniqueParticipants.length !== participants.length) {
          console.log(`⚠️ Removed ${participants.length - uniqueParticipants.length} duplicate participants`);
          participants = uniqueParticipants;
        }

        // Save updated participants list
        roomParticipants.set(roomId, participants);

        // Load chat history from database
        const messages = await messageOps.getByRoomId(roomId, 100);
        console.log(`📜 Loaded ${messages.length} messages from database for room ${roomId}`);

        console.log('📤 Emitting room-joined to user:', userName);
        console.log('👥 Participants in room:', participants.length);
        console.log('💬 Messages in room:', messages.length);

        socket.emit('room-joined', {
          roomId,
          users: participants.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isCreator
          })),
          messages: messages
        });

        console.log('✅ User joined room successfully:', userName);

        socket.to(roomId).emit('user-joined', {
          userName,
          user: {
            id: participant.id,
            name: participant.name,
            isHost: participant.isCreator
          },
          participantCount: participants.length
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Chat message event
    socket.on('chat-message', async (data) => {
      try {
        const { roomId, message, messageId } = data;

        // Verify room exists in database
        const room = await roomOps.findById(roomId);
        if (!room) {
          console.log('❌ Room not found in database:', roomId);
          return;
        }

        // Get active participants from memory
        const participants = roomParticipants.get(roomId);
        if (!participants) {
          console.log('❌ No active participants in room:', roomId);
          return;
        }

        const participant = participants.find(p => p.socketId === socket.id);
        if (!participant) {
          console.log('❌ Participant not found for socket:', socket.id);
          return;
        }

        const chatMessage = {
          id: messageId || uuidv4(),
          roomId: roomId,
          userName: participant.name,
          content: message,
          timestamp: new Date().toISOString(),
          userId: participant.id,
          type: 'text'
        };

        // Save message to database
        try {
          await messageOps.create(chatMessage);
          console.log(`💾 Message saved to database for room ${roomId}`);
        } catch (error) {
          console.error('Error saving message to database:', error);
          // Continue broadcasting even if save fails
        }

        // Broadcast message to all participants in the room
        io.to(roomId).emit('new-message', chatMessage);
      } catch (error) {
        console.error('Error handling chat message:', error);
      }
    });

    // WebRTC signaling events
    socket.on('start-call', (data) => {
      const { roomId, callType } = data;
      console.log(`📞 Starting ${callType} call in room:`, roomId);

      const participants = roomParticipants.get(roomId);
      if (!participants) return;

      const caller = participants.find(p => p.socketId === socket.id);
      if (!caller) return;

      // Notify all other participants in the room about incoming call
      socket.to(roomId).emit('incoming-call', {
        callType,
        fromUser: {
          id: caller.id,
          name: caller.name
        }
      });
    });

    socket.on('accept-call', (data) => {
      const { roomId, targetUserId } = data;
      console.log('✅ Call accepted in room:', roomId);

      const participants = roomParticipants.get(roomId);
      if (!participants) return;

      const accepter = participants.find(p => p.socketId === socket.id);
      if (!accepter) return;

      // Find the target user's socket
      const targetParticipant = participants.find(p => p.id === targetUserId);
      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('call-accepted', {
          fromUser: {
            id: accepter.id,
            name: accepter.name
          }
        });
      }
    });

    socket.on('call-rejected', (data) => {
      const { roomId, targetUserId } = data;
      console.log('❌ Call rejected in room:', roomId);

      const participants = roomParticipants.get(roomId);
      if (!participants) return;

      // Find the target user's socket
      const targetParticipant = participants.find(p => p.id === targetUserId);
      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('call-rejected');
      }
    });

    socket.on('end-call', (data) => {
      const { roomId } = data;
      console.log('📴 Call ended in room:', roomId);

      // Notify all other participants in the room
      socket.to(roomId).emit('call-ended');
    });

    socket.on('webrtc-signal', (data) => {
      const { roomId, signalData, targetUserId } = data;
      console.log('🔄 WebRTC signal relay in room:', roomId);

      const participants = roomParticipants.get(roomId);
      if (!participants) return;

      const sender = participants.find(p => p.socketId === socket.id);
      if (!sender) return;

      if (targetUserId) {
        // Send to specific user
        const targetParticipant = participants.find(p => p.id === targetUserId);
        if (targetParticipant) {
          io.to(targetParticipant.socketId).emit('webrtc-signal', {
            signalData,
            fromUserId: sender.id
          });
        }
      } else {
        // Broadcast to all other participants in the room
        socket.to(roomId).emit('webrtc-signal', {
          signalData,
          fromUserId: sender.id
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
      if (socket.userId) {
        userSessions.delete(socket.userId);
      }
    });
  });

  // Health check endpoint - simple, no middleware
  app.get('/api/health', async (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      const allRooms = await roomOps.getAll();
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        totalRooms: allRooms.length,
        activeRooms: Array.from(roomParticipants.keys()),
        connectedUsers: io.engine.clientsCount,
        dbStatus: 'connected'
      }));
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        dbStatus: 'error'
      });
    }
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
