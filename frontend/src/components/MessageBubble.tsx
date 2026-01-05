import { marked } from 'marked';
import type { Message } from '../api/types';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
  showAgent?: boolean;
}

export function MessageBubble({ message, showAgent }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Configure marked for secure rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  const renderContent = () => {
    if (isUser) {
      return <p>{message.content}</p>;
    }

    // Parse markdown for assistant messages
    const html = marked.parse(message.content) as string;
    return (
      <div 
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${message.isError ? 'error' : ''}`}>
      {!isUser && (
        <div className="message-avatar">
          {message.isError ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </div>
      )}

      <div className="message-content">
        {showAgent && message.agent && (
          <div className="message-agent">
            <span className="agent-badge">{message.agent}</span>
            {message.routing?.confidence && (
              <span className="confidence-badge">
                {(message.routing.confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
        )}

        <div className="message-text">
          {renderContent()}
        </div>

        <div className="message-meta">
          <span className="message-time">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.qualityScore !== undefined && (
            <span className="quality-score">
              Quality: {(message.qualityScore * 100).toFixed(0)}%
            </span>
          )}
          {message.trajectoryId && (
            <button className="feedback-btn" title="Provide feedback">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="message-avatar user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}

