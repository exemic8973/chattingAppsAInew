import React from 'react';

interface MeetingHeaderProps {
  roomId: string;
  participantCount: number;
  passcode: string;
  isHost: boolean;
  onLeave: () => void;
}

export default function MeetingHeader({ roomId, participantCount, passcode, isHost, onLeave }: MeetingHeaderProps) {
  return (
    <div className="meeting-header meeting-container" style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: 'var(--space-sm) var(--space-lg)'
    }}>
      <div className="meeting-info">
        <h5 style={{ 
          margin: 0, 
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--meeting-text)'
        }}>
          Meeting: {roomId}
        </h5>
        <div className="meeting-text-secondary" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-sm)',
          marginTop: 'var(--space-xs)'
        }}>
          <span><i className="bi bi-people"></i> {participantCount}</span>
          <span>•</span>
          <span><i className="bi bi-lock"></i> {passcode}</span>
          {isHost && (
            <>
              <span>•</span>
              <span><i className="bi bi-star-fill" style={{ color: 'var(--meeting-warning)' }}></i> Host</span>
            </>
          )}
        </div>
      </div>
      <div className="meeting-controls">
        <button 
          onClick={onLeave}
          className="meeting-button meeting-button-danger"
          aria-label="Leave meeting"
        >
          <i className="bi bi-box-arrow-right meeting-icon"></i>
          Leave Meeting
        </button>
      </div>
    </div>
  );
}