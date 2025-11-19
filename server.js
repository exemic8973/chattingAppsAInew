// Load environment variables from .env.local first
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const SecurityMiddleware = require('./src/lib/security/middleware');
const ValidationSchemas = require('./src/lib/security/validation');

// Room ID generation function (must match frontend)
const generateRoomId = () => {
  const adjectives = ['RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'PURPLE', 'ORANGE', 'PINK'];
  const nouns = ['STAR', 'MOON', 'SUN', 'SKY', 'WAVE', 'FIRE', 'ICE', 'WIND'];
  const numbers = Math.floor(100 + Math.random() * 900);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}-${noun}-${numbers}`;
};

// Initialize security middleware
const security = new SecurityMiddleware();

// Create a simple Express server
const app = express();

// Trust proxy for correct IP detection
app.set('trust proxy', 1);

// Security headers
app.use(security.setSecurityHeaders);

// Enhanced CORS configuration
const corsConfig = security.getCorsConfig();
app.use(cors(corsConfig));

// Body parsing with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress
});

const socketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 connection attempts per windowMs
  message: 'Too many connection attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress
});

// Apply rate limiting
app.use(generalLimiter);

// Audit logging
app.use(security.auditLog);

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
    
    const shareUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/room/${roomId}`;
    
    console.log(`🎉 Room created: ${roomId} by ${userName}`);
    console.log(`📊 Updated rooms in memory: ${Array.from(rooms.keys()).join(', ')}`);
    socket.emit('room-created', { roomId, passcode, shareUrl });
  });

  // Update owner socket event (when owner navigates to room page after creating)
  socket.on('update-owner-socket', (data) => {
    const { roomId, passcode } = data;

    console.log(`🔄 Owner socket update request for room: ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    let owner;

    // Try JWT authentication first
    if (socket.user) {
      console.log(`🔐 Using JWT authentication for owner: ${socket.user.userName}`);
      owner = room.participants.find(p => p.id === socket.user.id);

      if (!owner) {
        console.log(`❌ User ${socket.user.id} is not in room ${roomId}`);
        socket.emit('error', { message: 'User not found in room' });
        return;
      }

      if (!owner.isCreator) {
        console.log(`❌ User ${socket.user.userName} is not the owner of room ${roomId}`);
        socket.emit('error', { message: 'Only the owner can update their socket' });
        return;
      }
    } else if (passcode) {
      // Fallback to passcode authentication
      console.log(`🔑 Using passcode authentication for owner`);

      if (room.passcode !== passcode) {
        console.log(`❌ Invalid passcode for room ${roomId}`);
        socket.emit('error', { message: 'Invalid passcode' });
        return;
      }

      // Find the owner (creator) participant
      owner = room.participants.find(p => p.isCreator);

      if (!owner) {
        console.log(`❌ Owner not found in room ${roomId}`);
        socket.emit('error', { message: 'Owner not found in room' });
        return;
      }
    } else {
      console.log(`❌ No authentication method provided (neither JWT nor passcode)`);
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    console.log(`✅ Updating owner socket ID from ${owner.socketId} to ${socket.id}`);
    owner.socketId = socket.id;

    // Join the socket to the room
    socket.join(roomId);
    console.log(`📢 Owner socket joined room ${roomId}`);
    console.log(`📢 Room members after owner join:`, Array.from(io.sockets.adapter.rooms.get(roomId) || []));

    // Send current room state to owner
    const ownerId = socket.user ? socket.user.id : owner.id;
    socket.emit('room-joined', {
      roomId,
      users: room.participants.filter(p => p.id !== ownerId).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isCreator
      })),
      messages: room.messages || []
    });

    console.log(`✅ Owner socket updated successfully for room ${roomId}`);
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

    // Generate consistent user ID: prioritize authenticated user ID, then persistent ID, then guest ID
    let userId;
    if (socket.user) {
      userId = socket.user.id;
      console.log(`🔐 Using authenticated user ID: ${userId}`);
    } else if (persistentUserId) {
      userId = persistentUserId;
      console.log(`🔑 Using persistent user ID: ${userId}`);
    } else {
      userId = `guest-${socket.id}`;
      console.log(`👤 Using guest ID: ${userId}`);
    }
    
    // Check if user is already in the room by user ID (not just socket ID)
    const existingParticipant = room.participants.find(p => p.id === userId);
    if (existingParticipant) {
      console.log(`⚠️ User ${userName} already in room ${roomId} with user ID ${userId}`);
      console.log(`🔄 Updating socket ID for existing participant`);
      // Update the socket ID for the existing participant
      existingParticipant.socketId = socket.id;
      
      // Still send current room data (filter out current user)
      socket.emit('room-joined', {
        roomId,
        users: room.participants.filter(p => p.id !== userId).map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isCreator
        })),
        messages: room.messages || []
      });
      
      // Re-join socket to room (in case socket reconnected)
      socket.join(roomId);
      return;
    }
    
    // Check if this socket is already in the room (prevent duplicates)
    const existingSocketParticipant = room.participants.find(p => p.socketId === socket.id);
    if (existingSocketParticipant) {
      console.log(`⚠️ Socket ${socket.id} already in room ${roomId}`);
      socket.emit('room-joined', {
        roomId,
        users: room.participants.filter(p => p.id !== userId).map(p => ({
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
      isCreator: socket.user ? socket.user.email === room.creator : false,
      joinedAt: new Date().toISOString()
    };
    
    console.log(`📝 Adding participant to room:`, participant);
    console.log(`📊 Participants before adding: ${room.participants.length}`);
    
    room.participants.push(participant);
    
    console.log(`📊 Participants after adding: ${room.participants.length}`);
    console.log(`📋 All participants:`, room.participants);
    
    socket.join(roomId);
    console.log(`✅ Socket ${socket.id} joined room ${roomId}`);
    
    console.log(`👥 ${userName} joined room ${roomId}`);
    
    // Initialize messages array if not exists
    if (!room.messages) {
      room.messages = [];
    }
    
    // Send complete room data to the joining user (filter out current user)
    console.log(`📤 Sending room-joined event to socket ${socket.id}`);
    console.log(`📤 Room participants for room ${roomId}:`, room.participants);

    socket.emit('room-joined', {
      roomId,
      users: room.participants.filter(p => p.id !== userId).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isCreator
      })),
      messages: room.messages
    });
    
    // 🔥 CRITICAL FIX: Notify other participants in the room about the new user
    console.log(`📢 Broadcasting user-joined event to room ${roomId}`);
    console.log(`📢 Room participants before broadcast:`, room.participants.map(p => ({ id: p.id, name: p.name, socketId: p.socketId })));
    console.log(`📢 Broadcasting to socket IDs:`, Array.from(io.sockets.adapter.rooms.get(roomId) || []));
    
    socket.to(roomId).emit('user-joined', {
      userName,
      user: {
        id: participant.id,
        name: participant.name,
        isHost: participant.isCreator
      },
      participantCount: room.participants.length
    });
    
    console.log(`✅ user-joined event broadcast completed for ${userName}`);
  });

  // Leave room event - CRITICAL for proper user management
  socket.on('leave-room', (data) => {
    const { roomId, userId, userName } = data;
    
    console.log(`🚪 User ${userName} (${userId}) leaving room ${roomId}`);
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Find and remove participant
    const participantIndex = room.participants.findIndex(p => p.id === userId);
    if (participantIndex === -1) {
      console.log(`❌ User ${userId} not found in room ${roomId}`);
      socket.emit('error', { message: 'User not in room' });
      return;
    }
    
    const participant = room.participants[participantIndex];
    
    // Remove from room
    room.participants.splice(participantIndex, 1);
    socket.leave(roomId);
    
    console.log(`✅ User ${participant.name} removed from room ${roomId}`);
    console.log(`📊 Room ${roomId} now has ${room.participants.length} participants`);
    
    // Notify other users
    socket.to(roomId).emit('user-left', {
      userName: participant.name,
      userId: participant.id,
      participantCount: room.participants.length
    });
    
    // Send confirmation to leaving user
    socket.emit('room-left', {
      roomId,
      message: 'Successfully left room'
    });
    
    console.log(`📢 Notified room ${roomId} about user departure`);
  });

  // Chat message event
  // Debug event handlers
  socket.on('test-event', (data) => {
    console.log(`🔍 Received test-event from ${socket.id}:`, data);
    socket.emit('test-event', { message: 'Echo from server', original: data, timestamp: Date.now() });
  });

  socket.on('debug-host-test', (data) => {
    console.log(`🔍 Received debug-host-test from ${socket.id}:`, data);
    const { roomId } = data;
    console.log(`📢 Broadcasting debug response to room ${roomId}`);
    socket.to(roomId).emit('debug-response', { 
      message: 'Host debug broadcast', 
      from: socket.id,
      timestamp: Date.now() 
    });
  });

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

  // Host mute participant event
  socket.on('host-mute-participant', (data) => {
    const { roomId, targetUserId } = data;

    console.log(`🔇 Host mute request from ${socket.id} for user ${targetUserId} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Verify requester is the host
    const requester = room.participants.find(p => p.socketId === socket.id);
    if (!requester || !requester.isCreator) {
      console.log(`❌ User ${socket.id} is not the host, cannot mute participants`);
      socket.emit('error', { message: 'Only the host can mute participants' });
      return;
    }

    // Find the target participant
    const targetParticipant = room.participants.find(p => p.id === targetUserId);
    if (!targetParticipant) {
      console.log(`❌ Target user ${targetUserId} not found in room ${roomId}`);
      socket.emit('error', { message: 'Target user not found' });
      return;
    }

    console.log(`✅ Host ${requester.name} muting participant ${targetParticipant.name}`);

    // Emit mute event to the target user
    io.to(targetParticipant.socketId).emit('participant-muted-by-host', {
      roomId,
      mutedBy: requester.name
    });

    // Broadcast mute status to all participants in the room
    io.to(roomId).emit('participant-mute-status', {
      userId: targetUserId,
      isMuted: true,
      mutedByHost: true
    });

    console.log(`✅ Participant ${targetParticipant.name} muted by host`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Find and remove user from all rooms they were in
    for (const [roomId, room] of rooms.entries()) {
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
      
      if (participantIndex !== -1) {
        const participant = room.participants[participantIndex];
        console.log(`👤 User ${participant.name} left room ${roomId}`);
        
        // Remove participant from room
        room.participants.splice(participantIndex, 1);
        
        // Notify other users in the room
        socket.to(roomId).emit('user-left', {
          userName: participant.name,
          userId: participant.id,
          participantCount: room.participants.length
        });
        
        console.log(`📢 Notified room ${roomId} that ${participant.name} left`);
        
        // If room is empty, optionally clean it up
        if (room.participants.length === 0) {
          console.log(`🏠 Room ${roomId} is now empty`);
          // Optional: rooms.delete(roomId); // Uncomment to auto-delete empty rooms
        }
        
        break; // User can only be in one room at a time
      }
    }
    
    // Clean up user session
    if (socket.userId) {
      userSessions.delete(socket.userId);
    }
    
    connectedUsers.delete(socket.id);
    console.log(`🧹 Cleaned up user session for ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3001;

// Add basic HTTP routes for health checking and debugging
app.get('/', generalLimiter, (req, res) => {
  res.json({ 
    message: 'Chat server is running',
    timestamp: new Date().toISOString(),
    rooms: Array.from(rooms.keys()),
    connectedUsers: connectedUsers.size,
    security: {
      cors: 'enabled',
      rateLimiting: 'enabled',
      securityHeaders: 'enabled'
    }
  });
});

app.get('/health', generalLimiter, (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: Array.from(rooms.keys()),
    connectedUsers: connectedUsers.size,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100
    }
  });
});

app.get('/debug/rooms', generalLimiter, (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    creator: room.creator,
    passcode: room.passcode ? '***' : 'none',
    participants: room.participants.length,
    createdAt: room.createdAt
  }));
  
  res.json({ 
    rooms: roomList,
    totalRooms: rooms.size,
    connectedUsers: connectedUsers.size,
    security: {
      ip: req.ip,
      rateLimit: req.rateLimit
    }
  });
});

// Test endpoint to create a room via HTTP
app.post('/debug/create-room', generalLimiter, (req, res) => {
  try {
    const { roomId, passcode, userName } = req.body;
    
    // Input sanitization
    const sanitizedData = {
      roomId: roomId ? roomId.replace(/[<>]/g, '').trim().substring(0, 50) : null,
      passcode: passcode ? passcode.replace(/[<>]/g, '').trim().substring(0, 50) : null,
      userName: userName ? userName.replace(/[<>]/g, '').trim().substring(0, 50) : null
    };
    
    if (!sanitizedData.roomId || !sanitizedData.passcode || !sanitizedData.userName) {
      return res.status(400).json({ 
        error: 'Missing required fields: roomId, passcode, userName' 
      });
    }
    
    // Validate room ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedData.roomId)) {
      return res.status(400).json({ 
        error: 'Room ID can only contain letters, numbers, underscores, and hyphens' 
      });
    }
    
    if (rooms.has(sanitizedData.roomId)) {
      return res.status(409).json({ 
        error: 'Room already exists' 
      });
    }
    
    const room = {
      id: sanitizedData.roomId,
      passcode: sanitizedData.passcode,
      creator: 'debug-user',
      creatorName: sanitizedData.userName,
      participants: [],
      createdAt: new Date().toISOString()
    };
    
    rooms.set(sanitizedData.roomId, room);
    
    console.log(`🧪 Debug room created: ${sanitizedData.roomId} by ${sanitizedData.userName}`);
    
    res.json({ 
      message: 'Room created successfully',
      security: {
        ip: req.ip,
        rateLimit: req.rateLimit
      },
      room: {
        roomId: sanitizedData.roomId,
        passcode: '***',
        creator: sanitizedData.userName
      }
    });
    
  } catch (error) {
    console.error('❌ Debug room creation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      security: {
        ip: req.ip
      }
    });
  }
});

// Error handler for security middleware
app.use((err, req, res, next) => {
  if (err.name === 'CorsError' || err.message?.includes('not allowed by CORS')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed',
      security: true
    });
  }

  if (err.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: err.message,
      retryAfter: err.resetTime ? Math.ceil((err.resetTime - Date.now()) / 1000) : 60
    });
  }

  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 JWT Secret: ${JWT_SECRET}`);
});