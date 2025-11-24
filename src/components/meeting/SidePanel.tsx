import React from 'react';
import { ChatState, ParticipantManagement } from '@/types';

interface SidePanelProps extends ChatState, ParticipantManagement {
  onMuteParticipant: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  hostMutedUsers: Set<string>;
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
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
  onMuteParticipant,
  onRemoveParticipant,
  hostMutedUsers,
  messagesEndRef
}: SidePanelProps) {
  const [activeTab, setActiveTab] = React.useState<'chat' | 'participants'>('chat');

  return (
    <div className="side-panel" style={{
      background: 'var(--meeting-bg)',
      color: 'var(--meeting-text)',
      borderLeft: '1px solid var(--meeting-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '320px', // Slightly wider
      flexShrink: 0, // Prevent shrinking
      zIndex: 50, // Ensure on top
      borderRadius: 0,
      boxShadow: '-2px 0 10px rgba(0,0,0,0.2)'
    }}>
      {/* Tab Navigation */}
      <div className="side-panel-tabs" style={{
        display: 'flex',
        borderBottom: '1px solid var(--meeting-border)',
        flexShrink: 0 // Don't shrink tabs
      }}>
        <button
          onClick={() => setActiveTab('chat')}
          className={`tab-button meeting-button ${activeTab === 'chat' ? 'meeting-button-primary' : ''}`}
          style={{
            flex: 1,
            border: 'none',
            background: activeTab === 'chat' ? 'var(--meeting-accent)' : 'transparent',
            color: 'var(--meeting-text)',
            borderRadius: 0,
            opacity: activeTab === 'chat' ? 1 : 0.7,
            justifyContent: 'center'
          }}
          aria-label="Chat tab"
        >
          <i className="bi bi-chat-dots meeting-icon"></i>
          Chat
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`tab-button meeting-button ${activeTab === 'participants' ? 'meeting-button-primary' : ''}`}
          style={{
            flex: 1,
            border: 'none',
            background: activeTab === 'participants' ? 'var(--meeting-accent)' : 'transparent',
            color: 'var(--meeting-text)',
            borderRadius: 0,
            opacity: activeTab === 'participants' ? 1 : 0.7,
            justifyContent: 'center'
          }}
          aria-label="Participants tab"
        >
          <i className="bi bi-people meeting-icon"></i>
          {participants.length}
        </button>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="chat-section" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%', // Ensure full height
          overflow: 'hidden' // Contain overflow
        }}>
          <div className="messages-container" style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-sm)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: 'var(--meeting-text-secondary)',
                marginTop: 'var(--space-xl)'
              }}>
                No messages yet
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className="message" style={{
                marginBottom: 'var(--space-sm)',
                padding: 'var(--space-sm)',
                background: message.userName === currentUserName ? 'var(--meeting-accent)' : 'rgba(255,255,255,0.1)',
                color: 'var(--meeting-text)',
                borderRadius: 'var(--radius-sm)',
                alignSelf: message.userName === currentUserName ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                wordBreak: 'break-word'
              }}>
                <div className="message-header" style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: 'var(--space-xs)',
                  opacity: 0.8
                }}>
                  {message.userName}
                </div>
                <div className="message-content" style={{ fontSize: '14px' }}>
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="message-input" style={{
            padding: 'var(--space-md)',
            borderTop: '1px solid var(--meeting-border)',
            background: 'var(--meeting-bg)',
            flexShrink: 0 // Ensure input area doesn't shrink
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onMessageChange(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid var(--meeting-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--meeting-text)',
                  outline: 'none'
                }}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onSendMessage()}
                aria-label="Message input"
              />
              <button
                onClick={onSendMessage}
                className="meeting-button meeting-button-primary"
                aria-label="Send message"
                style={{
                  padding: '0 20px',
                  justifyContent: 'center'
                }}
              >
                <i className="bi bi-send meeting-icon"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants Tab */}
      {activeTab === 'participants' && (
        <div className="participants-section" style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-sm)'
        }}>
          {participants.map((participant) => (
            <div key={participant.id} className="participant" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-sm)',
              borderBottom: '1px solid var(--meeting-border)'
            }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {participant.name}
                  {participant.isHost && <i className="bi bi-star-fill" style={{ color: 'var(--meeting-warning)', marginLeft: 'var(--space-xs)' }}></i>}
                </div>
                <div className="meeting-text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                  <i className={`bi ${hostMutedUsers.has(participant.id) ? 'bi-mic-mute' : 'bi-mic'} `}></i>
                  {hostMutedUsers.has(participant.id) ? 'Muted by host' : 'Active'}
                </div>
              </div>
              {isHost && (
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <button
                    onClick={() => onMuteParticipant(participant.id)}
                    className={`meeting-button meeting-button-${hostMutedUsers.has(participant.id) ? 'success' : 'warning'}`}
                    style={{ fontSize: '12px' }}
                    aria-label={`${hostMutedUsers.has(participant.id) ? 'Unmute' : 'Mute'} ${participant.name}`}
                  >
                    <i className={`bi ${hostMutedUsers.has(participant.id) ? 'bi-mic' : 'bi-mic-mute'} meeting-icon`}></i>
                    {hostMutedUsers.has(participant.id) ? 'Unmute' : 'Mute'}
                  </button>
                  {!participant.isHost && onRemoveParticipant && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove ${participant.name} from the meeting?`)) {
                          onRemoveParticipant(participant.id);
                        }
                      }}
                      className="meeting-button meeting-button-danger"
                      style={{ fontSize: '12px' }}
                      aria-label={`Remove ${participant.name} from meeting`}
                    >
                      <i className="bi bi-person-x meeting-icon"></i>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}