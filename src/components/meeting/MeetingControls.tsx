import React from 'react';
import { MeetingControls as MeetingControlsState, MeetingCallbacks } from '@/types';

interface MeetingControlsProps extends MeetingControlsState, MeetingCallbacks {}

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
    <div className="meeting-controls meeting-container" style={{ 
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 'var(--space-md)'
    }}>
      <button 
        onClick={onToggleMute}
        className={`meeting-button ${isMuted ? 'meeting-button-danger' : 'meeting-button-success'}`}
        title={isMuted ? 'Unmute' : 'Mute'}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <i className={`bi ${isMuted ? 'bi-mic-mute' : 'bi-mic'} meeting-icon`}></i>
        {isMuted ? 'Unmute' : 'Mute'}
      </button>

      <button 
        onClick={onToggleVideo}
        className={`meeting-button ${isVideoOff ? 'meeting-button-danger' : 'meeting-button-success'}`}
        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
        aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
      >
        <i className={`bi ${isVideoOff ? 'bi-camera-video-off' : 'bi-camera-video'} meeting-icon`}></i>
        {isVideoOff ? 'Camera On' : 'Camera Off'}
      </button>

      <button 
        onClick={onToggleChat}
        className="meeting-button meeting-button-primary"
        title="Toggle Chat"
        aria-label="Toggle chat panel"
      >
        <i className="bi bi-chat-dots meeting-icon"></i>
        Chat
      </button>

      <button 
        onClick={onToggleParticipants}
        className="meeting-button meeting-button-primary"
        title="Toggle Participants"
        aria-label="Toggle participants panel"
      >
        <i className="bi bi-people meeting-icon"></i>
        Participants
      </button>

      <button 
        onClick={onLeaveMeeting}
        className="meeting-button meeting-button-danger"
        title="Leave Meeting"
        aria-label="Leave meeting"
        style={{ marginLeft: 'var(--space-xl)' }}
      >
        <i className="bi bi-telephone-x meeting-icon"></i>
        Leave
      </button>
    </div>
  );
}