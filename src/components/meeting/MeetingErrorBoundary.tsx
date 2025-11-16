import React from 'react';
import { MeetingError, ErrorRecovery } from '@/types';

interface MeetingErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: MeetingError, recovery: ErrorRecovery) => React.ReactNode;
  onError?: (error: MeetingError) => void;
}

interface MeetingErrorBoundaryState {
  hasError: boolean;
  error: MeetingError | null;
}

export default class MeetingErrorBoundary extends React.Component<
  MeetingErrorBoundaryProps,
  MeetingErrorBoundaryState
> {
  constructor(props: MeetingErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): MeetingErrorBoundaryState {
    const meetingError: MeetingError = {
      hasError: true,
      error,
      errorMessage: error.message || 'An unexpected error occurred',
      errorType: 'UNKNOWN_ERROR',
      canRetry: true,
    };

    return {
      hasError: true,
      error: meetingError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const meetingError: MeetingError = {
      hasError: true,
      error,
      errorMessage: error.message || 'An unexpected error occurred',
      errorType: 'UNKNOWN_ERROR',
      canRetry: true,
      context: errorInfo.componentStack || undefined,
    };

    this.setState({ error: meetingError });

    // Log to console for debugging
    console.error('Meeting Error Boundary caught an error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(meetingError);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    
    // Reload the page to reset meeting state
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error;
      const recovery: ErrorRecovery = {
        canRetry: error.canRetry,
        canReset: true,
        canContinue: false,
        retryAction: this.handleRetry,
        resetAction: this.handleReset,
      };

      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback(error, recovery)}</>;
      }

      // Default error UI
      return (
        <div className="meeting-error-boundary" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-lg)',
          background: 'var(--meeting-bg)',
          color: 'var(--meeting-text)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          minHeight: '200px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ color: 'var(--meeting-danger)' }}></i>
          </div>
          
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>Something went wrong</h3>
          
          <p className="meeting-text-secondary" style={{ marginBottom: 'var(--space-md)', maxWidth: '400px' }}>
            {error.errorMessage}
          </p>

          {error.errorType && (
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-md)',
              fontSize: '12px'
            }}>
              Error Type: {error.errorType}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
            {recovery.canRetry && (
              <button 
                onClick={recovery.retryAction}
                className="meeting-button meeting-button-primary"
              >
                <i className="bi bi-arrow-clockwise meeting-icon"></i>
                Try Again
              </button>
            )}
            
            {recovery.canReset && (
              <button 
                onClick={recovery.resetAction}
                className="meeting-button meeting-button-warning"
              >
                <i className="bi bi-arrow-repeat meeting-icon"></i>
                Reset Meeting
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}