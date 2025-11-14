'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSocket } from '@/lib/socket';

interface RoomJoinProps {
  roomId: string;
}

export default function RoomJoin({ roomId }: RoomJoinProps) {
  const [userName, setUserName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const router = useRouter();

  // Debug: Log room ID on component mount
  useEffect(() => {
    console.log('🎯 RoomJoin component mounted with roomId:', roomId);
    console.log('📍 Current URL:', window.location.href);
    console.log('🔍 URL pathname:', window.location.pathname);
  }, [roomId]);

  const handleJoinRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!passcode.trim()) {
      alert('Please enter the passcode');
      return;
    }

          console.log(`🚪 Attempting to join room: ${roomId} with passcode: ${passcode} as user: ${userName}`);
      console.log(`📊 Room join data:`, { roomId, passcode, userName });
      setIsJoining(true);

    try {
      const socket = initializeSocket();

      // Wait for socket connection before emitting
      if (!socket.connected) {
        console.log('🔌 Socket not connected, waiting for connection...');
        await new Promise((resolve) => {
          socket.on('connect', () => {
            console.log('✅ Socket connected, proceeding with room join');
            resolve(void 0);
          });
        });
      }

  const persistentUserId = localStorage.getItem('socketUserId');
  socket.emit('join-room', { roomId, passcode, userName, persistentUserId });

      socket.on('room-joined', ({ users, messages }) => {
        console.log(`✅ Successfully joined room: ${roomId}`);
        router.push(`/room/${roomId}?name=${encodeURIComponent(userName)}&passcode=${passcode}`);
      });

      socket.on('error', (error) => {
        console.error('❌ Socket error during room join:', error);
        console.error('❌ Socket error type:', typeof error);
        console.error('❌ Socket error JSON:', JSON.stringify(error, null, 2));
        
        if (typeof error === 'string') {
          alert(error);
        } else if (error && typeof error === 'object') {
          alert(error.message || 'Failed to join room');
        } else {
          alert('An unknown error occurred while joining the room');
        }
        setIsJoining(false);
      });

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (isJoining) {
          console.log('⏰ Room join timeout - no response from server');
          alert('Connection timeout - please try again');
          setIsJoining(false);
        }
      }, 10000); // 10 second timeout

    } catch (error) {
      console.error('❌ Error joining room:', error);
      alert('Failed to join room: ' + (error as Error).message);
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen d-flex align-items-center justify-content-center p-4">
      <div className="glass-morphism p-5" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="text-center mb-4">
          <h1 className="h2 mb-3">
            <i className="bi bi-door-open-fill text-primary me-2"></i>
            Join Room
          </h1>
          <p className="text-secondary">Enter your details to join the chat</p>
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold">Room ID</label>
          <input
            type="text"
            className="form-control form-control-lg text-center"
            value={roomId}
            readOnly
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="userName" className="form-label">Your Name</label>
          <input
            type="text"
            className="form-control form-control-lg"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="passcode" className="form-label">Room Passcode</label>
          <input
            type="password"
            className="form-control form-control-lg"
            id="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter 6-digit passcode"
            maxLength={6}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
        </div>

        <button
          className="btn btn-primary btn-lg w-100 gradient-bg border-0"
          onClick={handleJoinRoom}
          disabled={isJoining || !userName.trim() || !passcode.trim()}
        >
          {isJoining ? (
            <>
              <span className="connecting-spinner me-2"></span>
              Joining Room...
            </>
          ) : (
            <>
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Join Room
            </>
          )}
        </button>

        <div className="text-center mt-3">
          <a href="/" className="text-decoration-none text-secondary">
            <i className="bi bi-arrow-left me-1"></i>
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}