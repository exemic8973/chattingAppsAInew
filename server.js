const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local if it exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('✅ Loaded environment variables from .env.local');
}

// Room ID generation function (must match frontend)
const generateRoomId = () => {
  const adjectives = ['RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'PURPLE', 'ORANGE', 'PINK'];
  const nouns = ['STAR', 'MOON', 'SUN', 'SKY', 'WAVE', 'FIRE', 'ICE', 'WIND'];
  const numbers = Math.floor(100 + Math.random() * 900);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}-${noun}-${numbers}`;
};

// Create a simple Express server
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://your-domain.com'
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
app.use(express.json());

// User storage (in production, use a database)
const users = new Map(); // email -> user data
const userSessions = new Map(); // userId -> user data

// JWT secret key (in production, use environment variable)
// Use same JWT secret as Next.js API
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'; // Must match Next.js API
console.log('🔐 Server.js JWT_SECRET configured:', JWT_SECRET ? 'Yes (length: ' + JWT_SECRET.length + ')' : 'No');

// Add test user for development - ensure it matches Next.js API
const addTestUser = async () => {
  try {
    const testEmail = 'test@example.com';
    const testPassword = 'test123';
    const testUserName = 'Test User';
    
    if (!users.has(testEmail)) {
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const testUser = {
        id: 'test-user-1',
        email: testEmail,
        password: hashedPassword,
        userName: testUserName,
        createdAt: new Date().toISOString()
      };
      users.set(testEmail, testUser);
      console.log('✅ Test user added to backend storage:', testUser);
    } else {
      const existingUser = users.get(testEmail);
      console.log('ℹ️ Test user already exists in backend storage:', existingUser);
    }
  } catch (error) {
    console.error('❌ Error adding test user:', error);
  }
};

const httpServer = http.createServer(app);

// Socket.io setup with enhanced CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL || 'https://your-domain.com'
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store active rooms
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
    messages: [], // Add message storage
    createdAt: new Date().toISOString()
  };
};

// Listen for socket connections
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Authentication event
  socket.on('authenticate', (data) => {
    try {
      const { token } = data;

      console.log('🔑 Authentication attempt for socket:', socket.id);
      console.log('🔐 Using JWT_SECRET length:', JWT_SECRET.length);

      if (!token) {
        console.log('❌ No token provided');
        socket.emit('auth-error', { message: 'No token provided' });
        return;
      }

      console.log('🔍 Token received (first 20 chars):', token.substring(0, 20) + '...');

      // Verify JWT token
      console.log('🔐 Verifying token with JWT_SECRET...');
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token verified successfully:', decoded);
      
      // Verify user exists in our storage - create if not found
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
      
      // Store user session
      userSessions.set(storedUser.id, storedUser);
      
      // Attach user to socket
      socket.user = storedUser;
      socket.userId = storedUser.id;
      
      console.log(`✅ Socket ${socket.id} authenticated as user ${storedUser.userName} (${storedUser.email})`);
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
    
    console.log(`✅ User ${socket.user.userName} authenticated, creating room...`);
    
    let { roomId, passcode, userName } = data;
    
    // Generate roomId if not provided
    if (!roomId) {
      roomId = generateRoomId();
    }
    
    console.log(`🎯 Attempting to create room with ID: ${roomId}`);
    console.log(`📊 Current rooms in memory: ${Array.from(rooms.keys()).join(', ')}`);
    
    if (rooms.has(roomId)) {
      console.log(`❌ Room ${roomId} already exists`);
      socket.emit('error', { message: 'Room already exists' });
      return;
    }
    
    const room = createRoom(roomId, passcode, socket.user.email, userName);
    
    // Add creator as first participant
    room.participants.push({
      id: socket.user.id,
      name: userName,
      socketId: socket.id,
      isCreator: true,
      joinedAt: new Date().toISOString()
    });
    
    rooms.set(roomId, room);
    socket.join(roomId);
  // track which room this socket is in
  socket.roomId = roomId;
    
    const shareUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/room/${roomId}`;
    
    console.log(`🎉 Room created: ${roomId} by ${userName}`);
    console.log(`📊 Updated rooms in memory: ${Array.from(rooms.keys()).join(', ')}`);
    socket.emit('room-created', { roomId, passcode, shareUrl });
  });

  // Join room event
  socket.on('join-room', (data) => {
    const { roomId, passcode, userName, persistentUserId } = data;
    
    console.log(`🔍 Received join-room event with data:`, data);
    console.log(`🔍 Attempting to join room: ${roomId} by user: ${userName}`);
    console.log(`📊 Available rooms: ${Array.from(rooms.keys()).join(', ')}`);
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found in available rooms`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    console.log(`✅ Room ${roomId} found!`);
    console.log(`📋 Room details:`, {
      id: room.id,
      creator: room.creator,
      passcode: room.passcode,
      currentParticipants: room.participants.length,
      participants: room.participants
    });
    
    if (room.passcode !== passcode) {
      console.log(`❌ Invalid passcode for room ${roomId}. Expected: ${room.passcode}, Got: ${passcode}`);
      socket.emit('error', { message: 'Invalid passcode' });
      return;
    }
    
    console.log(`✅ Passcode valid for room ${roomId}`);
    
    // Determine consistent user ID:
    // - If socket is authenticated, use authenticated user id
    // - Else if client provided a persistentUserId (stored in localStorage), prefer that
    // - Otherwise fall back to a guest id derived from the socket id
    const userId = socket.user
      ? socket.user.id
      : (persistentUserId || `guest-${socket.id}`);

    // Attach userId to socket for future reference
    socket.userId = userId;
  // Attach userName to socket for easier attribution in events
  socket.userName = userName;
    
    // Check if user is already in the room by user ID (not just socket ID)
    const existingParticipant = room.participants.find(p => p.id === userId);
    if (existingParticipant) {
      console.log(`⚠️ User ${userName} already in room ${roomId} with user ID ${userId}`);
      console.log(`🔄 Updating socket ID for existing participant`);
      // Update the socket ID for the existing participant
      existingParticipant.socketId = socket.id;
      
      // Ensure isCreator flag is set correctly on reconnect
      if (!existingParticipant.isCreator) {
        existingParticipant.isCreator = (socket.user && socket.user.email === room.creator) || userId === room.creator;
      }
      
      console.log(`📋 Updated participant:`, existingParticipant);
      
      // Still send current room data
      socket.emit('room-joined', { 
        roomId, 
        users: room.participants.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isCreator
        })),
        messages: room.messages || []
      });
      
      // Re-join socket to room (in case socket reconnected)
      socket.join(roomId);
      socket.roomId = roomId;
      
      // 📡 REAL-TIME UPDATE: Broadcast updated participant list to all users
      console.log(`📡 Broadcasting updated participant list to room ${roomId} after reconnect`);
      io.to(roomId).emit('participants-updated', {
        participants: room.participants.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isCreator
        }))
      });
      
      return;
    }
    
    // Check if this socket is already in the room (prevent duplicates)
    const existingSocketParticipant = room.participants.find(p => p.socketId === socket.id);
    if (existingSocketParticipant) {
      console.log(`⚠️ Socket ${socket.id} already in room ${roomId}`);
      socket.emit('room-joined', { 
        roomId, 
        users: room.participants.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isCreator
        })),
        messages: room.messages || []
      });
      return;
    }
    
    // Create new participant
    const participant = {
      id: userId,
      name: userName,
      socketId: socket.id,
      // Check if this user is the room creator (by email or by checking if already marked as creator)
      isCreator: (socket.user && socket.user.email === room.creator) || 
                 room.participants.some(p => p.id === userId && p.isCreator) ||
                 userId === room.creator,
      joinedAt: new Date().toISOString()
    };
    
    console.log(`📝 Adding participant to room:`, participant);
    console.log(`📊 Participants before adding: ${room.participants.length}`);
    
    room.participants.push(participant);
    
    console.log(`📊 Participants after adding: ${room.participants.length}`);
    console.log(`📋 All participants:`, room.participants);
    
    socket.join(roomId);
  // track which room this socket is in
  socket.roomId = roomId;
    console.log(`✅ Socket ${socket.id} joined room ${roomId}`);
    
    console.log(`👥 ${userName} joined room ${roomId}`);
    
    // Initialize messages array if not exists
    if (!room.messages) {
      room.messages = [];
    }
    
    // Send complete room data to the joining user
    console.log(`📤 Sending room-joined event to socket ${socket.id}`);
    console.log(`📤 Room participants for room ${roomId}:`, room.participants);
    
    socket.emit('room-joined', { 
      roomId, 
      users: room.participants.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isCreator
      })),
      messages: room.messages
    });
    
    // 🔥 CRITICAL FIX: Notify other participants in the room about the new user
    console.log(`📢 Broadcasting user-joined event to room ${roomId}`);
    socket.to(roomId).emit('user-joined', {
      userName,
      user: {
        id: participant.id,
        name: participant.name,
        isHost: participant.isCreator
      },
      participantCount: room.participants.length
    });

    // 📡 REAL-TIME UPDATE: Broadcast updated participant list to all users in the room
    const participantsList = room.participants.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isCreator
    }));
    console.log(`📡 Broadcasting updated participant list to room ${roomId}:`, participantsList);
    io.to(roomId).emit('participants-updated', {
      participants: participantsList
    });

    console.log(`✅ Join room process completed for ${userName}`);
  });

  // WebRTC signalling: targeted relay for per-peer signalling
  // Clients should emit: { targetUserId, signal } or { to, signalData }
  socket.on('webrtc-signal', (payload) => {
    try {
      const roomId = socket.roomId;
      if (!roomId) {
        console.log('⚠️ webrtc-signal received but socket has no roomId:', socket.id);
      }

      // normalize payload
      const targetUserId = payload && (payload.targetUserId || payload.to || (payload.data && payload.data.to));
      const signal = payload && (payload.signal || payload.signalData || payload.data || payload);

      const fromUserId = socket.userId || socket.id;

      if (!targetUserId) {
        console.log('⚠️ webrtc-signal missing targetUserId, broadcasting to room if available');
        if (roomId) {
          socket.to(roomId).emit('webrtc-signal', { fromUserId, signal });
        }
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        console.log(`⚠️ webrtc-signal: room not found for socket ${socket.id}`);
        return;
      }

      const target = room.participants.find(p => p.id === targetUserId);
      if (!target) {
        console.log(`⚠️ webrtc-signal: target ${targetUserId} not found in room ${roomId}`);
        return;
      }

      console.log(`📡 Relaying webrtc-signal from ${fromUserId} to ${targetUserId} in room ${roomId}`);
      io.to(target.socketId).emit('webrtc-signal', { fromUserId, signal });
    } catch (err) {
      console.error('❌ Error handling webrtc-signal:', err);
    }
  });

  // Start call: either targeted or broadcast to room
  socket.on('start-call', (payload) => {
    try {
      const roomId = socket.roomId;
      const targetUserId = payload && (payload.targetUserId || payload.to);
      const fromUserId = socket.userId || socket.id;

      if (targetUserId && roomId) {
        const room = rooms.get(roomId);
        const target = room && room.participants.find(p => p.id === targetUserId);
        if (target) {
          console.log(`📞 start-call from ${fromUserId} -> ${targetUserId}`);
          io.to(target.socketId).emit('start-call', { fromUserId, callType: payload.callType });
          return;
        }
      }

      // default: broadcast to room excluding sender
      if (roomId) {
        console.log(`📞 Broadcasting start-call from ${fromUserId} to room ${roomId}`);
        socket.to(roomId).emit('start-call', { fromUserId, callType: payload && payload.callType });
      }
    } catch (err) {
      console.error('❌ Error handling start-call:', err);
    }
  });

  // Accept call: route back to caller (target) or broadcast
  socket.on('accept-call', (payload) => {
    try {
      const roomId = socket.roomId;
      const targetUserId = payload && (payload.targetUserId || payload.to || payload.fromUserId);
      const fromUserId = socket.userId || socket.id; // the accepter

      if (targetUserId && roomId) {
        const room = rooms.get(roomId);
        const target = room && room.participants.find(p => p.id === targetUserId);
        if (target) {
          console.log(`✅ ${fromUserId} accepted call and notifying ${targetUserId}`);
          io.to(target.socketId).emit('accept-call', { fromUserId, callType: payload && payload.callType });
          return;
        }
      }

      // default: broadcast accept-call to room excluding accepter
      if (roomId) {
        console.log(`✅ Broadcasting accept-call from ${fromUserId} to room ${roomId}`);
        socket.to(roomId).emit('accept-call', { fromUserId, callType: payload && payload.callType });
      }
    } catch (err) {
      console.error('❌ Error handling accept-call:', err);
    }
  });

  // End call: route termination signal to target or broadcast
  socket.on('end-call', (payload) => {
    try {
      const roomId = socket.roomId;
      const targetUserId = payload && (payload.targetUserId || payload.to);
      const fromUserId = socket.userId || socket.id;

      if (targetUserId && roomId) {
        const room = rooms.get(roomId);
        const target = room && room.participants.find(p => p.id === targetUserId);
        if (target) {
          console.log(`🔴 ${fromUserId} ended call with ${targetUserId}`);
          io.to(target.socketId).emit('end-call', { fromUserId });
          return;
        }
      }

      // default: broadcast end-call to room excluding sender
      if (roomId) {
        console.log(`🔴 Broadcasting end-call from ${fromUserId} to room ${roomId}`);
        socket.to(roomId).emit('end-call', { fromUserId });
      }
    } catch (err) {
      console.error('❌ Error handling end-call:', err);
    }
  });

  // Mute status event - track who is muted
  socket.on('mute-status', ({ roomId, isMuted }) => {
    try {
      const fromUserId = socket.userId || socket.id;
      console.log(`🔇 ${fromUserId} mute status: ${isMuted ? 'MUTED' : 'UNMUTED'}`);

      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          // Update participant mute status
          const participant = room.participants.find(p => p.socketId === socket.id);
          if (participant) {
            participant.isMuted = isMuted;
          }

          // Broadcast mute status with sender info to all participants in room
          socket.to(roomId).emit('mute-status', { 
            isMuted, 
            fromUserId,
            senderName: participant?.name || 'Unknown'
          });
        }
      }
    } catch (err) {
      console.error('❌ Error handling mute-status:', err);
    }
  });

  // Chat message event
  socket.on('chat-message', (data) => {
    const { roomId, message, messageId } = data;
    
    console.log(`💬 Received chat-message from ${socket.id} in room ${roomId}:`, message);
    console.log(`📤 Message ID: ${messageId}`);
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      return;
    }
    
    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) {
      console.log(`❌ Participant not found for socket ${socket.id}`);
      console.log(`📋 Available participants:`, room.participants.map(p => ({name: p.name, socketId: p.socketId})));
      return;
    }
    
    const chatMessage = {
      id: messageId || uuidv4(), // Use provided messageId or generate new one
      userName: participant.name,
      content: message,
      timestamp: new Date().toISOString(),
      userId: participant.id,
      type: 'text'
    };
    
    console.log(`💾 Storing message in room ${roomId}:`, chatMessage);
    
    // Store message in room (initialize messages array if needed)
    if (!room.messages) {
      room.messages = [];
    }
    room.messages.push(chatMessage);
    
    // Limit stored messages to prevent memory issues (keep last 100)
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }
    
    console.log(`📤 Emitting new-message to room ${roomId}:`, chatMessage);
    console.log(`📤 Broadcasting to ${room.participants.length} participants in room ${roomId}`);
    
    // Broadcast to all sockets in the room, including the sender
    io.to(roomId).emit('new-message', chatMessage);
    console.log(`✅ Message broadcasted and stored for room ${roomId}`);
  });

  // Call list events
  socket.on('invite-to-call', ({ roomId, targetUserId, targetUserName }) => {
    try {
      console.log(`📞 ${socket.id} inviting ${targetUserId} to call in room ${roomId}`);
      const room = rooms.get(roomId);
      if (!room) {
        console.warn(`⚠️ invite-to-call: room ${roomId} not found`);
        io.to(socket.id).emit('invite-failed', { reason: 'room-not-found', targetUserId, targetUserName });
        return;
      }

      // Log current participants for easier debugging
      console.log('📋 Current participants in room:', (room.participants || []).map(p => ({ id: p.id, name: p.name, socketId: p.socketId, isMuted: p.isMuted })));

      const target = room.participants.find(p => p.id === targetUserId);
      if (!target) {
        console.warn(`⚠️ invite-to-call: target ${targetUserId} not found in room ${roomId}`);
        io.to(socket.id).emit('invite-failed', { reason: 'target-not-found', targetUserId, targetUserName });
        return;
      }

      if (!target.socketId) {
        console.warn(`⚠️ invite-to-call: target ${targetUserId} has no socketId`);
        io.to(socket.id).emit('invite-failed', { reason: 'target-offline', targetUserId, targetUserName });
        return;
      }

      // Send invitation to the target
      console.log(`📨 Emitting invite-to-call from ${socket.userId || socket.id} (${socket.userName || 'Unknown'}) to ${target.id} (socket ${target.socketId})`);
      
      // Find the inviter participant to check if they're host
      const inviterParticipant = room.participants.find(p => p.socketId === socket.id);
      
      io.to(target.socketId).emit('invite-to-call', {
        fromUser: {
          id: socket.userId || socket.id,
          name: socket.userName || 'Unknown',
          isHost: inviterParticipant ? inviterParticipant.isCreator : false
        }
      });

      // Acknowledge the inviter that the invite was sent
      io.to(socket.id).emit('invite-sent', { targetUserId: target.id, targetUserName: target.name });
    } catch (err) {
      console.error('❌ Error handling invite-to-call:', err);
      io.to(socket.id).emit('invite-failed', { reason: 'server-error', details: String(err), targetUserId, targetUserName });
    }
  });

  socket.on('request-join-call', ({ roomId, userId, userName }) => {
    try {
      console.log(`🙋 ${userName} requesting to join call in room ${roomId}`);
      const room = rooms.get(roomId);
      if (!room) {
        console.warn(`⚠️ request-join-call: room ${roomId} not found`);
        return;
      }

      // Log all participants to debug
      console.log(`📋 Room ${roomId} participants:`, room.participants.map(p => ({
        id: p.id,
        name: p.name,
        isCreator: p.isCreator,
        socketId: p.socketId
      })));

      // Send to host/room owner
      const hostParticipant = room.participants.find(p => p.isCreator);
      if (hostParticipant) {
        console.log(`📨 Emitting request-join-call to host ${hostParticipant.id} (${hostParticipant.name}) (socket ${hostParticipant.socketId})`);
        io.to(hostParticipant.socketId).emit('request-join-call', {
          fromUser: {
            id: userId,
            name: userName,
            isHost: false
          }
        });
      } else {
        console.warn(`⚠️ request-join-call: no host (isCreator) found in room ${roomId}`);
        console.warn(`⚠️ Total participants in room: ${room.participants.length}`);
        console.warn(`⚠️ Room creator email: ${room.creator}`);
      }
    } catch (err) {
      console.error('❌ Error handling request-join-call:', err);
    }
  });

  // 🎙️ HOST BROADCAST: Handle host starting auto-broadcast
  socket.on('start-broadcast', ({ roomId, broadcastType, userName }) => {
    try {
      console.log(`🎙️ Host ${userName} started ${broadcastType} broadcast in room ${roomId}`);
      const room = rooms.get(roomId);
      if (!room) {
        console.warn(`⚠️ start-broadcast: room ${roomId} not found`);
        return;
      }

      // Store broadcast state
      room.broadcastActive = true;
      room.broadcastType = broadcastType;
      room.broadcaster = {
        id: socket.userId || socket.id,
        name: userName,
        socketId: socket.id
      };

      // Notify all participants in the room that host is broadcasting
      io.to(roomId).emit('host-broadcasting', {
        hostName: userName,
        broadcastType,
        hostId: socket.userId || socket.id
      });

      console.log(`📢 Notified room ${roomId} that host is broadcasting ${broadcastType}`);
    } catch (err) {
      console.error('❌ Error handling start-broadcast:', err);
    }
  });

  socket.on('approve-join-request', ({ roomId, userId, userName }) => {
    try {
      console.log(`✅ Host approved join request from ${userName}`);
      const room = rooms.get(roomId);
      if (!room) return;

      const target = room.participants.find(p => p.id === userId);
      if (target) {
        io.to(target.socketId).emit('invitation-approved', {
          hostName: socket.userName || 'Host'
        });

        // Add to call list
        if (!room.callList) {
          room.callList = [];
        }
        room.callList.push(userId);

        // Notify all participants of updated call list
        io.to(roomId).emit('call-list-updated', { callList: room.callList });
      }
    } catch (err) {
      console.error('❌ Error handling approve-join-request:', err);
    }
  });

  socket.on('reject-join-request', ({ roomId, userId, userName }) => {
    try {
      console.log(`❌ Host rejected join request from ${userName}`);
      const room = rooms.get(roomId);
      if (!room) return;

      const target = room.participants.find(p => p.id === userId);
      if (target) {
        io.to(target.socketId).emit('invitation-rejected', {
          hostName: socket.userName || 'Host'
        });
      }
    } catch (err) {
      console.error('❌ Error handling reject-join-request:', err);
    }
  });

  socket.on('accept-invitation', ({ roomId, userId, userName }) => {
    try {
      console.log(`✅ ${userName} accepted invitation in room ${roomId}`);
      const room = rooms.get(roomId);
      if (!room) return;

      // Add to call list
      if (!room.callList) {
        room.callList = [];
      }
      if (!room.callList.includes(userId)) {
        room.callList.push(userId);
      }

      // Notify all participants of updated call list
      io.to(roomId).emit('call-list-updated', { callList: room.callList });
    } catch (err) {
      console.error('❌ Error handling accept-invitation:', err);
    }
  });

  socket.on('reject-invitation', ({ roomId, userId, userName }) => {
    try {
      console.log(`❌ ${userName} rejected invitation in room ${roomId}`);
      // Just log - no need to notify
    } catch (err) {
      console.error('❌ Error handling reject-invitation:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);

    // Remove participant entries that belonged to this socket from any rooms
    for (const [roomId, room] of rooms.entries()) {
      const idx = room.participants.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        const [removed] = room.participants.splice(idx, 1);
        console.log(`🧹 Removed participant ${removed.id} from room ${roomId} due to disconnect`);
        // notify others in the room
        socket.to(roomId).emit('user-left', removed.name || removed.id);
        
        // 📡 REAL-TIME UPDATE: Broadcast updated participant list to all users in the room
        console.log(`📡 Broadcasting updated participant list to room ${roomId} after disconnect`);
        io.to(roomId).emit('participants-updated', {
          participants: room.participants.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isCreator
          }))
        });
      }
    }

    if (socket.userId) {
      userSessions.delete(socket.userId);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;

// Add basic HTTP routes for health checking and debugging
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chat server is running',
    timestamp: new Date().toISOString(),
    rooms: Array.from(rooms.keys()),
    connectedUsers: connectedUsers.size
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: Array.from(rooms.keys()),
    connectedUsers: connectedUsers.size
  });
});

app.get('/debug/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    creator: room.creator,
    passcode: room.passcode,
    participants: room.participants.length,
    createdAt: room.createdAt
  }));
  
  res.json({ 
    rooms: roomList,
    totalRooms: rooms.size,
    connectedUsers: connectedUsers.size
  });
});

// Test endpoint to create a room via HTTP
app.post('/debug/create-room', (req, res) => {
  try {
    const { roomId, passcode, userName } = req.body;
    
    if (!roomId || !passcode || !userName) {
      return res.status(400).json({ 
        error: 'Missing required fields: roomId, passcode, userName' 
      });
    }
    
    if (rooms.has(roomId)) {
      return res.status(409).json({ 
        error: 'Room already exists' 
      });
    }
    
    const room = {
      id: roomId,
      passcode: passcode,
      creator: 'debug-user',
      creatorName: userName,
      participants: [],
      createdAt: new Date().toISOString()
    };
    
    rooms.set(roomId, room);
    
    console.log(`🧪 Debug room created: ${roomId} by ${userName}`);
    
    res.json({ 
      message: 'Room created successfully',
      room: {
        roomId,
        passcode,
        creator: userName
      }
    });
    
  } catch (error) {
    console.error('❌ Debug room creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 JWT Secret: ${JWT_SECRET}`);
});