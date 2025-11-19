'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function RoomCreationStepDebugger() {
  const [debugSteps, setDebugSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const addStep = (step: string) => {
    setDebugSteps(prev => [...prev, `🔍 ${new Date().toLocaleTimeString()}: ${step}`]);
    setCurrentStep(prev => prev + 1);
  };

  const runFullDebug = async () => {
    console.log('🧪 Starting comprehensive room creation debug...');
    setDebugSteps([]);
    setCurrentStep(0);

    addStep('Starting debug process');

    // Step 1: Check authentication
    addStep('Checking authentication status...');
    const token = localStorage.getItem('authToken');
    const userName = localStorage.getItem('userName');
    
    if (!token) {
      addStep('❌ No authentication token found');
      return;
    }
    addStep('✅ Authentication token found');
    addStep(`✅ User name: ${userName || 'Not set'}`);

    // Step 2: Test API endpoints
    addStep('Testing authentication API endpoint...');
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        addStep(`✅ API authentication successful: ${data.user?.userName}`);
      } else {
        addStep(`❌ API authentication failed: ${response.status}`);
        const errorText = await response.text();
        addStep(`❌ Error details: ${errorText}`);
        return;
      }
    } catch (error) {
      addStep(`❌ API connection error: ${error}`);
      return;
    }

    // Step 3: Test socket connection
    addStep('Testing socket connection...');
    try {
      const { io } = await import('socket.io-client');
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      return new Promise<void>((resolve) => {
        socket.on('connect', () => {
          addStep(`✅ Socket connected with ID: ${socket.id}`);
          
          // Step 4: Test socket authentication
          addStep('Testing socket authentication...');
          socket.emit('authenticate', { token });
        });

        socket.on('auth-success', (data) => {
          addStep(`✅ Socket authentication successful: ${data.user?.userName}`);
          
          // Step 5: Test room creation
          addStep('Testing room creation...');
          socket.emit('create-room', { 
            userName: userName || 'Test User', 
            passcode: '123456' 
          });
        });

        socket.on('room-created', (data) => {
          addStep(`🎉 Room created successfully!`);
          addStep(`📊 Room ID: ${data.roomId}`);
          addStep(`🔑 Passcode: ${data.passcode}`);
          addStep(`🔗 Share URL: ${data.shareUrl}`);
          socket.disconnect();
          resolve();
        });

        socket.on('auth-error', (data) => {
          addStep(`❌ Socket authentication failed: ${data.message}`);
          socket.disconnect();
          resolve();
        });

        socket.on('error', (error) => {
          addStep(`❌ Socket error: ${error.message || error}`);
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', (error) => {
          addStep(`❌ Socket connection error: ${error.message}`);
          resolve();
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (socket.connected) {
            addStep('⏰ Socket test timeout - disconnecting');
            socket.disconnect();
          }
          resolve();
        }, 10000);
      });
    } catch (error) {
      addStep(`❌ Socket test error: ${error}`);
    }
  };

  const copyDebugInfo = () => {
    const debugText = debugSteps.join('\n');
    navigator.clipboard.writeText(debugText);
    addStep('📋 Debug info copied to clipboard');
  };

  return (
    <div className="fixed-top p-3 bg-dark text-light" style={{ zIndex: 9999, maxHeight: '50vh', overflowY: 'auto' }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">🔍 Room Creation Debugger</h6>
        <div>
          <button className="btn btn-sm btn-primary me-2" onClick={runFullDebug}>
            🧪 Run Full Test
          </button>
          <button className="btn btn-sm btn-outline-light me-2" onClick={copyDebugInfo}>
            📋 Copy
          </button>
          <button className="btn btn-sm btn-outline-light" onClick={() => setDebugSteps([])}>
            🗑️ Clear
          </button>
        </div>
      </div>
      
      <div className="bg-secondary p-2 rounded" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
        {debugSteps.length === 0 ? (
          <div className="text-muted">Click "Run Full Test" to start debugging...</div>
        ) : (
          debugSteps.map((step, index) => (
            <div key={index} className="mb-1">{step}</div>
          ))
        )}
      </div>
      
      <div className="mt-2 text-center">
        <small className="text-muted">
          Current Step: {currentStep} | Open browser console for detailed logs
        </small>
      </div>
    </div>
  );
}