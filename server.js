const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
      
      if (!token) {
        socket.emit('auth-error', { message: 'No token provided' });
        return;
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
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

  // Join room event
  socket.on('join-room', (data) => {
    const { roomId, passcode, userName } = data;
    
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
    
    // Generate consistent user ID based on socket authentication or guest ID
    const userId = socket.user ? socket.user.id : `guest-${socket.id}`;
    
    // Check if user is already in the room by user ID (not just socket ID)
    const existingParticipant = room.participants.find(p => p.id === userId);
    if (existingParticipant) {
      console.log(`⚠️ User ${userName} already in room ${roomId} with user ID ${userId}`);
      console.log(`🔄 Updating socket ID for existing participant`);
      // Update the socket ID for the existing participant
      existingParticipant.socketId = socket.id;
      
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

    console.log(`✅ Join room process completed for ${userName}`);
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

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
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