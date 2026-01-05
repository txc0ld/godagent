import { useState, useRef, useEffect } from 'react';
import type { Message } from '../api/types';
import { MessageBubble } from './MessageBubble';
import './ChatInterface.css';

interface ChatInterfaceProps {
  messages: Message[];
  isProcessing: boolean;
  onSendMessage: (content: string) => void;
}

export function ChatInterface({ messages, isProcessing, onSendMessage }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message}
                showAgent={message.role === 'assistant' && message.agent !== messages[index - 1]?.agent}
              />
            ))}
            {isProcessing && <ThinkingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form className="input-container" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... I'll route to the best agent"
            disabled={isProcessing}
            rows={1}
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={!input.trim() || isProcessing}
          >
            {isProcessing ? (
              <div className="spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
        <div className="input-hints">
          <span>Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line</span>
          <span className="char-count">{input.length} / 10000</span>
        </div>
      </form>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="3" className="welcome-core" />
        </svg>
      </div>
      <h1 className="welcome-title">Welcome to God Agent</h1>
      <p className="welcome-subtitle">
        AI-powered orchestration with 200+ specialized agents
      </p>
      <div className="welcome-capabilities">
        <div className="capability-card">
          <div className="capability-icon code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <h3>Code</h3>
          <p>Generate code with pattern learning and best practices</p>
        </div>
        <div className="capability-card">
          <div className="capability-icon research">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <h3>Research</h3>
          <p>Deep research with knowledge accumulation</p>
        </div>
        <div className="capability-card">
          <div className="capability-icon write">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            </svg>
          </div>
          <h3>Write</h3>
          <p>Create documents with style adaptation</p>
        </div>
      </div>
      <div className="welcome-prompt">
        <span className="prompt-arrow">→</span>
        <span>Try asking: "Implement a rate limiter with sliding window"</span>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="thinking-indicator">
      <div className="thinking-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="thinking-content">
        <div className="thinking-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="thinking-text">Routing to best agent...</span>
      </div>
    </div>
  );
}

