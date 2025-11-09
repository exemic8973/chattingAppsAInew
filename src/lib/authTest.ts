// Test authentication flow
export const testAuthFlow = async () => {
  console.log('🧪 Testing complete authentication flow...');
  
  try {
    // Step 1: Test Next.js API login
    console.log('1️⃣ Testing Next.js API login...');
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123',
      }),
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Next.js API login successful:', loginData);
      
      // Step 2: Test Next.js API me endpoint
      console.log('2️⃣ Testing Next.js API me endpoint...');
      const meResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        console.log('✅ Next.js API me successful:', meData);
        
        // Step 3: Test backend socket authentication
        console.log('3️⃣ Testing backend socket authentication...');
        const { io } = await import('socket.io-client');
        const socket = io('http://localhost:3001', {
          transports: ['websocket', 'polling'],
          timeout: 5000
        });

        return new Promise((resolve) => {
          socket.on('connect', () => {
            console.log('✅ Socket connected with ID:', socket.id);
            socket.emit('authenticate', { token: loginData.token });
          });

          socket.on('auth-success', (data) => {
            console.log('✅ Socket authentication successful:', data);
            socket.disconnect();
            resolve(true);
          });

          socket.on('auth-error', (data) => {
            console.log('❌ Socket authentication failed:', data);
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
      } else {
        console.log('❌ Next.js API me failed:', meResponse.status);
        return false;
      }
    } else {
      console.log('❌ Next.js API login failed:', loginResponse.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Auth flow test error:', error);
    return false;
  }
};