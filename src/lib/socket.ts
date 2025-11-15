import { io, Socket } from 'socket.io-client';

// Create a proper socket manager with user isolation
class SocketManager {
  private sockets: Map<string, Socket> = new Map();
  
  getSocket(userId: string): Socket {
    if (!this.sockets.has(userId)) {
      // Automatically detect protocol and use same as current page
      let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

      if (!socketUrl) {
        // If no env var, auto-detect protocol from current page
        if (typeof window !== 'undefined') {
          const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
          const hostname = window.location.hostname;
          // For local development, connect to backend on port 3001
          // For production, use the same host as frontend
          const port = hostname === 'localhost' || hostname === '127.0.0.1' ? 3001 : window.location.port;
          socketUrl = `${protocol}//${hostname}:${port}`;
        } else {
          // SSR fallback
          socketUrl = 'http://localhost:3001';
        }
      }

      console.log(`🔌 Creating new socket for user ${userId} connecting to:`, socketUrl);
      console.log(`🔍 NEXT_PUBLIC_SOCKET_URL from env:`, process.env.NEXT_PUBLIC_SOCKET_URL || 'AUTO-DETECTED');
      console.log(`🔒 Protocol:`, socketUrl.startsWith('https') ? 'HTTPS (Secure)' : 'HTTP');

      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        // Force secure connection on HTTPS
        secure: socketUrl.startsWith('https'),
        rejectUnauthorized: false, // Allow self-signed certs in dev
      });

      socket.on('connect', () => {
        console.log(`✅ Socket connected for user ${userId} with ID:`, socket.id);
        console.log('📡 Socket transport:', socket.io.engine.transport.name);
      });

      socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket disconnected for user ${userId}, reason:`, reason);
        // Auto-reconnect on certain disconnect reasons
        if (reason === 'io client disconnect' || reason === 'transport close') {
          console.log(`🔄 Attempting to reconnect socket for user ${userId}...`);
          setTimeout(() => {
            if (!socket.connected && !socket.connecting) {
              socket.connect();
            }
          }, 1000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error(`❌ Socket connection error for user ${userId}:`, error);
      });

      socket.on('error', (error) => {
        console.error(`❌ Socket error for user ${userId}:`, error);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Socket reconnected for user ${userId} after`, attemptNumber, 'attempts');
      });

      socket.on('reconnect_failed', () => {
        console.error(`❌ Socket reconnection failed for user ${userId}`);
      });

      this.sockets.set(userId, socket);
    }
    
    return this.sockets.get(userId)!;
  }
  
  disconnectSocket(userId: string) {
    const socket = this.sockets.get(userId);
    if (socket) {
      socket.disconnect();
      this.sockets.delete(userId);
      console.log(`👋 Disconnected socket for user ${userId}`);
    }
  }
  
  getAllSockets(): Socket[] {
    return Array.from(this.sockets.values());
  }
}

const socketManager = new SocketManager();

// Generate a unique user ID for the current session
const getUserId = (): string => {
  let userId = localStorage.getItem('socketUserId');
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('socketUserId', userId);
  }
  return userId;
};

export const initializeSocket = (): Socket => {
  const userId = getUserId();
  return socketManager.getSocket(userId);
};

export const getSocket = (): Socket => {
  const userId = getUserId();
  const socket = socketManager.getSocket(userId);
  
  // Ensure socket is connected or connecting
  if (!socket.connected && !socket.connecting) {
    console.log('🔌 Socket not connected, connecting...');
    socket.connect();
  }
  
  return socket;
};

export const disconnectSocket = () => {
  const userId = getUserId();
  socketManager.disconnectSocket(userId);
};

export { socketManager };