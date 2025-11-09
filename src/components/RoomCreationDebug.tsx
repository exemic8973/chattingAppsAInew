'use client';

import { useEffect } from 'react';

export default function RoomCreationDebug() {
  useEffect(() => {
    console.log('🧪 Room Creation Debug Component Mounted');
    
    // Test socket connection
    const testSocket = async () => {
      try {
        // Test authentication endpoint first
        console.log('📡 Testing authentication endpoint...');
        const authResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'test123',
          }),
        });

        console.log('📡 Auth response status:', authResponse.status);
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          console.log('✅ Auth successful, token:', authData.token?.substring(0, 10) + '...');
          
          // Test socket connection
          console.log('🔗 Testing socket connection...');
          const { io } = await import('socket.io-client');
          const socket = io('http://localhost:3001');
          
          socket.on('connect', () => {
            console.log('✅ Socket connected with ID:', socket.id);
            
            // Test authentication
            socket.emit('authenticate', { token: authData.token });
          });

          socket.on('auth-success', () => {
            console.log('✅ Socket authentication successful');
            socket.disconnect();
          });

          socket.on('auth-error', (data) => {
            console.log('❌ Socket authentication failed:', data);
            socket.disconnect();
          });

          socket.on('connect_error', (error) => {
            console.log('❌ Socket connection error:', error);
          });

          // Disconnect after 5 seconds
          setTimeout(() => {
            socket.disconnect();
            console.log('🔌 Socket disconnected after test');
          }, 5000);
        } else {
          console.log('❌ Auth failed, cannot test socket');
        }
      } catch (error) {
        console.error('❌ Test error:', error);
      }
    };

    testSocket();
  }, []);

  return (
    <div className="fixed-bottom p-2 bg-info text-white" style={{ zIndex: 9998, fontSize: '0.7rem' }}>
      <div className="container-fluid">
        <div className="row">
          <div className="col">
            🔍 Room Creation Debug: Check browser console for detailed logs
          </div>
          <div className="col-auto">
            <button 
              className="btn btn-sm btn-outline-light"
              onClick={() => window.location.reload()}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}