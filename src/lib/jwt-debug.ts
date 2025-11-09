import { io } from 'socket.io-client';

// Debug JWT token issue
export const debugJWT = async () => {
  console.log('🔍 Debugging JWT token issue...');
  
  try {
    // Get current token from localStorage
    const token = localStorage.getItem('authToken');
    console.log('📋 Current token:', token ? '✅ Exists' : '❌ Missing');
    
    if (token) {
      console.log('📄 Token content:', token.substring(0, 50) + '...');
      
      // Try to decode the token (client-side)
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔓 Decoded token payload:', payload);
          console.log('👤 User data from token:', {
            userId: payload.userId,
            email: payload.email,
            userName: payload.userName
          });
        } else {
          console.log('❌ Invalid JWT token format');
        }
      } catch (e) {
        console.log('❌ Failed to decode token:', e);
      }
    }
    
    // Test backend directly
    console.log('🧪 Testing backend directly...');
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    return new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('✅ Socket connected with ID:', socket.id);
        console.log('🔑 Sending token:', token ? token.substring(0, 20) + '...' : 'No token');
        socket.emit('authenticate', { token });
      });

      socket.on('auth-success', (data) => {
        console.log('✅ Socket authentication successful:', data);
        socket.disconnect();
        resolve(true);
      });

      socket.on('auth-error', (data) => {
        console.log('❌ Socket authentication failed:', data);
        console.log('📊 Error details:', {
          message: data.message,
          details: data.details
        });
        socket.disconnect();
        resolve(false);
      });

      socket.on('connect_error', (error) => {
        console.log('❌ Socket connection error:', error);
        resolve(false);
      });

      setTimeout(() => {
        if (socket.connected) {
          socket.disconnect();
        }
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.error('❌ JWT debug error:', error);
    return false;
  }
};