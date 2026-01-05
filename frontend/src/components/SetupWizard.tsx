import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import './SetupWizard.css';

interface SetupWizardProps {
  onComplete: () => void;
}

type SetupStep = 'welcome' | 'anthropic' | 'validation' | 'complete';

interface SetupConfig {
  anthropicApiKey: string;
  embeddingApiUrl: string;
  preferredModel?: string;
}

interface ValidationResult {
  anthropic: { valid: boolean; error?: string };
  embedding: { valid: boolean; error?: string };
  services: { valid: boolean; error?: string };
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [config, setConfig] = useState<SetupConfig>({
    anthropicApiKey: '',
    embeddingApiUrl: 'http://127.0.0.1:8000',
    preferredModel: 'claude-sonnet-4-5',
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Check if already configured
  useEffect(() => {
    checkExistingConfig();
  }, []);

  async function checkExistingConfig() {
    try {
      const result = await api.checkSetup();
      if (result.configured) {
        onComplete();
      }
    } catch {
      // Not configured, continue with setup
    }
  }

  async function validateConfiguration() {
    setIsValidating(true);
    setError(null);

    try {
      const result = await api.validateSetup(config);
      setValidation(result);
      
      if (result.anthropic.valid && result.embedding.valid) {
        // Save configuration
        await api.saveSetup(config);
        setStep('complete');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  }

  function handleNext() {
    switch (step) {
      case 'welcome':
        setStep('anthropic');
        break;
      case 'anthropic':
        setStep('validation');
        validateConfiguration();
        break;
    }
  }

  function handleBack() {
    switch (step) {
      case 'anthropic':
        setStep('welcome');
        break;
      case 'validation':
        setStep('anthropic');
        setValidation(null);
        break;
    }
  }

  return (
    <div className="setup-wizard">
      {/* Background "AI" text */}
      <div className="setup-bg-text">AI</div>

      {/* Progress indicator */}
      <div className="setup-progress">
        <div className={`progress-step ${step === 'welcome' ? 'active' : 'completed'}`}>
          <div className="step-dot">1</div>
          <span>Welcome</span>
        </div>
        <div className={`progress-line ${step !== 'welcome' ? 'completed' : ''}`} />
        <div className={`progress-step ${step === 'anthropic' ? 'active' : ['validation', 'complete'].includes(step) ? 'completed' : ''}`}>
          <div className="step-dot">2</div>
          <span>API Keys</span>
        </div>
        <div className={`progress-line ${['validation', 'complete'].includes(step) ? 'completed' : ''}`} />
        <div className={`progress-step ${step === 'validation' ? 'active' : step === 'complete' ? 'completed' : ''}`}>
          <div className="step-dot">3</div>
          <span>Validate</span>
        </div>
        <div className={`progress-line ${step === 'complete' ? 'completed' : ''}`} />
        <div className={`progress-step ${step === 'complete' ? 'active completed' : ''}`}>
          <div className="step-dot">4</div>
          <span>Ready</span>
        </div>
      </div>

      {/* Wizard Card */}
      <div className="setup-card">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <WelcomeStep key="welcome" onNext={handleNext} />
          )}

          {step === 'anthropic' && (
            <AnthropicStep
              key="anthropic"
              config={config}
              showApiKey={showApiKey}
              onToggleShow={() => setShowApiKey(!showApiKey)}
              onChange={(key, value) => setConfig(prev => ({ ...prev, [key]: value }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {step === 'validation' && (
            <ValidationStep
              key="validation"
              isValidating={isValidating}
              validation={validation}
              error={error}
              onRetry={validateConfiguration}
              onBack={handleBack}
            />
          )}

          {step === 'complete' && (
            <CompleteStep key="complete" onComplete={onComplete} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ==================== Step Components ====================

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      className="setup-step welcome-step"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="step-header">
        <div className="step-icon">
          {/* Geometric AI logo - matching dark template */}
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2zm0 4l6 12H6l6-12z" />
          </svg>
        </div>
        <h2>God Agent</h2>
        <p>Self-Learning AI Orchestration System</p>
      </div>

      <div className="welcome-features">
        <div className="feature-card">
          <div className="feature-icon">🧠</div>
          <h3>Intelligent Routing</h3>
          <p>Automatically routes tasks to the optimal AI agent</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📚</div>
          <h3>Self-Learning</h3>
          <p>Continuously improves from feedback and interactions</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔧</div>
          <h3>Project Scaffolding</h3>
          <p>Auto-generates specs and infrastructure for coding projects</p>
        </div>
      </div>

      <div className="requirements-box">
        <h3>Before You Begin</h3>
        <p>You'll need the following to get started:</p>
        <div className="requirement-item">
          <span className="requirement-icon">🔑</span>
          <div>
            <strong>Anthropic API Key</strong>
            <span>Get one at <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a></span>
          </div>
        </div>
        <div className="requirement-item">
          <span className="requirement-icon">🤖</span>
          <div>
            <strong>Claude Access</strong>
            <span>Claude Sonnet 4.5 or Opus 4.5 recommended</span>
          </div>
        </div>
      </div>

      <div className="setup-actions">
        <button className="btn btn-next" onClick={onNext}>
          Get Started
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

function AnthropicStep({
  config,
  showApiKey,
  onToggleShow,
  onChange,
  onNext,
  onBack,
}: {
  config: SetupConfig;
  showApiKey: boolean;
  onToggleShow: () => void;
  onChange: (key: keyof SetupConfig, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isValid = config.anthropicApiKey.startsWith('sk-ant-');

  return (
    <motion.div
      className="setup-step api-step"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="step-header">
        <div className="step-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.743 5.743L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707l5.964-5.964A6 6 0 1 1 21 9z" />
          </svg>
        </div>
        <h2>Connect Your APIs</h2>
        <p>Enter your API credentials to enable AI capabilities</p>
      </div>

      <div className="api-form">
        <div className="form-group">
          <label htmlFor="anthropicKey">
            Anthropic API Key
            <span className="required">*</span>
          </label>
          <div className="input-with-icon">
            <input
              id="anthropicKey"
              type={showApiKey ? 'text' : 'password'}
              value={config.anthropicApiKey}
              onChange={(e) => onChange('anthropicApiKey', e.target.value)}
              placeholder="sk-ant-api03-..."
              className={config.anthropicApiKey && !isValid ? 'invalid' : ''}
            />
            <button 
              type="button" 
              className="toggle-visibility"
              onClick={onToggleShow}
              title={showApiKey ? 'Hide' : 'Show'}
            >
              {showApiKey ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {config.anthropicApiKey && !isValid && (
            <span className="field-error">API key should start with 'sk-ant-'</span>
          )}
          <span className="field-hint">
            Get your API key from{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">
              Anthropic Console
            </a>
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="embeddingUrl">
            Embedding API URL
            <span className="optional">(optional)</span>
          </label>
          <input
            id="embeddingUrl"
            type="text"
            value={config.embeddingApiUrl}
            onChange={(e) => onChange('embeddingApiUrl', e.target.value)}
            placeholder="http://127.0.0.1:8000"
          />
          <span className="field-hint">
            Local embedding server for semantic search (uses gte-Qwen2-1.5B by default)
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="preferredModel">
            Preferred Claude Model
          </label>
          <select
            id="preferredModel"
            value={config.preferredModel || 'claude-sonnet-4-5'}
            onChange={(e) => onChange('preferredModel', e.target.value)}
          >
            <optgroup label="Claude 4.5 Series (Latest)">
              <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommended)</option>
              <option value="claude-opus-4-5">Claude Opus 4.5 (Most Capable)</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5 (Fastest)</option>
            </optgroup>
            <optgroup label="Claude 4 Series">
              <option value="claude-sonnet-4-0">Claude Sonnet 4.0</option>
              <option value="claude-opus-4-0">Claude Opus 4.0</option>
            </optgroup>
          </select>
          <span className="field-hint">
            Sonnet 4.5 offers the best balance of speed and capability
          </span>
        </div>

        <div className="info-box">
          <div className="info-icon">ℹ️</div>
          <div>
            <strong>Your API key is stored locally</strong>
            <p>We never send your API key to any external servers. It's stored securely in your local environment.</p>
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>
        <button 
          className="btn-primary" 
          onClick={onNext}
          disabled={!isValid}
        >
          <span>Validate & Continue</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

function ValidationStep({
  isValidating,
  validation,
  error,
  onRetry,
  onBack,
}: {
  isValidating: boolean;
  validation: ValidationResult | null;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const allValid = validation?.anthropic.valid && validation?.embedding.valid && validation?.services.valid;

  return (
    <motion.div
      className="setup-step validation-step"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="step-header">
        <div className={`step-icon ${isValidating ? 'spinning' : ''}`}>
          {isValidating ? (
            <div className="spinner" />
          ) : allValid ? (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="16 8 10 14 8 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>
        <h2>{isValidating ? 'Validating Configuration...' : allValid ? 'All Systems Ready!' : 'Validation Issues'}</h2>
        <p>{isValidating ? 'Checking your API connections and services' : allValid ? 'Your setup is complete' : 'Some checks failed. Please review and fix.'}</p>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="validation-checks">
        <ValidationCheck
          label="Anthropic API"
          description="Claude AI access"
          status={isValidating ? 'checking' : validation?.anthropic.valid ? 'valid' : 'invalid'}
          error={validation?.anthropic.error}
        />
        <ValidationCheck
          label="Embedding Service"
          description="Local vector embeddings"
          status={isValidating ? 'checking' : validation?.embedding.valid ? 'valid' : validation?.embedding.error ? 'warning' : 'valid'}
          error={validation?.embedding.error}
          isOptional
        />
        <ValidationCheck
          label="Backend Services"
          description="Memory server, orchestration"
          status={isValidating ? 'checking' : validation?.services.valid ? 'valid' : 'warning'}
          error={validation?.services.error}
          isOptional
        />
      </div>

      {!isValidating && !allValid && (
        <div className="step-actions">
          <button className="btn-secondary" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back to Settings</span>
          </button>
          <button className="btn-primary" onClick={onRetry}>
            <span>Retry Validation</span>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      )}
    </motion.div>
  );
}

function ValidationCheck({
  label,
  description,
  status,
  error,
  isOptional,
}: {
  label: string;
  description: string;
  status: 'checking' | 'valid' | 'invalid' | 'warning';
  error?: string;
  isOptional?: boolean;
}) {
  return (
    <div className={`validation-check ${status}`}>
      <div className="check-status">
        {status === 'checking' && <div className="mini-spinner" />}
        {status === 'valid' && (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === 'invalid' && (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        {status === 'warning' && (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </div>
      <div className="check-info">
        <div className="check-label">
          {label}
          {isOptional && <span className="optional-badge">Optional</span>}
        </div>
        <div className="check-description">{description}</div>
        {error && <div className="check-error">{error}</div>}
      </div>
    </div>
  );
}

function CompleteStep({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      className="setup-step complete-step"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="success-animation">
        <div className="success-circle">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>

      <h2>You're All Set!</h2>
      <p>God Agent is ready to assist you with intelligent task routing and project scaffolding.</p>

      <div className="quick-tips">
        <h3>Quick Tips</h3>
        <div className="tip-grid">
          <div className="tip-card">
            <span className="tip-icon">💬</span>
            <div>
              <strong>Ask Anything</strong>
              <p>Type naturally - the system routes to the best agent</p>
            </div>
          </div>
          <div className="tip-card">
            <span className="tip-icon">🏗️</span>
            <div>
              <strong>Start a Project</strong>
              <p>"Build an API with authentication" triggers scaffolding</p>
            </div>
          </div>
          <div className="tip-card">
            <span className="tip-icon">📊</span>
            <div>
              <strong>View Orchestration</strong>
              <p>Click the panel toggle to see routing decisions</p>
            </div>
          </div>
          <div className="tip-card">
            <span className="tip-icon">👍</span>
            <div>
              <strong>Provide Feedback</strong>
              <p>Rate responses to help the system learn</p>
            </div>
          </div>
        </div>
      </div>

      <button className="btn-primary btn-large" onClick={onComplete}>
        <span>Start Using God Agent</span>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </motion.div>
  );
}

