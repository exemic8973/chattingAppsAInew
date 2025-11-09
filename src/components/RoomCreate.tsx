'use client';

import { useState } from 'react';
import { generateRoomId, generatePasscode, generateShareUrl, copyToClipboard } from '@/lib/utils';
import { initializeSocket } from '@/lib/socket';
import { RoomInfo } from '@/types';

interface RoomCreateProps {
  onRoomCreated: (roomInfo: RoomInfo) => void;
}

export default function RoomCreate({ onRoomCreated }: RoomCreateProps) {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsCreating(true);
    
    try {
      const newRoomId = generateRoomId();
      const newPasscode = generatePasscode();
      const socket = initializeSocket();

      socket.emit('create-room', { userName, passcode: newPasscode });

      socket.on('room-created', ({ roomId, passcode, shareUrl }) => {
        setRoomId(roomId);
        setPasscode(passcode);
        setShareUrl(shareUrl);
        setShowRoomInfo(true);
        setIsCreating(false);
        
        onRoomCreated({
          id: roomId,
          passcode,
          shareUrl
        });
      });

      socket.on('error', (error) => {
        alert(error.message);
        setIsCreating(false);
      });
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room');
      setIsCreating(false);
    }
  };

  const handleCopyShareUrl = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyPasscode = async () => {
    const success = await copyToClipboard(passcode);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="min-h-screen d-flex align-items-center justify-content-center p-4">
      <div className="glass-morphism p-5" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="text-center mb-4">
          <h1 className="h2 mb-3">
            <i className="bi bi-chat-dots-fill text-primary me-2"></i>
            Instant Messenger
          </h1>
          <p className="text-secondary">Create a private chat room</p>
        </div>

        {!showRoomInfo ? (
          <div>
            <div className="mb-4">
              <label htmlFor="userName" className="form-label">Your Name</label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
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
                  Creating Room...
                </>
              ) : (
                <>
                  <i className="bi bi-plus-circle me-2"></i>
                  Create Room
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="alert alert-success mb-4">
              <i className="bi bi-check-circle-fill me-2"></i>
              Room Created Successfully!
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold">Room ID</label>
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
              <label className="form-label fw-bold">Passcode</label>
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
              <label className="form-label fw-bold">Share Link</label>
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
                Copied to clipboard!
              </div>
            )}

            <p className="text-secondary">
              Share this link and passcode with your friends to invite them to the room.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}