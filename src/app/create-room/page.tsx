'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId, generatePasscode, generateShareUrl, copyToClipboard } from '@/lib/utils';
import { initializeSocket } from '@/lib/socket';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CreateRoomPage() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    const storedUserName = localStorage.getItem('userName');
    
    if (!token) {
      alert('Please login first to create a room');
      router.push('/login');
      return;
    }
    
    setIsAuthenticated(true);
    if (storedUserName) {
      setUserName(storedUserName);
    }
  }, [router]);

  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setError(t('validation.required'));
      return;
    }

    setIsCreating(true);
    setError(''); // Clear previous errors
    
    console.log('🚀 Starting room creation process...');
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError(t('error.unauthorized'));
        router.push('/login');
        return;
      }

      console.log('📍 User name:', userName);
      console.log('🔑 Token exists:', !!token);

      const socket = initializeSocket();
      let isProcessed = false;
      
      // Check if socket is connected
      if (!socket.connected) {
        console.log('🔌 Socket not connected, waiting for connection...');
        socket.connect();
      }
      
      console.log('🔗 Socket ID:', socket.id);
      console.log('📡 Socket connected:', socket.connected);

      // Set up socket event listeners with cleanup
      const cleanup = () => {
        socket.off('connect');
        socket.off('auth-success');
        socket.off('auth-error');
        socket.off('room-created');
        socket.off('error');
        socket.off('connect_error');
      };

      try {
        socket.on('connect', () => {
          console.log('✅ Socket connected with ID:', socket.id);
          // Authenticate after connection
          socket.emit('authenticate', { token });
        });

        socket.on('auth-success', (data) => {
          if (isProcessed) return;
          console.log('✅ Socket authentication successful:', data);
          console.log('🎯 Creating room with user:', userName);
          
          // Add a small delay to ensure authentication is processed
          setTimeout(() => {
            if (!isProcessed) {
              console.log('🚀 Emitting create-room event...');
              const newRoomId = generateRoomId();
              const newPasscode = generatePasscode();
              console.log(`📍 Creating room with ID: ${newRoomId}, passcode: ${newPasscode}`);
              socket.emit('create-room', { 
                roomId: newRoomId,
                userName: userName, 
                passcode: newPasscode 
              });
            }
          }, 100); // Small delay to ensure auth is processed
        });

        socket.on('auth-error', ({ message, details }) => {
        if (isProcessed) return;
        isProcessed = true;
        console.error('❌ Socket authentication failed:', message, details);

        // Check for JWT signature mismatch - clear old token and redirect to login
        if (details && (details.includes('invalid signature') || details.includes('jwt malformed'))) {
          console.log('🔄 Invalid JWT token detected - clearing and redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          alert('Your session has expired or is invalid. Please log in again.');
          window.location.href = '/login';
          return;
        }

        if (message.includes('User not found')) {
          console.log('🔄 User not found in backend - trying to create user from JWT');
          // Try to continue anyway - backend should create user from JWT
          console.log('🎯 Creating room despite authentication warning');
          const newRoomId = generateRoomId();
          const newPasscode = generatePasscode();
          console.log(`📍 Fallback: Creating room with ID: ${newRoomId}, passcode: ${newPasscode}`);
          socket.emit('create-room', {
            roomId: newRoomId,
            userName: userName,
            passcode: newPasscode
          });
        } else {
          setError(`Authentication failed: ${message}`);
          setIsCreating(false);
          cleanup();
          if (socket && socket.connected) {
            socket.disconnect();
          }
        }
      });

        socket.on('room-created', ({ roomId, passcode, shareUrl }) => {
          if (isProcessed) return;
          isProcessed = true;
          console.log('🎉 Room created successfully:', { roomId, passcode, shareUrl });
          console.log(`📝 Room details - ID: ${roomId}, Passcode: ${passcode}`);
          
          // Auto-join the room as the owner instead of showing room info
          console.log(`🚪 Auto-joining room as owner...`);
          
          // Show loading state
          setIsCreating(true);
          
          // Store room details for joining
          setRoomId(roomId);
          setPasscode(passcode);
          setShareUrl(shareUrl);
          
          // Redirect to the chat room with owner credentials
          setTimeout(() => {
            console.log(`🚀 Redirecting to chat room: ${roomId}`);
            router.push(`/room/${roomId}?name=${encodeURIComponent(userName)}&passcode=${passcode}&owner=true`);
          }, 1500); // Delay for user feedback
          
          cleanup();
          if (socket && socket.connected) {
            socket.disconnect();
          }
        });

        socket.on('error', (error) => {
          if (isProcessed) return;
          isProcessed = true;
          console.error('❌ Socket error:', error);
          setError(error.message || t('error.server'));
          setIsCreating(false);
          cleanup();
          if (socket && socket.connected) {
            socket.disconnect();
          }
        });

        socket.on('connect_error', (error) => {
          if (isProcessed) return;
          isProcessed = true;
          console.error('❌ Socket connection error:', error);
          setError(t('error.network'));
          setIsCreating(false);
          cleanup();
          if (socket && socket.connected) {
            socket.disconnect();
          }
        });

        // Authenticate socket connection
        if (socket.connected) {
          console.log('🔑 Authenticating socket...');
          socket.emit('authenticate', { token });
        }
        
        // Add a timeout to prevent hanging
        const timeout = setTimeout(() => {
          if (!isProcessed && isCreating) {
            console.log('⏰ Room creation timeout - trying fallback method...');
            isProcessed = true;
            
            // Fallback: Try creating room via HTTP API instead of socket
            createRoomViaAPI(token, userName);
          }
        }, 10000); // 10 second timeout

      } catch (error) {
        console.error('💥 Socket setup error:', error);
        setError(`Socket setup failed: ${error instanceof Error ? error.message : String(error)}`);
        setIsCreating(false);
        cleanup();
        if (socket && socket.connected) {
          socket.disconnect();
        }
      }

    } catch (error) {
      console.error('💥 Error creating room:', error);
      setError(`Error creating room: ${error instanceof Error ? error.message : String(error)}`);
      setIsCreating(false);
    }
  };

  const handleCopyShareUrl = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      // Fallback: Show the text in a prompt for manual copying
      const confirmed = window.confirm(
        `Unable to copy automatically. Here's the share URL to copy manually:\n\n${shareUrl}\n\nClick OK to select the text, then press Ctrl+C to copy.`
      );
      if (confirmed) {
        // Create a temporary input to select the text
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        tempInput.style.position = 'fixed';
        tempInput.style.left = '-9999px';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        alert('Text selected! Press Ctrl+C to copy, then paste where needed.');
      }
    }
  };

  const handleCopyPasscode = async () => {
    const success = await copyToClipboard(passcode);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      // Fallback: Show the text in a prompt for manual copying
      const confirmed = window.confirm(
        `Unable to copy automatically. Here's the passcode to copy manually:\n\n${passcode}\n\nClick OK to select the text, then press Ctrl+C to copy.`
      );
      if (confirmed) {
        // Create a temporary input to select the text
        const tempInput = document.createElement('input');
        tempInput.value = passcode;
        tempInput.style.position = 'fixed';
        tempInput.style.left = '-9999px';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        alert('Text selected! Press Ctrl+C to copy, then paste where needed.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    router.push('/');
  };

  const createRoomViaAPI = async (token: string, userName: string) => {
    console.log('🔄 Trying fallback: Creating room via HTTP API...');
    
    try {
      const response = await fetch('/api/rooms/create-fallback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userName: userName,
          passcode: generatePasscode()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎉 Room created via API:', data);
        setRoomId(data.roomId);
        setPasscode(data.passcode);
        setShareUrl(data.shareUrl);
        setShowRoomInfo(true);
        setIsCreating(false);
      } else {
        const errorData = await response.json();
        console.error('❌ API room creation failed:', errorData);
        setError(`Room creation failed: ${errorData.message}`);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('❌ API room creation error:', error);
      setError(t('error.server'));
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Or a loading spinner
  }

  return (
    <>
      <div className="min-h-screen d-flex align-items-center justify-content-center p-4" style={{ marginTop: '20vh' }}>
        <div className="glass-morphism p-5" style={{ maxWidth: '500px', width: '100%' }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="text-center flex-grow-1">
              <h1 className="h4 mb-1">
                <i className="bi bi-plus-circle-fill text-primary me-2"></i>
                {t('createRoom.formTitle')}
              </h1>
              <small className="text-secondary">{t('createRoom.welcome')}, {userName}!</small>
            </div>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={handleLogout}
              title={t('createRoom.logout')}
            >
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </div>

          {!showRoomInfo ? (
            <div>
              {error && (
                <div className="alert alert-danger mb-3">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="userName" className="form-label">{t('createRoom.nameLabel')}</label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  id="userName"
                  value={userName}
                  onChange={(e) => {
                    setUserName(e.target.value);
                    setError(''); // Clear error when user types
                  }}
                  placeholder={t('createRoom.namePlaceholder')}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                />
              </div>

              <button
                className="btn btn-primary btn-lg w-100 gradient-bg border-0"
                onClick={handleCreateRoom}
                disabled={isCreating || !userName.trim()}
              >
                {isCreating ? (
                  <>
                    <span className="connecting-spinner me-2"></span>
                    Preparing your room...
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-circle me-2"></i>
                    {t('createRoom.submitButton')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="alert alert-success mb-4">
                <i className="bi bi-check-circle-fill me-2"></i>
                {t('createRoom.success')}
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">{t('createRoom.roomId')}</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control form-control-lg text-center"
                    value={roomId}
                    readOnly
                  />
                  <button
                    className="btn btn-outline-secondary"
                    onClick={handleCopyShareUrl}
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">{t('createRoom.passcode')}</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control form-control-lg text-center"
                    value={passcode}
                    readOnly
                  />
                  <button
                    className="btn btn-outline-secondary"
                    onClick={handleCopyPasscode}
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">{t('createRoom.shareLink')}</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={shareUrl}
                    readOnly
                  />
                  <button
                    className="btn btn-outline-secondary"
                    onClick={handleCopyShareUrl}
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              {copySuccess && (
                <div className="alert alert-info">
                  <i className="bi bi-clipboard-check me-2"></i>
                  {t('createRoom.copied')}
                </div>
              )}

              <p className="text-secondary">
                {t('createRoom.shareInstructions')}
              </p>

              <div className="mt-4">
                <button
                  className="btn btn-outline-primary"
                  onClick={() => {
                    setShowRoomInfo(false);
                    setRoomId('');
                    setPasscode('');
                    setShareUrl('');
                  }}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  {t('createRoom.createAnother')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}