/**
 * Gemini Live API Hook
 * Handles audio streaming, connection management, and tool calls
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';

// Audio constants
const AUDIO_SAMPLE_RATE_INPUT = 16000;
const AUDIO_SAMPLE_RATE_OUTPUT = 24000;
const MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

// System instruction
const SYSTEM_INSTRUCTION = `
INTEGRATED CONVERSATIONAL CAREER COUNSELOR SYSTEM PROMPT

CORE IDENTITY
You are a friendly, efficient career guide. Your goal is to quickly understand the user and recommend suitable career paths without a long, drawn-out process.

CONVERSATION FLOW
1.  **Warm Welcome**: Briefly say hi and explain you'll ask just a few simple questions to find their ideal career match.
2.  **Broad Discovery**: Ask 2-3 questions to identify their general area of interest (e.g., tech, art, business):
    *   "What do you love doing in your free time?"
    *   "Do you prefer working with people, data, or building things?"
3.  **The Deep Dive (CRITICAL STEP)**: Once you identify a general field (e.g., "Software Engineering" or "Design"), you MUST stop and say:
    *   "It sounds like **[Field Name]** is a great fit for you. Within [Field Name], there are a few distinct paths:
        1.  **[Option A]**: [Brief description]
        2.  **[Option B]**: [Brief description]
        3.  **[Option C]**: [Brief description]
        Which of these sounds most exciting to you?"
4.  **Final Selection & Wrap-up**: Wait for them to pick an option. Once they choose, say "Great choice!" and IMMEDIATELY call the 'save_session_summary' tool.

IMPORTANT RULES
*   **Offer Concrete Choices**: You must give specific roles/sub-fields in Step 3 (e.g., if DevOps: "SRE", "Platform Engineer", "Cloud Architect").
*   **Wait for the Choice**: Do NOT call the tool until they explicitly select one of the options you requested.
*   **Infer the Rest**: Fill in all tool fields ('traitScores', etc.) based on the entire conversation.

TOOL USAGE
When you have the 3 answers, you MUST call the 'save_session_summary' tool.
Structure the data based on what you learned:
*   Infer 'traitScores' (0.0 to 1.0) for traits like 'logical_reasoning', 'people_orientation', etc.
*   Infer 'domainScores' for the 12 domains.
*   Pick the best 'chosenCareer'.
*   Provide a brief 'conversationSummary'.
`;

// Tool definitions
const TOOLS = [{
    functionDeclarations: [{
        name: 'save_session_summary',
        description: 'Save the final assessment results including detailed scores.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                userName: { type: Type.STRING },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                traitScores: {
                    type: Type.OBJECT,
                    description: "Key-value map of trait names to scores",
                    additionalProperties: { type: Type.NUMBER }
                },
                domainScores: {
                    type: Type.OBJECT,
                    description: "Key-value map of domain names to scores",
                    additionalProperties: { type: Type.NUMBER }
                },
                confidenceMetrics: {
                    type: Type.OBJECT,
                    properties: {
                        overall: { type: Type.NUMBER }
                    }
                },
                chosenCareer: { type: Type.STRING },
                recommendedCareers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            reason: { type: Type.STRING }
                        }
                    }
                },
                conversationSummary: { type: Type.STRING },
                nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['conversationSummary', 'domainScores']
        }
    }]
}];

export interface SessionSummary {
    userName?: string;
    skills?: string[];
    traitScores?: Record<string, number>;
    domainScores?: Record<string, number>;
    confidenceMetrics?: { overall: number };
    recommendedCareers?: { title: string; reason: string }[];
    chosenCareer?: string;
    conversationSummary?: string;
    nextSteps?: string[];
    interests?: string[]; // Kept for backward compat if needed
}

export interface UseGeminiLiveReturn {
    isConnected: boolean;
    isConnecting: boolean;
    isSpeaking: boolean;
    isSaving: boolean;
    error: string | null;
    sessionSummary: SessionSummary | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    sendText: (text: string) => void;
}

// Audio utilities
function createPcmBlob(float32Array: Float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return {
        mimeType: 'audio/pcm;rate=16000',
        data: btoa(String.fromCharCode(...new Uint8Array(int16Array.buffer)))
    };
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    uint8Array: Uint8Array,
    audioContext: AudioContext,
    sampleRate: number,
    channels: number
): Promise<AudioBuffer> {
    const int16Array = new Int16Array(uint8Array.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
    }
    const audioBuffer = audioContext.createBuffer(channels, float32Array.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);
    return audioBuffer;
}

// Default career counselor system instruction  
const DEFAULT_SYSTEM_INSTRUCTION = SYSTEM_INSTRUCTION;

export function useGeminiLive(apiBaseUrl: string, authToken: string | null = null, customSystemInstruction?: string, customInitMessage?: string): UseGeminiLiveReturn {
    const systemInstructionToUse = customSystemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    const initMessage = customInitMessage || '[System: Init deterministic assessment. Ask user Name.]';
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

    // Refs for audio management
    const sessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputContextRef = useRef<AudioContext | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    const isSpeakingRef = useRef(false);

    // Keep ref in sync
    useEffect(() => {
        isSpeakingRef.current = isSpeaking;
    }, [isSpeaking]);

    const cleanupAudio = useCallback((onlyStopPlayback = false) => {
        // Stop all playing sources
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { /* ignore */ }
        });
        sourcesRef.current.clear();
        setIsSpeaking(false);
        nextStartTimeRef.current = 0;

        if (onlyStopPlayback) {
            if (audioContextRef.current) {
                nextStartTimeRef.current = audioContextRef.current.currentTime;
            }
            return;
        }

        // Full cleanup
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        if (inputContextRef.current) {
            inputContextRef.current.close().catch(() => { });
            inputContextRef.current = null;
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
            audioStreamRef.current = null;
        }
    }, []);

    const connect = useCallback(async () => {
        if (isConnecting || isConnected) return;

        setIsConnecting(true);
        setError(null);
        setSessionSummary(null);

        try {
            // Get ephemeral token from backend
            const tokenResponse = await fetch(`${apiBaseUrl}/api/token`);
            if (!tokenResponse.ok) {
                throw new Error('Failed to get authentication token');
            }
            const { token } = await tokenResponse.json();

            // Initialize audio contexts
            inputContextRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
            audioContextRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });

            // Get microphone
            audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Connect to Gemini
            const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });

            const session = await ai.live.connect({
                model: MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: systemInstructionToUse,
                    tools: TOOLS
                },
                callbacks: {
                    onopen: async () => {
                        console.log('✅ Connected to Gemini');
                        setIsConnected(true);
                        setIsConnecting(false);

                        // Setup audio worklet
                        if (inputContextRef.current && audioStreamRef.current) {
                            try {
                                await inputContextRef.current.audioWorklet.addModule('/audio-processor.js');

                                const source = inputContextRef.current.createMediaStreamSource(audioStreamRef.current);
                                workletNodeRef.current = new AudioWorkletNode(inputContextRef.current, 'audio-processor');

                                workletNodeRef.current.port.onmessage = (event) => {
                                    if (event.data.type === 'volume' && event.data.volume > 0.02 && isSpeakingRef.current) {
                                        // User interrupted - stop AI audio
                                        cleanupAudio(true);
                                    } else if (event.data.type === 'audio' && sessionRef.current) {
                                        const blob = createPcmBlob(event.data.data);
                                        sessionRef.current.sendRealtimeInput({ media: blob });
                                    }
                                };

                                source.connect(workletNodeRef.current);
                                workletNodeRef.current.connect(inputContextRef.current.destination);
                            } catch (e) {
                                console.error('Audio worklet setup failed:', e);
                            }
                        }

                        // Send greeting trigger
                        session.sendClientContent({
                            turns: [{
                                role: 'user',
                                parts: [{ text: initMessage }]
                            }]
                        });
                    },

                    onmessage: async (msg: LiveServerMessage) => {
                        // Handle tool calls
                        if (msg.toolCall?.functionCalls) {
                            console.log('🔧 Gemini requested tool calls:', msg.toolCall.functionCalls.length);
                            for (const call of msg.toolCall.functionCalls) {
                                if (call.name === 'save_session_summary') {
                                    console.log('🛠️ TOOL CALL RECEIVED:', call.name);
                                    console.log('📦 Tool Args:', JSON.stringify(call.args, null, 2));

                                    const summary = call.args as SessionSummary;
                                    setSessionSummary(summary);

                                    // Save to backend
                                    try {
                                        console.log('🚀 Sending summary to backend:', `${apiBaseUrl}/api/sessions`);
                                        const response = await fetch(`${apiBaseUrl}/api/sessions`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                // Auth Token
                                                authToken: authToken,
                                                // Standard fields
                                                userName: summary.userName,
                                                skills: summary.skills,
                                                chosenCareer: summary.chosenCareer,
                                                conversationSummary: summary.conversationSummary,
                                                sessionId: `session_${Date.now()}`,
                                                createdAt: new Date().toISOString(),
                                                // New fields
                                                traitScores: summary.traitScores,
                                                domainScores: summary.domainScores,
                                                confidenceMetrics: summary.confidenceMetrics,
                                                recommendedCareers: summary.recommendedCareers,
                                                nextSteps: summary.nextSteps
                                            })
                                        });

                                        const responseText = await response.text();
                                        console.log('✅ Backend Response:', response.status, responseText);

                                        if (!response.ok) {
                                            console.error('❌ Backend save failed:', response.statusText);
                                        } else {
                                            console.log('💾 Session saved successfully according to backend');
                                        }

                                    } catch (e) {
                                        console.error('❌ Failed to send session to backend:', e);
                                    }

                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: { result: { status: 'saved' } }
                                        }
                                    });

                                    // ALWAYS disconnect after saving the session summary
                                    setTimeout(() => {
                                        if (sessionRef.current) {
                                            console.log('💾 Session saved, closing connection automatically');
                                            sessionRef.current = null;
                                            cleanupAudio();
                                            setIsConnected(false);
                                            setIsSaving(false);
                                        }
                                    }, 2000); // 2s delay to let the AI finish any final audio chunk
                                }
                            }
                        }

                        // Handle audio
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && audioContextRef.current) {
                            setIsSpeaking(true);

                            const ctx = audioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                            const buffer = await decodeAudioData(decode(audioData), ctx, AUDIO_SAMPLE_RATE_OUTPUT, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(ctx.destination);

                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) {
                                    setIsSpeaking(false);
                                }
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                            sourcesRef.current.add(source);
                        }
                    },

                    onclose: () => {
                        console.log('Connection closed');
                        setIsConnected(false);
                        setIsConnecting(false);
                        cleanupAudio();
                    },

                    onerror: (err) => {
                        console.error('Connection error:', err);
                        setError('Connection error occurred');
                        setIsConnected(false);
                        setIsConnecting(false);
                        cleanupAudio();
                    }
                }
            });

            sessionRef.current = session;

        } catch (err: any) {
            console.error('Failed to connect:', err);
            setError(err.message || 'Failed to connect');
            setIsConnecting(false);
            cleanupAudio();
        }
    }, [apiBaseUrl, isConnecting, isConnected, cleanupAudio]);

    const isSavingRef = useRef(false);

    // Sync isSaving ref
    useEffect(() => {
        isSavingRef.current = isSaving;
    }, [isSaving]);

    const disconnect = useCallback(() => {
        if (sessionRef.current) {
            setIsSaving(true);

            // Ask Gemini to summarize first
            sessionRef.current.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text: 'TERMINATE_IMMEDIATELY. Calculate final scores and call save_session_summary.' }]
                }]
            });

            // Fallback timeout in case AI fails to call tool (15s)
            setTimeout(() => {
                if (sessionRef.current) {
                    console.log('Save timeout reached, forcing disconnect');
                    sessionRef.current = null;
                    cleanupAudio();
                    setIsConnected(false);
                    setIsSaving(false);
                }
            }, 15000);
        }
    }, [cleanupAudio]);

    const sendText = useCallback((text: string) => {
        if (sessionRef.current && text.trim()) {
            sessionRef.current.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text }]
                }]
            });
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupAudio();
        };
    }, [cleanupAudio]);

    return {
        isConnected,
        isConnecting,
        isSpeaking,
        isSaving,
        error,
        sessionSummary,
        connect,
        disconnect,
        sendText
    };
}
