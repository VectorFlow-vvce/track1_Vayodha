import { useState, useEffect, useMemo } from 'react';
import { MicOff, Play, X, User, FileText, Sprout } from 'lucide-react';
import '../App.css';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AudioVisualizer } from '../components/AudioVisualizer';

const API_BASE_URL = 'https://api.sampreeth.in';

// Build the system instruction dynamically based on URL field details
function buildFarmingPrompt(fieldDetails: Record<string, string>): string {
    const fieldInfoBlock = Object.entries(fieldDetails)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');

    return `
BHOOMI – ಕೃಷಿ ಸಹಾಯಕ (FARMING ASSISTANT) SYSTEM PROMPT

CORE IDENTITY
ನಿಮ್ಮ ಹೆಸರು "ಭೂಮಿ". ನೀವು ಒಬ್ಬ ಸ್ನೇಹಪರ, ತಿಳುವಳಿಕೆಯುಳ್ಳ ಕೃಷಿ ಸಹಾಯಕ.
Your name is "Bhoomi". You are a friendly, knowledgeable farming assistant.

LANGUAGE RULES (CRITICAL)
* Your PRIMARY language is **Kannada (ಕನ್ನಡ)**. You MUST speak in Kannada by default.
* If the farmer speaks in another language, you may respond in that language, but always prefer Kannada.
* Use simple, everyday Kannada that any farmer would understand — avoid overly formal or literary Kannada.
* You may use common English farming/technical terms when there is no easy Kannada equivalent (e.g., "pH level", "drip irrigation").

FIELD DETAILS (PROVIDED BY THE SYSTEM)
The following details about the farmer's field have been provided:
${fieldInfoBlock || '(No field details were provided in the URL. Ask the farmer about their field.)'}

CONVERSATION FLOW
1. **ಸ್ವಾಗತ (Welcome)**: Greet the farmer warmly in Kannada. Mention that you already have some details about their field (if provided). Confirm the details with them and ask if they're correct.

2. **ಮಾಹಿತಿ ಸಂಗ್ರಹ (Gather Info)**: If field details are missing or incomplete, ask about:
    * ಬೆಳೆ (Crop) – What are they currently growing or planning to grow?
    * ಜಮೀನು ವಿಸ್ತೀರ್ಣ (Land area) – How much land?
    * ಮಣ್ಣಿನ ಬಗೆ (Soil type) – Red soil, black soil, etc.?
    * ನೀರಾವರಿ (Irrigation) – Borewell, canal, rainfed?
    * ಸಮಸ್ಯೆ (Problem) – Any current issues? (pests, disease, yield, weather)

3. **ಸಲಹೆ (Advice)**: Based on the field information, provide practical farming advice:
    * Crop-specific guidance (sowing time, seed varieties, spacing)
    * Soil and fertilizer recommendations
    * Pest and disease management
    * Water management and irrigation tips
    * Government schemes and subsidies they can avail
    * Market prices and best time to sell

4. **ಸಾರಾಂಶ (Summary)**: When the conversation reaches a natural end, call the 'save_session_summary' tool.

IMPORTANT RULES
* **Be Practical**: Give actionable, ground-level advice. These are real farmers, not students.
* **Be Respectful**: Farming is hard work. Always show respect.
* **Local Context**: Consider Karnataka's climate, seasons, and common crops (Ragi, Jowar, Rice, Sugarcane, Arecanut, Coffee, Silk, Vegetables, etc.).
* **Mention Government Schemes**: When relevant, mention applicable Karnataka/Central government schemes (PM-KISAN, Raitha Siri, crop insurance, etc.).
* **Safety First**: For pesticide/chemical recommendations, ALWAYS stress safety precautions.

TOOL USAGE
When the consultation is complete, call 'save_session_summary' with:
* 'userName' – the farmer's name
* 'conversationSummary' – full summary of the discussion (in English for backend storage)
* 'chosenCareer' – the primary crop/topic discussed
* 'skills' – key topics covered (e.g., ["pest management", "drip irrigation", "soil testing"])
* 'domainScores' – relevance scores for topics discussed
* 'nextSteps' – actionable next steps for the farmer
`;
}

export function ApoorvaPage() {
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [fieldDetails, setFieldDetails] = useState<Record<string, string>>({});

    // Parse URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            console.log("🔐 Auth token detected from URL");
            setAuthToken(token);
        }

        // Extract all non-system params as field details
        const details: Record<string, string> = {};
        params.forEach((value, key) => {
            if (key !== 'token' && key !== 'transparent') {
                details[key] = value;
            }
        });
        setFieldDetails(details);
    }, []);

    // Build prompt and init message from field details
    const systemPrompt = useMemo(() => buildFarmingPrompt(fieldDetails), [fieldDetails]);

    const initMessage = useMemo(() => {
        const detailsSummary = Object.entries(fieldDetails)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');

        if (detailsSummary) {
            return `[System: ರೈತರ ಜಮೀನಿನ ವಿವರಗಳು ಕೆಳಗಿವೆ: ${detailsSummary}. ಕನ್ನಡದಲ್ಲಿ ಸ್ವಾಗತಿಸಿ ಮತ್ತು ವಿವರಗಳನ್ನು ಖಚಿತಪಡಿಸಿ.]`;
        }
        return `[System: ಕನ್ನಡದಲ್ಲಿ ರೈತರನ್ನು ಸ್ವಾಗತಿಸಿ ಮತ್ತು ಅವರ ಜಮೀನಿನ ಬಗ್ಗೆ ಕೇಳಿ.]`;
    }, [fieldDetails]);

    const {
        isConnected,
        isConnecting,
        isSpeaking,
        isSaving,
        sessionSummary,
        connect,
        disconnect
    } = useGeminiLive(API_BASE_URL, authToken, systemPrompt, initMessage);

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
        <div className="app-container farm-theme">
            <div className="bg-gradient farm-gradient" />

            <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
                <div className={`status-badge ${isConnected ? 'connected' : isConnecting ? 'connecting' : ''}`}>
                    <div className="status-dot" />
                    <span>
                        {isConnected ? 'ಸಂಪರ್ಕ ಸಕ್ರಿಯ' : isConnecting ? 'ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ...' : 'ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧ'}
                    </span>
                </div>
            </div>

            {/* Show parsed field details as chips */}
            {Object.keys(fieldDetails).length > 0 && (
                <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: '300px' }}>
                    {Object.entries(fieldDetails).map(([key, value]) => (
                        <span key={key} className="tag farm-tag" style={{ fontSize: '0.75rem' }}>
                            {key}: {value}
                        </span>
                    ))}
                </div>
            )}

            <main>
                <div className="interaction-area">
                    <div className="brand-header">
                        <Sprout size={48} className="farm-icon" />
                        <h1 className="brand-title">ಭೂಮಿ</h1>
                        <p className="brand-subtitle">ಕೃಷಿ ಸಹಾಯಕ · Farming Assistant</p>
                    </div>
                    <div className="visualizer-container">
                        <AudioVisualizer isSpeaking={isSpeaking} isListening={isConnected && !isSpeaking} />
                    </div>

                    <div className="controls">
                        {!isConnected ? (
                            <button
                                className="btn-primary farm-btn"
                                onClick={connect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <>ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ...</>
                                ) : (
                                    <>
                                        <Play size={20} fill="currentColor" />
                                        ಸಂಭಾಷಣೆ ಪ್ರಾರಂಭಿಸಿ
                                    </>
                                )}
                            </button>
                        ) : (
                            <button className="btn-danger" onClick={disconnect} disabled={isSaving}>
                                <MicOff size={20} />
                                {isSaving ? 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...' : 'ಸಂಭಾಷಣೆ ಮುಗಿಸಿ'}
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Summary Modal */}
            {showSummary && sessionSummary && (
                <>
                    <div className="backdrop" onClick={() => setShowSummary(false)} />
                    <div className="summary-card farm-summary">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <h2><Sprout size={24} style={{ display: 'inline', marginRight: 8 }} />ಕೃಷಿ ಸಮಾಲೋಚನೆ ಸಾರಾಂಶ</h2>
                            <button
                                onClick={() => setShowSummary(false)}
                                style={{ background: 'transparent', padding: '0.5rem', border: 'none' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="summary-group">
                            <h3><User size={14} style={{ display: 'inline', marginRight: 6 }} /> ರೈತರು (Farmer)</h3>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{sessionSummary.userName || 'ಹೆಸರು ತಿಳಿಸಿಲ್ಲ'}</p>
                        </div>

                        {sessionSummary.conversationSummary && (
                            <div className="summary-group">
                                <h3><FileText size={14} style={{ display: 'inline', marginRight: 6 }} /> ಸಾರಾಂಶ (Summary)</h3>
                                <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                    {sessionSummary.conversationSummary}
                                </p>
                            </div>
                        )}

                        {sessionSummary.chosenCareer && (
                            <div className="summary-group">
                                <h3>ಮುಖ್ಯ ವಿಷಯ (Main Topic)</h3>
                                <p style={{ color: '#22c55e', fontWeight: 600, fontSize: '1.1rem' }}>{sessionSummary.chosenCareer}</p>
                            </div>
                        )}

                        {sessionSummary.skills && sessionSummary.skills.length > 0 && (
                            <div className="summary-group">
                                <h3>ಚರ್ಚಿಸಿದ ವಿಷಯಗಳು (Topics Covered)</h3>
                                <div className="summary-tags">
                                    {sessionSummary.skills.map(skill => (
                                        <span key={skill} className="tag farm-tag">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {sessionSummary.nextSteps && sessionSummary.nextSteps.length > 0 && (
                            <div className="summary-group">
                                <h3>ಮುಂದಿನ ಹೆಜ್ಜೆಗಳು (Next Steps)</h3>
                                <ul style={{ paddingLeft: '1.25rem', color: '#cbd5e1' }}>
                                    {sessionSummary.nextSteps.map((step, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default ApoorvaPage;
