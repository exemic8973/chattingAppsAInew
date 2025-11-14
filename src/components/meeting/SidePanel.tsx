'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Message } from '@/types';
import { formatTime } from '@/lib/utils';

interface SidePanelProps {
  messages: Message[];
  participants: User[];
  currentUserName: string;
  currentUserId: string;
  isHost: boolean;
  newMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onClose?: () => void;
}

export default function SidePanel({
  messages,
  participants,
  currentUserName,
  currentUserId,
  isHost,
  newMessage,
  onMessageChange,
  onSendMessage,
  onClose
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className="side-panel d-flex flex-column"
      style={{
        width: '360px',
        height: '100%',
        background: '#1f1f1f',
        borderLeft: '1px solid #3a3a3a',
        color: '#fff'
      }}
    >
      {/* Header with tabs */}
      <div
        className="side-panel-header"
        style={{
          borderBottom: '1px solid #3a3a3a'
        }}
      >
        <div className="d-flex align-items-center justify-content-between px-3 py-2">
          <div className="d-flex gap-3">
            <button
              className={`btn btn-sm ${activeTab === 'chat' ? 'btn-primary' : 'btn-link text-secondary'}`}
              onClick={() => setActiveTab('chat')}
              style={{
                border: 'none',
                borderBottom: activeTab === 'chat' ? '2px solid #0078d4' : 'none',
                borderRadius: 0,
                paddingBottom: '8px'
              }}
            >
              <i className="bi bi-chat-dots-fill me-2"></i>
              Chat
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'participants' ? 'btn-primary' : 'btn-link text-secondary'}`}
              onClick={() => setActiveTab('participants')}
              style={{
                border: 'none',
                borderBottom: activeTab === 'participants' ? '2px solid #0078d4' : 'none',
                borderRadius: 0,
                paddingBottom: '8px'
              }}
            >
              <i className="bi bi-people-fill me-2"></i>
              People ({1 + participants.length})
            </button>
          </div>
          {onClose && (
            <button
              className="btn btn-sm btn-link text-secondary"
              onClick={onClose}
              style={{ border: 'none' }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="side-panel-content flex-grow-1" style={{ overflow: 'hidden' }}>
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="d-flex flex-column h-100">
            {/* Messages area */}
            <div
              className="flex-grow-1 px-3 py-3"
              style={{
                overflowY: 'auto',
                maxHeight: 'calc(100% - 70px)'
              }}
            >
              {messages.length === 0 ? (
                <div className="text-center text-secondary py-4">
                  <i className="bi bi-chat-dots fs-1 mb-2 d-block"></i>
                  <p className="small">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.userId === currentUserId || message.userName === currentUserName;
                  return (
                    <div
                      key={`${message.id}-${index}`}
                      className={`mb-3 ${isOwn ? 'text-end' : 'text-start'}`}
                    >
                      <div
                        className={`d-inline-block px-3 py-2 rounded ${
                          isOwn
                            ? 'bg-primary text-white'
                            : 'bg-secondary bg-opacity-25 text-white'
                        }`}
                        style={{
                          maxWidth: '85%',
                          wordWrap: 'break-word'
                        }}
                      >
                        {!isOwn && (
                          <div className="small fw-bold mb-1" style={{ opacity: 0.9 }}>
                            {message.userName}
                          </div>
                        )}
                        <div style={{ fontSize: '0.95rem' }}>{message.content}</div>
                        <div className="small mt-1" style={{ opacity: 0.6, fontSize: '0.75rem' }}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div
              className="px-3 py-3"
              style={{
                borderTop: '1px solid #3a3a3a',
                background: '#1a1a1a'
              }}
            >
              <div className="input-group">
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary"
                  value={newMessage}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
                  style={{ fontSize: '0.9rem' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={onSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <i className="bi bi-send-fill"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div className="px-3 py-3" style={{ overflowY: 'auto', height: '100%' }}>
            <div className="mb-3">
              <h6 className="text-secondary small mb-2">IN THIS MEETING</h6>

              {/* Current user */}
              <div
                className="participant-item d-flex align-items-center gap-3 p-2 rounded mb-2"
                style={{
                  background: '#2a2a2a',
                  transition: 'background 0.2s ease'
                }}
              >
                <div
                  className="avatar-sm bg-primary rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: '36px',
                    height: '36px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  }}
                >
                  {currentUserName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-grow-1">
                  <div className="fw-medium">{currentUserName}</div>
                  <small className="text-secondary">You</small>
                </div>
                {isHost && (
                  <span
                    className="badge"
                    style={{
                      background: '#ffd700',
                      color: '#000',
                      fontSize: '0.7rem'
                    }}
                  >
                    HOST
                  </span>
                )}
              </div>

              {/* Other participants */}
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="participant-item d-flex align-items-center gap-3 p-2 rounded mb-2"
                  style={{
                    background: '#2a2a2a',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                >
                  <div
                    className="avatar-sm bg-primary rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '36px',
                      height: '36px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                  >
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-grow-1">
                    <div className="fw-medium">{participant.name}</div>
                  </div>
                  {participant.isHost && (
                    <span
                      className="badge"
                      style={{
                        background: '#ffd700',
                        color: '#000',
                        fontSize: '0.7rem'
                      }}
                    >
                      HOST
                    </span>
                  )}
                </div>
              ))}

              {participants.length === 0 && (
                <div className="text-center text-secondary py-4">
                  <i className="bi bi-person-plus fs-1 mb-2 d-block"></i>
                  <p className="small">No other participants yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
