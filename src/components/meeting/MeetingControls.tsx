import React from 'react';

interface MeetingControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeaveMeeting: () => void;
}

export default function MeetingControls({ 
  isMuted, 
  isVideoOff, 
  onToggleMute, 
  onToggleVideo, 
  onToggleChat, 
  onToggleParticipants, 
  onLeaveMeeting 
}: MeetingControlsProps) {
  return (
    <div className="meeting-controls" style={{ 
      background: '#1a1a1a', 
      color: 'white', 
      padding: '15px', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      gap: '15px',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100
    }}>
      <button 
        onClick={onToggleMute}
        className={`btn ${isMuted ? 'btn-danger' : 'btn-success'}`}
        style={{ padding: '10px 15px', fontSize: '14px' }}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
      </button>

      <button 
        onClick={onToggleVideo}
        className={`btn ${isVideoOff ? 'btn-danger' : 'btn-success'}`}
        style={{ padding: '10px 15px', fontSize: '14px' }}
        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
      >
        {isVideoOff ? '📹' : '📷'} {isVideoOff ? 'Camera On' : 'Camera Off'}
      </button>

      <button 
        onClick={onToggleChat}
        className="btn btn-primary"
        style={{ padding: '10px 15px', fontSize: '14px' }}
        title="Toggle Chat"
      >
        💬 Chat
      </button>

      <button 
        onClick={onToggleParticipants}
        className="btn btn-primary"
        style={{ padding: '10px 15px', fontSize: '14px' }}
        title="Toggle Participants"
      >
        👥 Participants
      </button>

      <button 
        onClick={onLeaveMeeting}
        className="btn btn-danger"
        style={{ padding: '10px 15px', fontSize: '14px', marginLeft: '20px' }}
        title="Leave Meeting"
      >
        📞 Leave
      </button>
    </div>
  );
}