import type { AgentInfo } from '../api/types';
import './AgentOrchestration.css';

interface AgentOrchestrationProps {
  currentAgent: AgentInfo | null;
  isProcessing: boolean;
  onClose: () => void;
}

export function AgentOrchestration({ currentAgent, isProcessing, onClose }: AgentOrchestrationProps) {
  return (
    <aside className="orchestration-panel">
      <div className="panel-header">
        <h2>Orchestration</h2>
        <button className="close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="panel-content">
        {/* Routing visualization */}
        <div className="routing-viz">
          <div className="viz-stage">
            <div className="stage-node input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>User Input</span>
            </div>
            <div className="stage-connector" />
          </div>

          <div className="viz-stage">
            <div className={`stage-node analyzer ${isProcessing ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>Task Analyzer</span>
            </div>
            <div className="stage-connector" />
          </div>

          <div className="viz-stage">
            <div className={`stage-node router ${isProcessing ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6M12 17v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M1 12h6M17 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
              </svg>
              <span>Routing Engine</span>
            </div>
            <div className="stage-connector" />
          </div>

          <div className="viz-stage">
            <div className={`stage-node agent ${currentAgent ? 'active selected' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{currentAgent?.name || 'Agent Selection'}</span>
            </div>
          </div>
        </div>

        {/* Agent details */}
        {currentAgent && (
          <div className="agent-details animate-fade-in">
            <h3>Selected Agent</h3>
            
            <div className="detail-card">
              <div className="detail-header">
                <div className="agent-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div className="agent-meta">
                  <span className="agent-name">{currentAgent.name}</span>
                  <span className="agent-category">{currentAgent.category}</span>
                </div>
              </div>

              <div className="confidence-section">
                <div className="confidence-header">
                  <span>Confidence Score</span>
                  <span className="confidence-value">
                    {(currentAgent.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{ width: `${currentAgent.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {currentAgent.factors && currentAgent.factors.length > 0 && (
              <div className="factors-section">
                <h4>Routing Factors</h4>
                <div className="factors-list">
                  {currentAgent.factors.map((factor, index) => (
                    <div key={index} className="factor-card">
                      <div className="factor-header">
                        <span className="factor-name">{factor.name}</span>
                        <span className="factor-contribution">
                          +{(factor.contribution * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="factor-bar">
                        <div 
                          className="factor-fill"
                          style={{ width: `${factor.weight * 100}%` }}
                        />
                      </div>
                      {factor.description && (
                        <p className="factor-desc">{factor.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing status */}
        {isProcessing && (
          <div className="processing-status animate-fade-in">
            <div className="status-icon">
              <div className="spinner-ring" />
            </div>
            <div className="status-text">
              <span className="status-title">Processing Request</span>
              <span className="status-desc">Routing to optimal agent...</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

