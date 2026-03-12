import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Leaf, Radar, ShieldCheck, AlertTriangle, Bug, Send } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

type FarmerPhase = 'CONNECTING' | 'IDLE' | 'REQUESTING' | 'SCANNING' | 'REPORT';

interface FieldReport {
  status: 'healthy' | 'stressed' | 'disease';
}

const FIELD_INFO: Record<string, { name: string; crop: string; area: string }> = {
  A: { name: 'Field A', crop: 'Rice (Paddy)', area: '2.4 acres' },
  B: { name: 'Field B', crop: 'Sugarcane', area: '3.1 acres' },
  C: { name: 'Field C', crop: 'Wheat', area: '1.8 acres' },
  D: { name: 'Field D', crop: 'Cotton', area: '2.7 acres' },
  E: { name: 'Field E', crop: 'Maize', area: '2.0 acres' },
  F: { name: 'Field F', crop: 'Soybean', area: '1.5 acres' },
};

const STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: ShieldCheck,
    message: 'Your crops are in excellent condition. No action needed.',
    recommendation: 'Continue current irrigation schedule. Next scan recommended in 7 days.',
  },
  stressed: {
    label: 'Water Stress Detected',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    icon: AlertTriangle,
    message: 'Signs of water stress detected in the central region of your field.',
    recommendation: 'Increase irrigation by 20% for the next 3 days. Consider drip irrigation for affected zones.',
  },
  disease: {
    label: 'Disease Detected',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: Bug,
    message: 'Fungal infection detected (likely Blast disease). Immediate action required.',
    recommendation: 'Apply Tricyclazole fungicide at 0.6g/L. Isolate affected area. Request agronomist visit.',
  },
};

export function FarmerApp() {
  const { fieldId } = useParams<{ fieldId: string }>();
  const [phase, setPhase] = useState<FarmerPhase>('CONNECTING');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  const field = FIELD_INFO[fieldId || 'A'] || FIELD_INFO['A'];
  const fId = fieldId || 'A';

  // Connect to socket server
  useEffect(() => {
    const host = window.location.hostname;
    const s = io(`http://${host}:3001`);
    setSocket(s);

    s.on('connect', () => {
      s.emit('joinField', fId);
      setPhase('IDLE');
    });

    s.on('scanRequested', ({ fieldId: reqId }) => {
      if (reqId === fId) {
        setPhase('SCANNING');
        setScanProgress(0);
        // Simulate progress
        let p = 0;
        const interval = setInterval(() => {
          p += 1;
          setScanProgress(p);
          if (p >= 100) clearInterval(interval);
        }, 100);
      }
    });

    s.on('fieldReport', ({ fieldId: repId, status }) => {
      if (repId === fId) {
        setReport({ status });
        setPhase('REPORT');
        // Vibrate the phone
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    });

    return () => {
      s.disconnect();
    };
  }, [fId]);

  const handleRequestScan = () => {
    if (socket) {
      setPhase('REQUESTING');
      socket.emit('requestScan', fId);
    }
  };

  const statusConf = report ? STATUS_CONFIG[report.status] : null;
  const StatusIcon = statusConf?.icon || ShieldCheck;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white font-sans flex flex-col items-center px-4 py-6 select-none" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-2"
      >
        <div className="bg-emerald-600 p-2 rounded-xl">
          <Leaf size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-none">AgriSense</h1>
          <p className="text-xs text-emerald-400 font-medium">Farmer Portal</p>
        </div>
      </motion.div>

      {/* Field Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="w-full max-w-sm bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 mt-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">{field.name}</h2>
          <span className="text-xs text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full font-semibold">{fId}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-0.5">Crop</p>
            <p className="text-white font-medium">{field.crop}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-0.5">Area</p>
            <p className="text-white font-medium">{field.area}</p>
          </div>
        </div>
      </motion.div>

      {/* Dynamic Phase Content */}
      <div className="flex-1 w-full max-w-sm flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">

          {/* CONNECTING */}
          {phase === 'CONNECTING' && (
            <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-slate-400">Connecting to AgriSense HQ...</p>
            </motion.div>
          )}

          {/* IDLE — Request Scan Button */}
          {phase === 'IDLE' && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full flex flex-col items-center">
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={handleRequestScan}
                className="w-full py-5 px-6 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl font-bold text-lg text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-3 active:shadow-emerald-600/50 transition-shadow"
              >
                <Send size={22} />
                <span>Request Drone Scan</span>
              </motion.button>
              <p className="text-xs text-slate-500 mt-4 text-center">Tap to deploy a drone to your field for a detailed crop health assessment.</p>
            </motion.div>
          )}

          {/* REQUESTING — Brief transition */}
          {phase === 'REQUESTING' && (
            <motion.div key="requesting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-slate-400">Sending request to HQ...</p>
            </motion.div>
          )}

          {/* SCANNING — Radar + Progress */}
          {phase === 'SCANNING' && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col items-center">
              {/* Radar animation */}
              <div className="relative w-40 h-40 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/20"></div>
                <div className="absolute inset-4 rounded-full border border-blue-500/15"></div>
                <div className="absolute inset-8 rounded-full border border-blue-500/10"></div>
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div
                    className="absolute top-1/2 left-1/2 w-1/2 h-1/2 origin-top-left"
                    style={{
                      background: 'conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.3) 60deg, transparent 60deg)',
                      animation: 'radarSweep 2s linear infinite',
                    }}
                  ></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Radar size={28} className="text-blue-400 animate-pulse" />
                </div>
              </div>

              <p className="text-sm font-semibold text-blue-300 mb-2">Drone Scanning Field {fId}...</p>
              
              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                  style={{ width: `${scanProgress}%` }}
                  transition={{ ease: 'linear', duration: 0.1 }}
                />
              </div>
              <p className="text-xs text-slate-500 font-mono">{scanProgress}% complete</p>

              {/* Live telemetry on phone */}
              <div className="w-full mt-6 grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">NDVI</p>
                  <p className="text-lg font-bold text-emerald-400 font-mono">{(0.6 + Math.random() * 0.15).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Moisture</p>
                  <p className="text-lg font-bold text-blue-400 font-mono">{Math.floor(35 + Math.random() * 15)}%</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* REPORT — Final Results */}
          {phase === 'REPORT' && statusConf && (
            <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
              <div className={`w-full ${statusConf.bg} border ${statusConf.border} rounded-2xl p-5 mb-4`}>
                <div className="flex items-center gap-3 mb-3">
                  <StatusIcon size={24} className={statusConf.color} />
                  <h3 className={`text-base font-bold ${statusConf.color}`}>{statusConf.label}</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{statusConf.message}</p>
                <div className="bg-black/20 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Recommendation</p>
                  <p className="text-sm text-white/80 leading-relaxed">{statusConf.recommendation}</p>
                </div>
              </div>

              <button
                onClick={() => { setPhase('IDLE'); setReport(null); setScanProgress(0); }}
                className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Request Another Scan
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-slate-600 mt-6">AgriSense v1.0 · Powered by AI</p>
    </div>
  );
}
