'use client';

import { useState } from 'react';

interface MeetingControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeaveMeeting: () => void;
  onShareScreen?: () => void;
  showMoreOptions?: boolean;
}

export default function MeetingControls({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onToggleChat,
  onToggleParticipants,
  onLeaveMeeting,
  onShareScreen,
  showMoreOptions = false
}: MeetingControlsProps) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div
      className="meeting-controls d-flex align-items-center justify-content-center gap-3 px-4"
      style={{
        height: '80px',
        background: '#1f1f1f',
        borderTop: '1px solid #3a3a3a',
        position: 'relative'
      }}
    >
      {/* Microphone */}
      <div className="control-item d-flex flex-column align-items-center">
        <button
          className={`control-btn rounded-circle ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
          onClick={onToggleMute}
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            border: 'none',
            transition: 'all 0.2s ease'
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <i className={`bi ${isMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`}></i>
        </button>
        <small className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
          {isMuted ? 'Unmute' : 'Mute'}
        </small>
      </div>

      {/* Camera */}
      <div className="control-item d-flex flex-column align-items-center">
        <button
          className={`control-btn rounded-circle ${isVideoOff ? 'btn-danger' : 'btn-secondary'}`}
          onClick={onToggleVideo}
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            border: 'none',
            transition: 'all 0.2s ease'
          }}
          title={isVideoOff ? 'Start video' : 'Stop video'}
        >
          <i className={`bi ${isVideoOff ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}`}></i>
        </button>
        <small className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
          {isVideoOff ? 'Camera' : 'Camera'}
        </small>
      </div>

      {/* Share Screen */}
      {onShareScreen && (
        <div className="control-item d-flex flex-column align-items-center">
          <button
            className="control-btn rounded-circle btn-secondary"
            onClick={onShareScreen}
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              border: 'none',
              transition: 'all 0.2s ease'
            }}
            title="Share screen"
          >
            <i className="bi bi-laptop"></i>
          </button>
          <small className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
            Share
          </small>
        </div>
      )}

      {/* Chat */}
      <div className="control-item d-flex flex-column align-items-center">
        <button
          className="control-btn rounded-circle btn-secondary"
          onClick={onToggleChat}
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            border: 'none',
            transition: 'all 0.2s ease'
          }}
          title="Toggle chat"
        >
          <i className="bi bi-chat-dots-fill"></i>
        </button>
        <small className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
          Chat
        </small>
      </div>

      {/* Participants */}
      <div className="control-item d-flex flex-column align-items-center">
        <button
          className="control-btn rounded-circle btn-secondary"
          onClick={onToggleParticipants}
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            border: 'none',
            transition: 'all 0.2s ease'
          }}
          title="Toggle participants"
        >
          <i className="bi bi-people-fill"></i>
        </button>
        <small className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
          People
        </small>
      </div>

      {/* More options */}
      {showMoreOptions && (
        <div className="control-item d-flex flex-column align-items-center position-relative">
          <button
            className="control-btn rounded-circle btn-secondary"
            onClick={() => setShowOptions(!showOptions)}
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              border: 'none',
              transition: 'all 0.2s ease'
            }}
            title="More options"
          >
            <i className="bi bi-three-dots"></i>
          </button>
          <small className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
            More
          </small>

          {/* Options dropdown */}
          {showOptions && (
            <div
              className="position-absolute bottom-100 mb-2 bg-dark rounded shadow-lg p-2"
              style={{ minWidth: '180px' }}
            >
              <button className="btn btn-sm btn-dark w-100 text-start mb-1">
                <i className="bi bi-gear me-2"></i>
                Settings
              </button>
              <button className="btn btn-sm btn-dark w-100 text-start">
                <i className="bi bi-info-circle me-2"></i>
                Meeting Info
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leave Meeting (Red button) */}
      <div className="control-item d-flex flex-column align-items-center ms-3">
        <button
          className="control-btn rounded-circle btn-danger"
          onClick={onLeaveMeeting}
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            border: 'none',
            transition: 'all 0.2s ease'
          }}
          title="Leave meeting"
        >
          <i className="bi bi-telephone-x-fill"></i>
        </button>
        <small className="text-danger mt-1" style={{ fontSize: '0.7rem' }}>
          Leave
        </small>
      </div>
    </div>
  );
}
