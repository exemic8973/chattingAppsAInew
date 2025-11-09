import { io, Socket } from 'socket.io-client';

// Create a proper socket manager with user isolation
class SocketManager {
  private sockets: Map<string, Socket> = new Map();
  
  getSocket(userId: string): Socket {
    if (!this.sockets.has(userId)) {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
      console.log(`🔌 Creating new socket for user ${userId} connecting to:`, socketUrl);
      
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        // Remove forceNew to allow proper connection management
      });

      socket.on('connect', () => {
        console.log(`✅ Socket connected for user ${userId} with ID:`, socket.id);
        console.log('📡 Socket transport:', socket.io.engine.transport.name);
      });

      socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket disconnected for user ${userId}, reason:`, reason);
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
  return socketManager.getSocket(userId);
};

export const disconnectSocket = () => {
  const userId = getUserId();
  socketManager.disconnectSocket(userId);
};

export { socketManager };