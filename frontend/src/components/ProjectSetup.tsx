import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import type { ProjectAnalysis, ProjectInitResult } from '../api/types';
import './ProjectSetup.css';

interface ProjectSetupProps {
  task: string;
  onComplete: (result: ProjectInitResult) => void;
  onCancel: () => void;
}

type SetupPhase = 'analyzing' | 'review' | 'location' | 'scaffolding' | 'complete' | 'error';

export function ProjectSetup({ task, onComplete, onCancel }: ProjectSetupProps) {
  const [phase, setPhase] = useState<SetupPhase>('analyzing');
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [projectRoot, setProjectRoot] = useState('');
  const [scaffoldResult, setScaffoldResult] = useState<ProjectInitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeTask();
  }, [task]);

  async function analyzeTask() {
    try {
      const response = await api.analyzeProject(task);
      
      if (response.success && response.analysis) {
        setAnalysis(response.analysis);
        
        if (!response.analysis.needsScaffolding) {
          // No scaffolding needed - skip to processing
          onCancel(); // Will trigger normal message handling
        } else {
          setPhase('review');
        }
      } else {
        setError(response.error || 'Analysis failed');
        setPhase('error');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPhase('error');
    }
  }

  async function initializeProject() {
    setPhase('scaffolding');
    
    try {
      const response = await api.initProject(task, projectRoot || undefined);
      
      if (response.success && response.scaffoldResult) {
        setScaffoldResult(response.scaffoldResult);
        setPhase('complete');
      } else {
        setError(response.error || 'Initialization failed');
        setPhase('error');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPhase('error');
    }
  }

  function handleComplete() {
    if (scaffoldResult) {
      onComplete(scaffoldResult);
    }
  }

  return (
    <motion.div 
      className="project-setup-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="project-setup-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <AnimatePresence mode="wait">
          {phase === 'analyzing' && (
            <AnalyzingPhase key="analyzing" task={task} />
          )}
          
          {phase === 'review' && analysis && (
            <ReviewPhase 
              key="review"
              analysis={analysis}
              onProceed={() => setPhase('location')}
              onCancel={onCancel}
            />
          )}
          
          {phase === 'location' && (
            <LocationPhase
              key="location"
              projectRoot={projectRoot}
              onChange={setProjectRoot}
              onProceed={initializeProject}
              onBack={() => setPhase('review')}
            />
          )}
          
          {phase === 'scaffolding' && (
            <ScaffoldingPhase key="scaffolding" />
          )}
          
          {phase === 'complete' && scaffoldResult && (
            <CompletePhase
              key="complete"
              result={scaffoldResult}
              onComplete={handleComplete}
            />
          )}
          
          {phase === 'error' && (
            <ErrorPhase
              key="error"
              error={error}
              onRetry={analyzeTask}
              onCancel={onCancel}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ==================== Phase Components ====================

function AnalyzingPhase({ task }: { task: string }) {
  return (
    <motion.div 
      className="phase-content analyzing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="phase-icon analyzing-icon">
        <div className="spinner" />
      </div>
      <h2>Analyzing Your Task</h2>
      <p className="task-preview">"{task.substring(0, 100)}{task.length > 100 ? '...' : ''}"</p>
      <p className="phase-description">
        Detecting project type and determining infrastructure requirements...
      </p>
    </motion.div>
  );
}

function ReviewPhase({ 
  analysis, 
  onProceed, 
  onCancel 
}: { 
  analysis: ProjectAnalysis; 
  onProceed: () => void; 
  onCancel: () => void;
}) {
  const typeEmoji = {
    coding: '💻',
    research: '🔬',
    writing: '✍️',
    general: '💬',
  };

  const topologyColors = {
    centralized: '#10b981',
    hierarchical: '#3b82f6',
    mesh: '#8b5cf6',
  };

  return (
    <motion.div 
      className="phase-content review"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="phase-header">
        <span className="type-emoji">{typeEmoji[analysis.type]}</span>
        <h2>{analysis.type.charAt(0).toUpperCase() + analysis.type.slice(1)} Project Detected</h2>
      </div>

      <div className="analysis-summary">
        <div className="summary-row">
          <span className="label">Confidence</span>
          <span className="value">
            <div className="confidence-bar">
              <div 
                className="confidence-fill" 
                style={{ width: `${analysis.confidence * 100}%` }}
              />
            </div>
            <span className="confidence-text">{(analysis.confidence * 100).toFixed(0)}%</span>
          </span>
        </div>
        
        <div className="summary-row">
          <span className="label">Complexity</span>
          <span className={`value complexity-${analysis.complexity}`}>
            {analysis.complexity.charAt(0).toUpperCase() + analysis.complexity.slice(1)}
          </span>
        </div>
        
        <div className="summary-row">
          <span className="label">Project Name</span>
          <span className="value code">{analysis.suggestedName}</span>
        </div>
        
        <div className="summary-row">
          <span className="label">Estimated Agents</span>
          <span className="value">{analysis.infrastructure.estimatedAgents}</span>
        </div>
        
        <div className="summary-row">
          <span className="label">Topology</span>
          <span 
            className="value topology-badge"
            style={{ backgroundColor: topologyColors[analysis.infrastructure.topology] }}
          >
            {analysis.infrastructure.topology}
          </span>
        </div>
      </div>

      {analysis.detectedFeatures.length > 0 && (
        <div className="features-section">
          <h3>Detected Features</h3>
          <div className="features-list">
            {analysis.detectedFeatures.map((feature, i) => (
              <span key={i} className="feature-tag">{feature}</span>
            ))}
          </div>
        </div>
      )}

      <div className="infrastructure-section">
        <h3>Infrastructure to Create</h3>
        <div className="infrastructure-grid">
          <InfraItem 
            label="PRD" 
            description="Product Requirements" 
            enabled={analysis.infrastructure.needsPRD} 
          />
          <InfraItem 
            label="SPEC" 
            description="Functional Spec" 
            enabled={analysis.infrastructure.needsSpec} 
          />
          <InfraItem 
            label="TECH" 
            description="Technical Spec" 
            enabled={analysis.infrastructure.needsTech} 
          />
          <InfraItem 
            label="TASKS" 
            description="Task Plan" 
            enabled={analysis.infrastructure.needsTasks} 
          />
          <InfraItem 
            label="CONSTITUTION" 
            description="Project Rules" 
            enabled={analysis.infrastructure.needsConstitution} 
          />
          <InfraItem 
            label="AI Tracking" 
            description="Progress & Context" 
            enabled={analysis.infrastructure.needsAITracking} 
          />
        </div>
      </div>

      <div className="phase-actions">
        <button className="btn-secondary" onClick={onCancel}>
          Skip Setup
        </button>
        <button className="btn-primary" onClick={onProceed}>
          <span>Set Location</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

function InfraItem({ label, description, enabled }: { label: string; description: string; enabled: boolean }) {
  return (
    <div className={`infra-item ${enabled ? 'enabled' : 'disabled'}`}>
      <div className="infra-check">
        {enabled ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
      <div className="infra-info">
        <span className="infra-label">{label}</span>
        <span className="infra-description">{description}</span>
      </div>
    </div>
  );
}

function LocationPhase({
  projectRoot,
  onChange,
  onProceed,
  onBack,
}: {
  projectRoot: string;
  onChange: (value: string) => void;
  onProceed: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div 
      className="phase-content location"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="phase-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
        </svg>
      </div>
      
      <h2>Choose Project Location</h2>
      <p className="phase-description">
        Select where to create the project structure. Leave empty to use the current workspace.
      </p>

      <div className="location-input">
        <label htmlFor="projectRoot">Project Root Directory</label>
        <input
          id="projectRoot"
          type="text"
          value={projectRoot}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/path/to/your/project (or leave empty for workspace)"
        />
        <span className="input-hint">
          The specs and docs will be created inside this directory
        </span>
      </div>

      <div className="phase-actions">
        <button className="btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>
        <button className="btn-primary" onClick={onProceed}>
          <span>Create Project</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

function ScaffoldingPhase() {
  return (
    <motion.div 
      className="phase-content scaffolding"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="phase-icon scaffolding-icon">
        <div className="build-animation">
          <div className="block block-1" />
          <div className="block block-2" />
          <div className="block block-3" />
        </div>
      </div>
      <h2>Creating Project Structure</h2>
      <p className="phase-description">
        Generating specifications and setting up infrastructure...
      </p>
      <div className="progress-steps">
        <div className="step active">Creating directories...</div>
        <div className="step">Generating PRD...</div>
        <div className="step">Generating SPEC...</div>
        <div className="step">Generating TECH...</div>
        <div className="step">Generating TASKS...</div>
        <div className="step">Setting up AI tracking...</div>
      </div>
    </motion.div>
  );
}

function CompletePhase({ 
  result, 
  onComplete 
}: { 
  result: ProjectInitResult; 
  onComplete: () => void;
}) {
  return (
    <motion.div 
      className="phase-content complete"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="phase-icon success-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="16 8 10 14 8 12" />
        </svg>
      </div>
      
      <h2>Project Created Successfully!</h2>
      <p className="project-id">Project ID: <code>{result.projectId}</code></p>

      <div className="created-files">
        <h3>Created Files</h3>
        <div className="files-list">
          {result.files.slice(0, 8).map((file, i) => (
            <div key={i} className="file-item">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{file.split('/').slice(-2).join('/')}</span>
            </div>
          ))}
          {result.files.length > 8 && (
            <div className="file-item more">
              +{result.files.length - 8} more files
            </div>
          )}
        </div>
      </div>

      <div className="next-steps">
        <h3>Next Steps</h3>
        <ol>
          <li>Review the generated specifications</li>
          <li>Customize requirements as needed</li>
          <li>Begin implementation with tasks</li>
        </ol>
      </div>

      <div className="phase-actions">
        <button className="btn-primary" onClick={onComplete}>
          <span>Start Working</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

function ErrorPhase({
  error,
  onRetry,
  onCancel,
}: {
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div 
      className="phase-content error"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="phase-icon error-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      
      <h2>Something Went Wrong</h2>
      <p className="error-message">{error || 'An unknown error occurred'}</p>

      <div className="phase-actions">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={onRetry}>
          <span>Retry</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

