import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChatInterface } from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AgentOrchestration } from './components/AgentOrchestration';
import { ProjectSetup } from './components/ProjectSetup';
import { SetupWizard } from './components/SetupWizard';
import type { Message, AgentInfo, SystemStatus, ProjectInitResult } from './api/types';
import { api } from './api/client';
import './App.css';

// Patterns that indicate a project-level task (vs simple Q&A)
const PROJECT_PATTERNS = [
  /^(build|create|implement|develop)\s+(a|an|the)?\s*\w+\s*(app|api|system|service|platform|application)/i,
  /full[\s-]?stack/i,
  /end[\s-]?to[\s-]?end/i,
  /complete\s+(system|solution|implementation)/i,
  /with\s+(authentication|database|api|backend|frontend)/i,
  /production[\s-]?ready/i,
  /microservices?/i,
];

function detectProjectTask(input: string): boolean {
  return PROJECT_PATTERNS.some(pattern => pattern.test(input));
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentInfo | null>(null);
  const [orchestrationVisible, setOrchestrationVisible] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [projectSetupTask, setProjectSetupTask] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if setup is complete
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    try {
      const result = await api.checkSetup();
      setIsSetupComplete(result.configured);
      if (result.configured) {
        // Fetch system status after setup confirmed
        api.getStatus().then(setSystemStatus).catch(console.error);
      }
    } catch {
      // If check fails, assume not configured (API might not be running)
      setIsSetupComplete(false);
    }
  }

  function handleSetupComplete() {
    setIsSetupComplete(true);
    // Fetch system status after setup
    api.getStatus().then(setSystemStatus).catch(console.error);
  }

  // Show loading while checking setup status
  if (isSetupComplete === null) {
    return (
      <div className="app app-loading">
        <div className="app-bg" />
        <div className="app-grid" />
        <div className="app-loading-spinner" />
        <p>Initializing God Agent...</p>
      </div>
    );
  }

  // Show setup wizard if not configured
  if (!isSetupComplete) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  const handleSendMessage = async (content: string) => {
    // Check if this looks like a project-level task
    if (detectProjectTask(content) && messages.length === 0) {
      // First message that looks like a project - trigger project setup
      setProjectSetupTask(content);
      return;
    }

    await processMessage(content);
  };

  const processMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    setOrchestrationVisible(true);

    try {
      // Send to God Agent API
      const response = await api.ask(content);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.result?.response || response.error || 'No response',
        timestamp: new Date(),
        agent: response.selectedAgent,
        routing: response.routing,
        trajectoryId: response.trajectoryId,
        qualityScore: response.qualityScore,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.routing) {
        setCurrentAgent({
          id: response.selectedAgent,
          name: response.selectedAgent,
          category: response.routing.agentCategory || 'general',
          confidence: response.routing.confidence || 0.9,
          factors: response.routing.factors || [],
        });
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProjectSetupComplete = (result: ProjectInitResult) => {
    // Add a system message about project setup
    const setupMessage: Message = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `🚀 **Project Initialized Successfully!**\n\nProject ID: \`${result.projectId}\`\n\n**Created Files:**\n${result.files.slice(0, 5).map(f => `- ${f.split('/').slice(-2).join('/')}`).join('\n')}\n\nYou can now start working on the tasks. Type "Show tasks" to see the implementation plan.`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, setupMessage]);
    setProjectSetupTask(null);

    // Process the original task
    if (projectSetupTask) {
      processMessage(`The project has been initialized. Now let's begin: ${projectSetupTask}`);
    }
  };

  const handleProjectSetupCancel = () => {
    // User cancelled - just process as normal message
    if (projectSetupTask) {
      processMessage(projectSetupTask);
    }
    setProjectSetupTask(null);
  };

  return (
    <div className="app">
      {/* Background effects */}
      <div className="app-bg" />
      <div className="app-grid" />
      <div className="app-bg-text">GOD</div>
      
      <Header 
        status={systemStatus} 
        onToggleOrchestration={() => setOrchestrationVisible(!orchestrationVisible)}
        orchestrationVisible={orchestrationVisible}
      />
      
      <div className="main-container">
        <Sidebar 
          messages={messages} 
          currentAgent={currentAgent}
          status={systemStatus}
        />
        
        <main className="main-content">
          <ChatInterface
            messages={messages}
            isProcessing={isProcessing}
            onSendMessage={handleSendMessage}
          />
        </main>

        {orchestrationVisible && (
          <AgentOrchestration
            currentAgent={currentAgent}
            isProcessing={isProcessing}
            onClose={() => setOrchestrationVisible(false)}
          />
        )}
      </div>

      {/* Project Setup Modal */}
      <AnimatePresence>
        {projectSetupTask && (
          <ProjectSetup
            task={projectSetupTask}
            onComplete={handleProjectSetupComplete}
            onCancel={handleProjectSetupCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

