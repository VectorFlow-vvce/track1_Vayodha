import { useState, useEffect } from 'react';
import { MicOff, Play, X, User, Briefcase } from 'lucide-react';
import './App.css';
import { useGeminiLive } from './hooks/useGeminiLive';
import { AudioVisualizer } from './components/AudioVisualizer';

const API_BASE_URL = 'https://api.sampreeth.in';

function App() {
  // Get token from URL query params (for iframe auth)
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      console.log("🔐 Auth token detected from URL");
      setAuthToken(token);
    }
  }, []);

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    isSaving,
    sessionSummary,
    connect,
    disconnect
  } = useGeminiLive(API_BASE_URL, authToken);

  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    // Check for transparency param
    const params = new URLSearchParams(window.location.search);
    if (params.get('transparent') === 'true') {
      document.body.classList.add('transparent-bg');
    }

    // Message event listener for parent-iframe communication
    const handleMessage = (event: MessageEvent) => {
      // Security check: You might want to validate event.origin here if known
      // if (event.origin !== "https://trusted-domain.com") return;

      const { type } = event.data;
      if (type === 'START_SESSION' && !isConnected && !isConnecting) {
        connect();
        window.parent.postMessage({ type: 'SESSION_STARTED' }, '*');
      } else if (type === 'END_SESSION' && isConnected) {
        disconnect();
        window.parent.postMessage({ type: 'SESSION_ENDED' }, '*');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [connect, disconnect, isConnected, isConnecting]);


  // Show summary when it arrives
  useEffect(() => {
    if (sessionSummary) {
      setShowSummary(true);
      // Notify parent about summary availability
      window.parent.postMessage({ type: 'SUMMARY_AVAILABLE', payload: sessionSummary }, '*');
    }
  }, [sessionSummary]);

  return (
    <div className="app-container">
      <div className="bg-gradient" />

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
        <div className={`status-badge ${isConnected ? 'connected' : isConnecting ? 'connecting' : ''}`}>
          <div className="status-dot" />
          <span>
            {isConnected ? 'Live Session' : isConnecting ? 'Connecting...' : 'Ready to Start'}
          </span>
        </div>
      </div>

      <main>
        <div className="interaction-area">
          <div className="brand-header">
            <h1 className="brand-title">Cara</h1>
            <p className="brand-subtitle">AI Career Assistant</p>
          </div>
          <div className="visualizer-container">
            <AudioVisualizer isSpeaking={isSpeaking} isListening={isConnected && !isSpeaking} />
          </div>

          <div className="controls">
            {!isConnected ? (
              <button
                className="btn-primary"
                onClick={connect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>Connecting...</>
                ) : (
                  <>
                    <Play size={20} fill="currentColor" />
                    Start Session
                  </>
                )}
              </button>
            ) : (
              <button className="btn-danger" onClick={disconnect} disabled={isSaving}>
                <MicOff size={20} />
                {isSaving ? 'Saving Session...' : 'End Session'}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Summary Modal */}
      {showSummary && sessionSummary && (
        <>
          <div className="backdrop" onClick={() => setShowSummary(false)} />
          <div className="summary-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <h2>Career Profile</h2>
              <button
                onClick={() => setShowSummary(false)}
                style={{ background: 'transparent', padding: '0.5rem', border: 'none' }}
              >
                <X size={24} />
              </button>
            </div>

            <div className="summary-group">
              <h3><User size={14} style={{ display: 'inline', marginRight: 6 }} /> User</h3>
              <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{sessionSummary.userName}</p>
            </div>

            {sessionSummary.conversationSummary && (
              <div className="summary-group">
                <h3>Conversation Summary</h3>
                <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {sessionSummary.conversationSummary}
                </p>
              </div>
            )}

            <div className="summary-group">
              <h3>Skills Discovered</h3>
              <div className="summary-tags">
                {sessionSummary.skills?.map(skill => (
                  <span key={skill} className="tag">{skill}</span>
                ))}
              </div>
            </div>

            <div className="summary-group">
              <h3><Briefcase size={14} style={{ display: 'inline', marginRight: 6 }} /> Recommended Careers</h3>
              <div style={{ display: 'grid', gap: '1rem', marginTop: '0.5rem' }}>
                {sessionSummary.recommendedCareers?.map(career => (
                  <div key={career.title} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{career.title}</div>
                    <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.25rem' }}>{career.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            {sessionSummary.chosenCareer && (
              <div className="summary-group">
                <h3>Chosen Path</h3>
                <p style={{ color: '#22c55e', fontWeight: 600, fontSize: '1.1rem' }}>{sessionSummary.chosenCareer}</p>
              </div>
            )}


          </div>
        </>
      )}
    </div>
  );
}

export default App;
