import React, { useState, useEffect } from 'react';
import { Message, ChatError, LoadingState } from '@/types';
import LoadingStateComponent from './LoadingState';

interface EnhancedChatProps {
  messages: Message[];
  currentUserName: string;
  newMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  isLoading?: boolean;
  error?: ChatError | null;
  onRetryMessage?: (messageId: string) => void;
  maxMessageLength?: number;
}

const MessageItem: React.FC<{
  message: Message;
  isCurrentUser: boolean;
  onRetry?: (messageId: string) => void;
}> = ({ message, isCurrentUser, onRetry }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    if (onRetry && message.id) {
      setIsRetrying(true);
      onRetry(message.id);
      setTimeout(() => setIsRetrying(false), 2000);
    }
  };

  const isFailed = message.type === 'system' && message.content.includes('Failed');

  return (
    <div className={`message ${isFailed ? 'message-failed' : ''}`} style={{ 
      marginBottom: 'var(--space-sm)', 
      padding: 'var(--space-sm)', 
      background: isCurrentUser ? '#e3f2fd' : '#f5f5f5',
      borderRadius: 'var(--radius-sm)',
      border: isFailed ? '1px solid var(--meeting-danger)' : 'none',
      opacity: isRetrying ? 0.6 : 1
    }}>
      <div className="message-header" style={{ 
        fontSize: '12px', 
        fontWeight: 'bold', 
        marginBottom: 'var(--space-xs)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{message.userName}</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="message-content" style={{ fontSize: '14px' }}>
        {message.content}
      </div>

      {isFailed && onRetry && (
        <div style={{ 
          marginTop: 'var(--space-xs)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="meeting-button meeting-button-warning"
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            <i className={`bi ${isRetrying ? 'bi-hourglass-split' : 'bi-arrow-clockwise'} meeting-icon`}></i>
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
};

export default function EnhancedChat({ 
  messages, 
  currentUserName, 
  newMessage, 
  onMessageChange, 
  onSendMessage, 
  isLoading = false,
  error = null,
  onRetryMessage,
  maxMessageLength = 500
}: EnhancedChatProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle character limit
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= maxMessageLength) {
      onMessageChange(value);
      setLocalError(null);
    } else {
      setLocalError(`Message too long (${value.length}/${maxMessageLength})`);
    }
  };

  // Handle send message with validation
  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      setLocalError('Message cannot be empty');
      return;
    }

    if (newMessage.length > maxMessageLength) {
      setLocalError(`Message too long (${newMessage.length}/${maxMessageLength})`);
      return;
    }

    setIsSending(true);
    setLocalError(null);

    try {
      await onSendMessage();
    } catch (error) {
      const chatError: ChatError = {
        hasError: true,
        error: error as Error,
        errorMessage: 'Failed to send message',
        errorType: 'NETWORK_ERROR',
        canRetry: true,
        failedAction: 'send',
      };
      setLocalError(chatError.errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key with validation
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && newMessage.trim()) {
        handleSendMessage();
      }
    }
  };

  if (error && !error.canRetry) {
    return (
      <div className="chat-error-state" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg)',
        background: 'white',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)', color: 'var(--meeting-danger)' }}>
          <i className="bi bi-chat-dots"></i>
        </div>
        <h4>Chat Unavailable</h4>
        <p className="meeting-text-secondary">{error.errorMessage}</p>
        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: 'var(--space-sm)' }}>
          Error: {error.errorType}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-section" style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Messages Container */}
      <div className="messages-container" style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: 'var(--space-sm)',
        minHeight: '200px'
      }}>
        {isLoading && messages.length === 0 ? (
          <LoadingStateComponent
            isLoading={true}
            loadingMessage="Loading messages..."
            variant="dots"
            size="sm"
          />
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            textAlign: 'center'
          }}>
            <i className="bi bi-chat-dots" style={{ fontSize: '32px', marginBottom: 'var(--space-sm)', opacity: 0.5 }}></i>
            <p>No messages yet</p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isCurrentUser={message.userName === currentUserName}
              onRetry={onRetryMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {localError && (
        <div style={{
          padding: 'var(--space-sm)',
          background: 'rgba(220,53,69,0.1)',
          border: '1px solid var(--meeting-danger)',
          borderRadius: 'var(--radius-sm)',
          margin: 'var(--space-sm)',
          fontSize: '12px',
          color: 'var(--meeting-danger)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span><i className="bi bi-exclamation-triangle"></i> {localError}</span>
          <button
            onClick={() => setLocalError(null)}
            className="meeting-button meeting-button-danger"
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            <i className="bi bi-x meeting-icon"></i>
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="message-input" style={{ 
        padding: 'var(--space-sm)', 
        borderTop: '1px solid var(--meeting-border)' 
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input 
              type="text" 
              value={newMessage}
              onChange={handleMessageChange}
              placeholder={isSending ? "Sending..." : "Type a message..."}
              disabled={isSending || !!error}
              style={{ 
                width: '100%',
                padding: 'var(--space-sm)', 
                border: localError ? '1px solid var(--meeting-danger)' : '1px solid var(--meeting-border)', 
                borderRadius: 'var(--radius-sm)',
                background: isSending ? 'rgba(0,0,0,0.05)' : 'white'
              }}
              onKeyPress={handleKeyPress}
              aria-label="Message input"
              maxLength={maxMessageLength}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--space-xs)',
              fontSize: '10px',
              color: newMessage.length > maxMessageLength * 0.9 ? 'var(--meeting-danger)' : '#666'
            }}>
              <span>{localError || "Press Enter to send"}</span>
              <span>{newMessage.length}/{maxMessageLength}</span>
            </div>
          </div>
          
          <button 
            onClick={handleSendMessage}
            disabled={isSending || !!error || !newMessage.trim()}
            className="meeting-button meeting-button-primary"
            style={{ 
              padding: 'var(--space-sm) var(--space-md)',
              opacity: isSending || !!error || !newMessage.trim() ? 0.6 : 1
            }}
            aria-label="Send message"
          >
            {isSending ? (
              <i className="bi bi-hourglass-split meeting-icon"></i>
            ) : (
              <i className="bi bi-send meeting-icon"></i>
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}