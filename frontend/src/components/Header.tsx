import type { SystemStatus } from '../api/types';
import './Header.css';

interface HeaderProps {
  status: SystemStatus | null;
  onToggleOrchestration: () => void;
  orchestrationVisible: boolean;
}

export function Header({ status, onToggleOrchestration, orchestrationVisible }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="3" className="logo-core" />
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-title">God Agent</span>
            <span className="logo-subtitle">AI Orchestration</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="status-indicators">
          {status && (
            <>
              <StatusDot status={status.health.vectorDB} label="Vectors" />
              <StatusDot status={status.health.memory} label="Memory" />
              <StatusDot status={status.health.reasoning} label="Reasoning" />
              <StatusDot status={status.health.learning} label="Learning" />
            </>
          )}
        </div>
      </div>

      <div className="header-right">
        <button 
          className={`orchestration-toggle ${orchestrationVisible ? 'active' : ''}`}
          onClick={onToggleOrchestration}
          title="Toggle orchestration panel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4" />
          </svg>
        </button>

        {status?.stats && (
          <div className="stats-badge">
            <span className="stats-count">{status.stats.agentCount}</span>
            <span className="stats-label">Agents</span>
          </div>
        )}
      </div>
    </header>
  );
}

function StatusDot({ status, label }: { status: string; label: string }) {
  const statusClass = status === 'healthy' ? 'healthy' : 
                      status === 'degraded' ? 'degraded' : 'unavailable';
  
  return (
    <div className={`status-dot ${statusClass}`} title={`${label}: ${status}`}>
      <span className="status-indicator" />
      <span className="status-label">{label}</span>
    </div>
  );
}

