import type { Message, AgentInfo, SystemStatus } from '../api/types';
import './Sidebar.css';

interface SidebarProps {
  messages: Message[];
  currentAgent: AgentInfo | null;
  status: SystemStatus | null;
}

export function Sidebar({ messages, currentAgent, status }: SidebarProps) {
  const conversationCount = messages.filter(m => m.role === 'user').length;

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-title">Session</h3>
        <div className="session-stats">
          <div className="stat-item">
            <span className="stat-value">{conversationCount}</span>
            <span className="stat-label">Messages</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{status?.stats?.totalInteractions || 0}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
      </div>

      {currentAgent && (
        <div className="sidebar-section animate-slide-in">
          <h3 className="sidebar-title">Active Agent</h3>
          <div className="agent-card">
            <div className="agent-header">
              <div className="agent-avatar">
                <AgentIcon category={currentAgent.category} />
              </div>
              <div className="agent-info">
                <span className="agent-name">{currentAgent.name}</span>
                <span className="agent-category">{currentAgent.category}</span>
              </div>
            </div>
            <div className="confidence-bar">
              <div 
                className="confidence-fill" 
                style={{ width: `${currentAgent.confidence * 100}%` }}
              />
              <span className="confidence-value">
                {(currentAgent.confidence * 100).toFixed(0)}%
              </span>
            </div>
            {currentAgent.factors && currentAgent.factors.length > 0 && (
              <div className="routing-factors">
                {currentAgent.factors.slice(0, 3).map((factor, i) => (
                  <div key={i} className="factor-item">
                    <span className="factor-name">{factor.name}</span>
                    <span className="factor-weight">{(factor.weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <h3 className="sidebar-title">Quick Actions</h3>
        <div className="action-buttons">
          <button className="action-btn" data-mode="code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </button>
          <button className="action-btn" data-mode="research">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Research
          </button>
          <button className="action-btn" data-mode="write">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            </svg>
            Write
          </button>
        </div>
      </div>

      <div className="sidebar-section sidebar-footer">
        <div className="knowledge-stats">
          <div className="knowledge-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>{status?.stats?.knowledgeEntries || 0} knowledge entries</span>
          </div>
          <div className="knowledge-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span>{status?.stats?.categoryCount || 0} categories</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AgentIcon({ category }: { category: string }) {
  const iconMap: Record<string, JSX.Element> = {
    code: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    research: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    writing: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      </svg>
    ),
    default: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  };

  return iconMap[category] || iconMap.default;
}

