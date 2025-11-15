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
    <div className="meeting-header" style={{ 
      background: '#1a1a1a', 
      color: 'white', 
      padding: '10px 20px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center' 
    }}>
      <div className="meeting-info">
        <h5 style={{ margin: 0, fontSize: '16px' }}>Meeting: {roomId}</h5>
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
          {participantCount} participants | Passcode: {passcode}
        </p>
      </div>
      <div className="meeting-controls">
        <button 
          onClick={onLeave}
          className="btn btn-danger"
          style={{ fontSize: '14px', padding: '5px 15px' }}
        >
          Leave Meeting
        </button>
      </div>
    </div>
  );
}