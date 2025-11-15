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
      borderLeft: '1px solid #ddd', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      width: '300px'
    }}>
      {/* Tab Navigation */}
      <div className="side-panel-tabs" style={{ 
        display: 'flex', 
        borderBottom: '1px solid #ddd' 
      }}>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          style={{ 
            flex: 1, 
            padding: '10px', 
            border: 'none', 
            background: activeTab === 'chat' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'chat' ? 'white' : 'black',
            cursor: 'pointer'
          }}
        >
          Chat
        </button>
        <button 
          onClick={() => setActiveTab('participants')}
          className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
          style={{ 
            flex: 1, 
            padding: '10px', 
            border: 'none', 
            background: activeTab === 'participants' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'participants' ? 'white' : 'black',
            cursor: 'pointer'
          }}
        >
          Participants ({participants.length})
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
            padding: '10px' 
          }}>
            {messages.map((message) => (
              <div key={message.id} className="message" style={{ 
                marginBottom: '10px', 
                padding: '8px', 
                background: message.userName === currentUserName ? '#e3f2fd' : '#f5f5f5',
                borderRadius: '8px'
              }}>
                <div className="message-header" style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold', 
                  marginBottom: '4px' 
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
            padding: '10px', 
            borderTop: '1px solid #ddd' 
          }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder="Type a message..."
                style={{ 
                  flex: 1, 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px' 
                }}
                onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
              />
              <button 
                onClick={onSendMessage}
                className="btn btn-primary"
                style={{ padding: '8px 16px' }}
              >
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
          padding: '10px' 
        }}>
          {participants.map((participant) => (
            <div key={participant.id} className="participant" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '8px', 
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {participant.name} {participant.isHost && '👑'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {hostMutedUsers.has(participant.id) ? '🔇 Muted by host' : '🎤 Active'}
                </div>
              </div>
              {isHost && (
                <button 
                  onClick={() => onMuteParticipant(participant.id)}
                  className="btn btn-sm btn-warning"
                  style={{ fontSize: '12px' }}
                >
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