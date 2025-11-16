import React from 'react';
import { LoadingState as LoadingStateType } from '@/types';

interface LoadingStateProps extends LoadingStateType {
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<{ size: string }> = ({ size }) => (
  <div 
    className="loading-spinner" 
    style={{
      width: size,
      height: size,
      border: '3px solid rgba(255,255,255,0.3)',
      borderTop: '3px solid var(--meeting-accent)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}
  />
);

const LoadingDots: React.FC<{ size: string }> = ({ size }) => (
  <div className="loading-dots" style={{ display: 'flex', gap: '8px' }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: size,
          height: size,
          background: 'var(--meeting-accent)',
          borderRadius: '50%',
          animation: `bounce 1.4s infinite ease-in-out both`,
          animationDelay: `${i * 0.16}s`
        }}
      />
    ))}
  </div>
);

const LoadingPulse: React.FC<{ size: string }> = ({ size }) => (
  <div 
    className="loading-pulse"
    style={{
      width: size,
      height: size,
      background: 'var(--meeting-accent)',
      borderRadius: 'var(--radius-sm)',
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    }}
  />
);

const LoadingBars: React.FC<{ size: string }> = ({ size }) => (
  <div className="loading-bars" style={{ display: 'flex', gap: '4px', alignItems: 'end' }}>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          width: parseInt(size) / 4 + 'px',
          height: size,
          background: 'var(--meeting-accent)',
          borderRadius: '2px',
          animation: `wave 1.2s infinite ease-in-out`,
          animationDelay: `${i * 0.12}s`
        }}
      />
    ))}
  </div>
);

export default function LoadingState({ 
  isLoading, 
  loadingMessage, 
  loadingProgress,
  variant = 'spinner',
  size = 'md',
  className 
}: LoadingStateProps) {
  if (!isLoading) return null;

  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '32px'
  };

  const sizeValue = sizeMap[size];

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return <LoadingDots size={sizeValue} />;
      case 'pulse':
        return <LoadingPulse size={sizeValue} />;
      case 'bars':
        return <LoadingBars size={sizeValue} />;
      case 'spinner':
      default:
        return <LoadingSpinner size={sizeValue} />;
    }
  };

  return (
    <div 
      className={`loading-state ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg)',
        gap: 'var(--space-md)',
        background: 'var(--meeting-bg)',
        color: 'var(--meeting-text)',
        borderRadius: 'var(--radius-md)',
        minHeight: '120px'
      }}
    >
      {renderLoader()}
      
      {loadingMessage && (
        <div style={{ 
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 500
        }}>
          {loadingMessage}
        </div>
      )}

      {loadingProgress !== undefined && (
        <div style={{ width: '100%', maxWidth: '200px' }}>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${loadingProgress}%`,
              height: '100%',
              background: 'var(--meeting-accent)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '12px',
            marginTop: 'var(--space-xs)',
            opacity: 0.8
          }}>
            {loadingProgress}%
          </div>
        </div>
      )}
    </div>
  );
}