'use client';

import { useState, useEffect } from 'react';
import { copyToClipboard } from '@/lib/utils';

interface MeetingHeaderProps {
  roomId: string;
  participantCount: number;
  onLeave?: () => void;
}

export default function MeetingHeader({ roomId, participantCount, onLeave }: MeetingHeaderProps) {
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [startTime] = useState(Date.now());
  const [showCopied, setShowCopied] = useState(false);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const handleCopyLink = () => {
    const meetingLink = `${window.location.origin}/room/${roomId}`;
    copyToClipboard(meetingLink);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  return (
    <div
      className="meeting-header d-flex align-items-center justify-content-between px-4"
      style={{
        height: '60px',
        background: '#1f1f1f',
        borderBottom: '1px solid #3a3a3a',
        color: '#fff'
      }}
    >
      {/* Left section - Meeting info */}
      <div className="d-flex align-items-center gap-3">
        <div>
          <h6 className="mb-0 fw-bold">{roomId}</h6>
          <small className="text-secondary">
            <i className="bi bi-people-fill me-1"></i>
            {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
          </small>
        </div>
        <span className="text-secondary">|</span>
        <div className="text-secondary">
          <i className="bi bi-clock me-1"></i>
          {elapsedTime}
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="d-flex align-items-center gap-2">
        {/* Copy link button */}
        <div className="position-relative">
          <button
            className="btn btn-sm btn-outline-light"
            onClick={handleCopyLink}
            style={{ borderRadius: '20px' }}
          >
            <i className="bi bi-link-45deg me-1"></i>
            Copy Link
          </button>
          {showCopied && (
            <div
              className="position-absolute top-100 start-50 translate-middle-x mt-2 badge bg-success"
              style={{ fontSize: '0.75rem' }}
            >
              ✓ Copied!
            </div>
          )}
        </div>

        {/* Leave button */}
        {onLeave && (
          <button
            className="btn btn-sm btn-danger"
            onClick={onLeave}
            style={{ borderRadius: '20px' }}
          >
            <i className="bi bi-door-open me-1"></i>
            Leave
          </button>
        )}
      </div>
    </div>
  );
}
