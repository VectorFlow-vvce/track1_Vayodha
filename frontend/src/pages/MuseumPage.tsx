import { useState, useEffect } from 'react';
import { MicOff, Play, X, User, Landmark, BookOpen } from 'lucide-react';
import '../App.css';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AudioVisualizer } from '../components/AudioVisualizer';

const API_BASE_URL = 'https://api.sampreeth.in';

const MUSEUM_SYSTEM_INSTRUCTION = `
MUSEUM GUIDE AI ASSISTANT SYSTEM PROMPT

CORE IDENTITY
You are Muse, an enthusiastic and knowledgeable AI museum guide. Your goal is to make art, history, science, and culture come alive for every visitor. You speak with warmth, curiosity, and deep expertise — like the best human docent you've ever encountered.

CONVERSATION FLOW
1. **Warm Welcome**: Greet the visitor and ask what kind of museum experience they're looking for today.
   Examples: a specific exhibit, an artist, a historical period, a scientific topic, or simply a curated tour.

2. **Discovery Questions**: Ask 1-2 focused questions to tailor the experience:
   * "Is there a particular artwork, artifact, or topic you'd like to explore?"
   * "Are you visiting with children, or is this a solo adult experience? (So I can pitch the depth just right.)"

3. **The Tour (CRITICAL STEP)**: Based on their interests, guide them through relevant pieces or topics:
   * Paint vivid, sensory descriptions of artworks or artifacts.
   * Share fascinating historical context, artist biographies, or scientific significance.
   * Pose thought-provoking questions to deepen engagement: "What do you think the artist was feeling when they painted this?"
   * Connect pieces to broader themes or modern relevance.

4. **Wrap-Up**: Summarise the highlights, suggest follow-up reading or real-world museums to visit, and call 'save_session_summary'.

IMPORTANT RULES
* **Be Vivid**: Use descriptive language. Don't just state facts — tell stories.
* **Stay Accurate**: Only share information you are confident about. If uncertain, say so honestly.
* **Be Inclusive**: Cater to all ages and levels of prior knowledge.
* **Inspire Curiosity**: End every major point with an invitation to explore further.
* **No Fabrication**: Never invent artworks, dates, or quotes. If you don't know, say "That's a great question — I'm not certain, but I can tell you what I do know."

TOOL USAGE
When the tour concludes, call the 'save_session_summary' tool.
Structure the data as follows:
* Fill 'traitScores' with engagement scores for the topics covered (0.0 to 1.0)
* Fill 'domainScores' for categories explored (e.g. "Renaissance Art", "Ancient History", "Modern Science")
* Set 'chosenCareer' to the primary exhibit category the visitor focused on
* Provide a rich 'conversationSummary' covering highlights of the tour
`;

export function MuseumPage() {
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
    } = useGeminiLive(API_BASE_URL, authToken, MUSEUM_SYSTEM_INSTRUCTION);

    const [showSummary, setShowSummary] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('transparent') === 'true') {
            document.body.classList.add('transparent-bg');
        }

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

    useEffect(() => {
        if (sessionSummary) {
            setShowSummary(true);
            window.parent.postMessage({ type: 'SUMMARY_AVAILABLE', payload: sessionSummary }, '*');
        }
    }, [sessionSummary]);

    return (
        <div className="app-container museum-theme">
            <div className="bg-gradient museum-gradient" />

            <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
                <div className={`status-badge ${isConnected ? 'connected' : isConnecting ? 'connecting' : ''}`}>
                    <div className="status-dot" />
                    <span>
                        {isConnected ? 'Tour Active' : isConnecting ? 'Connecting...' : 'Ready to Explore'}
                    </span>
                </div>
            </div>

            <main>
                <div className="interaction-area">
                    <div className="brand-header">
                        <Landmark size={48} className="museum-icon" />
                        <h1 className="brand-title">Muse</h1>
                        <p className="brand-subtitle">AI Museum Guide</p>
                    </div>
                    <div className="visualizer-container">
                        <AudioVisualizer isSpeaking={isSpeaking} isListening={isConnected && !isSpeaking} />
                    </div>

                    <div className="controls">
                        {!isConnected ? (
                            <button
                                className="btn-primary museum-btn"
                                onClick={connect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <>Connecting...</>
                                ) : (
                                    <>
                                        <Play size={20} fill="currentColor" />
                                        Begin Tour
                                    </>
                                )}
                            </button>
                        ) : (
                            <button className="btn-danger" onClick={disconnect} disabled={isSaving}>
                                <MicOff size={20} />
                                {isSaving ? 'Saving Tour...' : 'End Tour'}
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {showSummary && sessionSummary && (
                <>
                    <div className="backdrop" onClick={() => setShowSummary(false)} />
                    <div className="summary-card museum-summary">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <h2><Landmark size={24} style={{ display: 'inline', marginRight: 8 }} />Tour Summary</h2>
                            <button
                                onClick={() => setShowSummary(false)}
                                style={{ background: 'transparent', padding: '0.5rem', border: 'none' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="summary-group">
                            <h3><User size={14} style={{ display: 'inline', marginRight: 6 }} /> Visitor</h3>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{sessionSummary.userName || 'Anonymous Visitor'}</p>
                        </div>

                        {sessionSummary.conversationSummary && (
                            <div className="summary-group">
                                <h3><BookOpen size={14} style={{ display: 'inline', marginRight: 6 }} /> Tour Highlights</h3>
                                <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                    {sessionSummary.conversationSummary}
                                </p>
                            </div>
                        )}

                        {sessionSummary.skills && sessionSummary.skills.length > 0 && (
                            <div className="summary-group">
                                <h3>Topics Explored</h3>
                                <div className="summary-tags">
                                    {sessionSummary.skills.map(topic => (
                                        <span key={topic} className="tag">{topic}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {sessionSummary.chosenCareer && (
                            <div className="summary-group">
                                <h3>Main Exhibit Focus</h3>
                                <p style={{ color: 'var(--museum-primary)', fontWeight: 600, fontSize: '1.1rem' }}>
                                    {sessionSummary.chosenCareer}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default MuseumPage;
