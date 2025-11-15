import React from 'react';
import { User, Message } from '@/types';

interface SidePanelProps {
  messages: Message[];
  participants: User[];
  currentUserName: string;
  currentUserId: string;
  isHost: boolean;
  newMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onMuteParticipant: (userId: string) => void;
  hostMutedUsers: Set<string>;
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
  hostMutedUsers 
}: SidePanelProps) {
  const [activeTab, setActiveTab] = React.useState<'chat' | 'participants'>('chat');

  return (
    <div className="side-panel" style={{ 
      background: 'white', 
      color: 'black',
      borderLeft: '1px solid var(--meeting-border)', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      width: '300px',
      borderRadius: 0,
      boxShadow: 'none'
    }}>
      {/* Tab Navigation */}
      <div className="side-panel-tabs" style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--meeting-border)' 
      }}>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`tab-button meeting-button ${activeTab === 'chat' ? 'meeting-button-primary' : ''}`}
          style={{ 
            flex: 1, 
            border: 'none', 
            background: activeTab === 'chat' ? 'var(--meeting-accent)' : 'transparent',
            color: activeTab === 'chat' ? 'white' : 'black',
            borderRadius: 0
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
            color: activeTab === 'participants' ? 'white' : 'black',
            borderRadius: 0
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
          flexDirection: 'column' 
        }}>
          <div className="messages-container" style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: 'var(--space-sm)' 
          }}>
            {messages.map((message) => (
              <div key={message.id} className="message" style={{ 
                marginBottom: 'var(--space-sm)', 
                padding: 'var(--space-sm)', 
                background: message.userName === currentUserName ? '#e3f2fd' : '#f5f5f5',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div className="message-header" style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold', 
                  marginBottom: 'var(--space-xs)' 
                }}>
                  {message.userName}
                </div>
                <div className="message-content" style={{ fontSize: '14px' }}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
          <div className="message-input" style={{ 
            padding: 'var(--space-sm)', 
            borderTop: '1px solid var(--meeting-border)' 
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder="Type a message..."
                style={{ 
                  flex: 1, 
                  padding: 'var(--space-sm)', 
                  border: '1px solid var(--meeting-border)', 
                  borderRadius: 'var(--radius-sm)'
                }}
                onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
                aria-label="Message input"
              />
              <button 
                onClick={onSendMessage}
                className="meeting-button meeting-button-primary"
                aria-label="Send message"
              >
                <i className="bi bi-send meeting-icon"></i>
                Send
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
                <button 
                  onClick={() => onMuteParticipant(participant.id)}
                  className={`meeting-button meeting-button-${hostMutedUsers.has(participant.id) ? 'success' : 'warning'}`}
                  style={{ fontSize: '12px' }}
                  aria-label={`${hostMutedUsers.has(participant.id) ? 'Unmute' : 'Mute'} ${participant.name}`}
                >
                  <i className={`bi ${hostMutedUsers.has(participant.id) ? 'bi-mic' : 'bi-mic-mute'} meeting-icon`}></i>
                  {hostMutedUsers.has(participant.id) ? 'Unmute' : 'Mute'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}