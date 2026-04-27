import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Loader2, AlertCircle, Bug, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface DiseaseDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DetectionResult {
  disease: string;
  confidence: number;
  description: string;
  treatment: string;
  severity: 'low' | 'medium' | 'high';
}

export function DiseaseDetectionModal({ isOpen, onClose }: DiseaseDetectionModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      // Resize to max 1024px before sending — large images cause 400 from Gemini
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setSelectedImage(canvas.toDataURL('image/jpeg', 0.85));
        setResult(null);
        setError('');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError('');

    const MODELS = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',  // fallback — separate quota, same API version
    ];
    const MAX_RETRIES = 3;

    const callGemini = async (model: string, attempt: number): Promise<any> => {
      const apiKey =
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        (import.meta as any).env?.GEMINI_API_KEY;

      if (!apiKey) throw new Error('NO_KEY');

      const base64Image = selectedImage.split(',')[1];
      const mimeMatch   = selectedImage.match(/data:([^;]+);/);
      const mimeType    = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `You are an expert plant pathologist. Analyze this plant image and identify any diseases present.

Respond in this EXACT JSON format (no markdown, just raw JSON):
{
  "disease": "Disease name or 'Healthy' if no disease detected",
  "confidence": 85,
  "description": "Brief description of the disease and symptoms visible",
  "treatment": "Recommended treatment or preventive measures",
  "severity": "low"
}

Be specific about the disease name. If healthy, set confidence to 95+ and severity to "low". Severity must be one of: low, medium, high`
                },
                { inlineData: { mimeType, data: base64Image } },
              ]
            }],
          }),
        }
      );

      const data = await res.json();

      if (res.status === 429) {
        // Rate limited — back off then retry or switch model
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          setError(`Rate limited — retrying in ${delay / 1000}s… (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          return callGemini(model, attempt + 1);
        }
        throw new Error('RATE_LIMIT');
      }

      if (!res.ok) {
        console.error('Gemini API error:', JSON.stringify(data, null, 2));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      return data;
    };

    try {
      let data: any = null;
      let lastErr: Error | null = null;

      // Try each model in order — stop at first success
      for (const model of MODELS) {
        try {
          setError('');
          data = await callGemini(model, 0);
          break; // success
        } catch (e: any) {
          lastErr = e;
          if (e.message === 'NO_KEY') {
            setError('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
            return;
          }
          if (e.message === 'RATE_LIMIT') {
            // try next model
            setError(`${model} quota exhausted — trying fallback model…`);
            continue;
          }
          throw e; // unexpected error — bail
        }
      }

      if (!data) {
        setError(lastErr?.message || 'All Gemini models are rate-limited. Try again in a minute.');
        return;
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        setError('No response from AI. Please try again.');
        return;
      }

      // Strip markdown code fences if present
      const jsonText = rawText.trim()
        .replace(/^```json\n?/, '')
        .replace(/^```\n?/, '')
        .replace(/```\n?$/, '');

      setResult(JSON.parse(jsonText));

    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze image. Check your API key and network connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleClose = () => {
    setSelectedImage(null);
    setResult(null);
    setError('');
    onClose();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-2xl shadow-2xl z-[10000] overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <Bug size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">AI Plant Disease Detection</h2>
                  <p className="text-xs text-emerald-100">Upload an image for instant diagnosis</p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Image Upload */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Upload Image</h3>
                  
                  {!selectedImage ? (
                    <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon size={48} className="text-gray-400 group-hover:text-emerald-500 mb-4 transition-colors" />
                        <p className="mb-2 text-sm text-gray-500 group-hover:text-emerald-600">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400">PNG, JPG or JPEG (MAX. 10MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  ) : (
                    <div className="relative">
                      <img
                        src={selectedImage}
                        alt="Selected plant"
                        className="w-full h-80 object-cover rounded-xl border border-gray-200"
                      />
                      <button
                        onClick={() => {
                          setSelectedImage(null);
                          setResult(null);
                          setError('');
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {selectedImage && !result && (
                    <button
                      onClick={analyzeImage}
                      disabled={isAnalyzing}
                      className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-medium transition-all"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Analyzing with AI...</span>
                        </>
                      ) : (
                        <>
                          <Bug size={18} />
                          <span>Analyze Disease</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Right: Results */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Analysis Results</h3>

                  {!selectedImage && !result && (
                    <div className="flex flex-col items-center justify-center h-80 text-center text-gray-400">
                      <Upload size={48} className="mb-4 opacity-50" />
                      <p className="text-sm">Upload an image to get started</p>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center h-80 text-center">
                      <Loader2 size={48} className="text-emerald-600 animate-spin mb-4" />
                      <p className="text-sm text-gray-600">Analyzing plant health...</p>
                      <p className="text-xs text-gray-400 mt-2">Using AI vision model</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex flex-col items-center justify-center h-80 text-center p-6">
                      <AlertCircle size={48} className="text-red-500 mb-4" />
                      <p className="text-sm text-red-600 font-semibold mb-2">Analysis Failed</p>
                      <p className="text-xs text-gray-500">{error}</p>
                    </div>
                  )}

                  {result && (
                    <div className="space-y-4">
                      {/* Disease Name & Confidence */}
                      <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-bold text-gray-900">{result.disease}</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getSeverityColor(result.severity)}`}>
                            {result.severity}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full rounded-full transition-all"
                              style={{ width: `${result.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-emerald-700">{result.confidence}%</span>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</h5>
                        <p className="text-sm text-gray-700 leading-relaxed">{result.description}</p>
                      </div>

                      {/* Treatment */}
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center space-x-2">
                          <CheckCircle size={14} />
                          <span>Recommended Treatment</span>
                        </h5>
                        <p className="text-sm text-gray-700 leading-relaxed">{result.treatment}</p>
                      </div>

                      {/* Analyze Another */}
                      <button
                        onClick={() => {
                          setSelectedImage(null);
                          setResult(null);
                          setError('');
                        }}
                        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        Analyze Another Image
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Info */}
              <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>🤖 Powered by Google Gemini AI</span>
                  <span>•</span>
                  <span>Real-time Analysis</span>
                </div>
                <span className="text-gray-400">AgriSense v1.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
