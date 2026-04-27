import { useState, useEffect } from 'react';
import { MicOff, Play, X, User, Scale, FileText } from 'lucide-react';
import '../App.css';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AudioVisualizer } from '../components/AudioVisualizer';

const API_BASE_URL = 'https://api.sampreeth.in';

// Lawyer AI System Instruction
const LAWYER_SYSTEM_INSTRUCTION = `
INTEGRATED LEGAL CONSULTATION ASSISTANT SYSTEM PROMPT

CORE IDENTITY
You are a professional, knowledgeable AI legal assistant. Your goal is to help users understand their legal situation, provide general legal information, and guide them toward appropriate next steps. You speak with authority but always remind users to consult with a licensed attorney for specific legal advice.

IMPORTANT DISCLAIMER
You are NOT a licensed attorney and cannot provide actual legal advice. You can only provide general legal information and education. Always remind users of this when appropriate.

CONVERSATION FLOW
1. **Professional Welcome**: Greet the user warmly and explain that you're here to help them understand their legal situation. Ask what legal matter they'd like to discuss.

2. **Initial Assessment**: Ask 2-3 clarifying questions to understand their situation:
    * "What type of legal matter are you dealing with? (e.g., contract, employment, family law, criminal, personal injury, real estate)"
    * "Can you briefly describe your situation?"
    * "What's your main concern or question about this matter?"

3. **The Deep Dive (CRITICAL STEP)**: Once you identify the general area of law, provide educational information:
    * "Based on what you've shared, this falls under **[Area of Law]**. Let me explain some key concepts:
        1. **[Key Concept A]**: [Brief explanation]
        2. **[Key Concept B]**: [Brief explanation]
        3. **[Key Concept C]**: [Brief explanation]
    * What aspect would you like me to elaborate on?"

4. **Guidance & Next Steps**: Provide actionable guidance:
    * Explain relevant legal concepts
    * Outline typical processes or procedures
    * Suggest documents they might need
    * Recommend when to seek a licensed attorney
    * Once complete, call the 'save_session_summary' tool.

IMPORTANT RULES
* **Always Include Disclaimers**: Regularly remind users this is general information, not legal advice.
* **Be Accurate**: Only provide information you're confident about. If unsure, say so.
* **Stay Neutral**: Don't take sides in disputes.
* **Recommend Professionals**: Direct users to licensed attorneys, legal aid, or appropriate resources when needed.
* **Document Everything**: When ready to conclude, call save_session_summary with the full consultation summary.

TOOL USAGE
When the consultation reaches a natural conclusion, call the 'save_session_summary' tool.
Structure the data based on what you learned:
* Fill 'traitScores' with legal matter complexity scores (0.0 to 1.0)
* Fill 'domainScores' for areas of law discussed
* Set 'chosenCareer' to the primary legal matter type
* Provide a comprehensive 'conversationSummary' with key legal points discussed
`;

export function LawPage() {
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
    } = useGeminiLive(API_BASE_URL, authToken, LAWYER_SYSTEM_INSTRUCTION);

    const [showSummary, setShowSummary] = useState(false);

    useEffect(() => {
        // Check for transparency param
        const params = new URLSearchParams(window.location.search);
        if (params.get('transparent') === 'true') {
            document.body.classList.add('transparent-bg');
        }

        // Message event listener for parent-iframe communication
        const handleMessage = (event: MessageEvent) => {
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
            window.parent.postMessage({ type: 'SUMMARY_AVAILABLE', payload: sessionSummary }, '*');
        }
    }, [sessionSummary]);

    return (
        <div className="app-container law-theme">
            <div className="bg-gradient law-gradient" />

            <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
                <div className={`status-badge ${isConnected ? 'connected' : isConnecting ? 'connecting' : ''}`}>
                    <div className="status-dot" />
                    <span>
                        {isConnected ? 'Consultation Active' : isConnecting ? 'Connecting...' : 'Ready to Consult'}
                    </span>
                </div>
            </div>

            <main>
                <div className="interaction-area">
                    <div className="brand-header">
                        <Scale size={48} className="law-icon" />
                        <h1 className="brand-title">Legal AI</h1>
                        <p className="brand-subtitle">We need a better name</p>
                    </div>
                    <div className="visualizer-container">
                        <AudioVisualizer isSpeaking={isSpeaking} isListening={isConnected && !isSpeaking} />
                    </div>

                    <div className="controls">
                        {!isConnected ? (
                            <button
                                className="btn-primary law-btn"
                                onClick={connect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <>Connecting...</>
                                ) : (
                                    <>
                                        <Play size={20} fill="currentColor" />
                                        Start Consultation
                                    </>
                                )}
                            </button>
                        ) : (
                            <button className="btn-danger" onClick={disconnect} disabled={isSaving}>
                                <MicOff size={20} />
                                {isSaving ? 'Saving Session...' : 'End Consultation'}
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Summary Modal */}
            {showSummary && sessionSummary && (
                <>
                    <div className="backdrop" onClick={() => setShowSummary(false)} />
                    <div className="summary-card law-summary">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <h2><Scale size={24} style={{ display: 'inline', marginRight: 8 }} />Legal Consultation Summary</h2>
                            <button
                                onClick={() => setShowSummary(false)}
                                style={{ background: 'transparent', padding: '0.5rem', border: 'none' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="summary-group">
                            <h3><User size={14} style={{ display: 'inline', marginRight: 6 }} /> Client</h3>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{sessionSummary.userName || 'Anonymous Client'}</p>
                        </div>

                        {sessionSummary.conversationSummary && (
                            <div className="summary-group">
                                <h3><FileText size={14} style={{ display: 'inline', marginRight: 6 }} /> Consultation Summary</h3>
                                <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                    {sessionSummary.conversationSummary}
                                </p>
                            </div>
                        )}

                        {sessionSummary.chosenCareer && (
                            <div className="summary-group">
                                <h3>Legal Matter Type</h3>
                                <p style={{ color: '#c9a227', fontWeight: 600, fontSize: '1.1rem' }}>{sessionSummary.chosenCareer}</p>
                            </div>
                        )}

                        {sessionSummary.nextSteps && sessionSummary.nextSteps.length > 0 && (
                            <div className="summary-group">
                                <h3>Recommended Next Steps</h3>
                                <ul style={{ paddingLeft: '1.25rem', color: '#cbd5e1' }}>
                                    {sessionSummary.nextSteps.map((step, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="disclaimer-box" style={{
                            marginTop: '1.5rem',
                            padding: '1rem',
                            background: 'rgba(201, 162, 39, 0.1)',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(201, 162, 39, 0.3)'
                        }}>
                            <p style={{ fontSize: '0.85rem', color: '#c9a227', margin: 0 }}>
                                ⚠️ <strong>Disclaimer:</strong> This consultation provided general legal information only.
                                For specific legal advice, please consult with a licensed attorney in your jurisdiction.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default LawPage;
