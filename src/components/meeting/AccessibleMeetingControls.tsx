import React, { useState, useCallback, useRef } from 'react';
import { MeetingControls as MeetingControlsState, MeetingCallbacks } from '@/types';
import { useAnnouncer, useKeyboardNavigation, announceMeetingState } from '@/lib/accessibility';

interface AccessibleMeetingControlsProps extends MeetingControlsState, MeetingCallbacks {
  meetingId?: string;
  isScreenReaderOptimized?: boolean;
}

export default function AccessibleMeetingControls({ 
  isMuted, 
  isVideoOff, 
  onToggleMute, 
  onToggleVideo, 
  onToggleChat, 
  onToggleParticipants, 
  onLeaveMeeting,
  meetingId,
  isScreenReaderOptimized = true
}: AccessibleMeetingControlsProps) {
  const [focusedButton, setFocusedButton] = useState<string | null>(null);
  const { announce } = useAnnouncer();
  const { handleKeyNavigation } = useKeyboardNavigation();
  const controlsRef = useRef<HTMLDivElement>(null);

  // Announce state changes to screen readers
  const announceStateChange = useCallback((action: string, newState: boolean) => {
    if (!isScreenReaderOptimized) return;
    
    const announcements: Record<string, string> = {
      'mute': newState ? 'Microphone muted' : 'Microphone unmuted',
      'video': newState ? 'Camera turned off' : 'Camera turned on',
      'chat': newState ? 'Chat panel opened' : 'Chat panel closed',
      'participants': newState ? 'Participants panel opened' : 'Participants panel closed',
    };
    
    announce(announcements[action] || `${action} ${newState ? 'enabled' : 'disabled'}`);
  }, [announce, isScreenReaderOptimized]);

  // Enhanced keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, action: () => void, actionType: string) => {
    // Space and Enter both trigger the action
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      action();
    }
    
    // Arrow key navigation between controls
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const buttons = controlsRef.current?.querySelectorAll('button[role="button"]');
      if (buttons) {
        const currentIndex = Array.from(buttons).indexOf(event.currentTarget as HTMLButtonElement);
        const nextIndex = event.key === 'ArrowRight' 
          ? Math.min(currentIndex + 1, buttons.length - 1)
          : Math.max(currentIndex - 1, 0);
        (buttons[nextIndex] as HTMLButtonElement).focus();
      }
    }
  };

  // Enhanced toggle functions with announcements
  const handleToggleMute = () => {
    onToggleMute();
    announceStateChange('mute', !isMuted);
  };

  const handleToggleVideo = () => {
    onToggleVideo();
    announceStateChange('video', !isVideoOff);
  };

  const handleToggleChat = () => {
    onToggleChat();
    announceStateChange('chat', true);
  };

  const handleToggleParticipants = () => {
    onToggleParticipants();
    announceStateChange('participants', true);
  };

  const handleLeaveMeeting = () => {
    if (isScreenReaderOptimized) {
      announce('Leaving meeting');
    }
    onLeaveMeeting();
  };

  // Control button configuration with accessibility attributes
  const controls = [
    {
      id: 'mute-toggle',
      action: handleToggleMute,
      label: isMuted ? 'Unmute microphone' : 'Mute microphone',
      title: isMuted ? 'Unmute' : 'Mute',
      icon: isMuted ? 'bi-mic-mute' : 'bi-mic',
      text: isMuted ? 'Unmute' : 'Mute',
      ariaPressed: isMuted,
      testId: 'mute-button',
      shortcut: 'M'
    },
    {
      id: 'video-toggle',
      action: handleToggleVideo,
      label: isVideoOff ? 'Turn camera on' : 'Turn camera off',
      title: isVideoOff ? 'Camera On' : 'Camera Off',
      icon: isVideoOff ? 'bi-camera-video-off' : 'bi-camera-video',
      text: isVideoOff ? 'Camera On' : 'Camera Off',
      ariaPressed: isVideoOff,
      testId: 'video-button',
      shortcut: 'V'
    },
    {
      id: 'chat-toggle',
      action: handleToggleChat,
      label: 'Toggle chat panel',
      title: 'Toggle Chat',
      icon: 'bi-chat-dots',
      text: 'Chat',
      ariaExpanded: false, // This would be managed by parent component
      testId: 'chat-button',
      shortcut: 'C'
    },
    {
      id: 'participants-toggle',
      action: handleToggleParticipants,
      label: 'Toggle participants panel',
      title: 'Toggle Participants',
      icon: 'bi-people',
      text: 'Participants',
      ariaExpanded: false, // This would be managed by parent component
      testId: 'participants-button',
      shortcut: 'P'
    }
  ];

  return (
    <div 
      ref={controlsRef}
      className="accessible-meeting-controls meeting-container" 
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: 'var(--space-md)'
      }}
      role="toolbar"
      aria-label="Meeting controls"
      aria-describedby="meeting-controls-description"
    >
      {/* Hidden description for screen readers */}
      <div id="meeting-controls-description" className="sr-only" style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }}>
        Use Tab to navigate between controls. Press Space or Enter to activate. 
        Arrow keys navigate between controls. Press {controls.map(c => c.shortcut).join(', ')} for shortcuts.
      </div>

      {controls.map((control, index) => (
        <button
          key={control.id}
          id={control.id}
          onClick={control.action}
          onKeyDown={(e) => handleKeyDown(e, control.action, control.id)}
          onFocus={() => setFocusedButton(control.id)}
          onBlur={() => setFocusedButton(null)}
          className={`meeting-button ${control.id === 'mute-toggle' 
            ? (isMuted ? 'meeting-button-danger' : 'meeting-button-success')
            : control.id === 'video-toggle'
            ? (isVideoOff ? 'meeting-button-danger' : 'meeting-button-success')
            : 'meeting-button-primary'
          }`}
          title={control.title}
          aria-label={control.label}
          aria-pressed={control.ariaPressed}
          aria-expanded={control.ariaExpanded}
          role="button"
          tabIndex={0}
          data-testid={control.testId}
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            border: focusedButton === control.id ? '2px solid var(--meeting-accent)' : 'none',
            outline: 'none',
            position: 'relative'
          }}
        >
          <i className={`bi ${control.icon} meeting-icon`} aria-hidden="true"></i>
          <span>{control.text}</span>
          
          {/* Screen reader only shortcut hint */}
          <span className="sr-only" style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}>
            Shortcut: {control.shortcut}
          </span>
        </button>
      ))}

      {/* Leave Meeting Button - Separated with visual divider */}
      <div role="separator" style={{
        width: '1px',
        height: '24px',
        background: 'var(--meeting-border)',
        margin: '0 var(--space-sm)'
      }} aria-hidden="true"></div>

      <button
        onClick={handleLeaveMeeting}
        onKeyDown={(e) => handleKeyDown(e, handleLeaveMeeting, 'leave-meeting')}
        onFocus={() => setFocusedButton('leave-meeting')}
        onBlur={() => setFocusedButton(null)}
        className="meeting-button meeting-button-danger"
        title="Leave Meeting"
        aria-label="Leave meeting"
        role="button"
        tabIndex={0}
        data-testid="leave-button"
        style={{
          padding: 'var(--space-sm) var(--space-md)',
          border: focusedButton === 'leave-meeting' ? '2px solid var(--meeting-warning)' : 'none',
          outline: 'none'
        }}
      >
        <i className="bi bi-telephone-x meeting-icon" aria-hidden="true"></i>
        Leave
      </button>

      {/* Meeting status for screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        {isMuted ? 'Microphone muted' : 'Microphone active'}, 
        {isVideoOff ? 'Camera off' : 'Camera on'}
        {meetingId && `, Meeting ID: ${meetingId}`}
      </div>
    </div>
  );
}