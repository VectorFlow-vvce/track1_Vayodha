import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Activity, FileText, Loader2, Leaf, Satellite, QrCode, X, Smartphone, Wifi, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { Map, Field, FieldStatus } from './components/Map';
import { Metrics } from './components/Metrics';
import { ReportModal } from './components/ReportModal';
import { FieldDetailsModal } from './components/FieldDetailsModal';
import { DroneCameraModal } from './components/DroneCameraModal';

export type DemoState = 'IDLE' | 'SATELLITE_PASS' | 'DEPLOYING' | 'SCANNING' | 'ANALYZING' | 'REPORT_READY' | 'FIELD_SCAN';

const initialFields: Field[] = [
  { id: 'A', name: 'Field A', path: [[13.8920, 75.2380], [13.8930, 75.2380], [13.8930, 75.2400], [13.8920, 75.2400]], center: [13.8925, 75.2390], status: 'idle' },
  { id: 'B', name: 'Field B', path: [[13.8920, 75.2405], [13.8930, 75.2405], [13.8930, 75.2425], [13.8920, 75.2425]], center: [13.8925, 75.2415], status: 'idle' },
  { id: 'C', name: 'Field C', path: [[13.8920, 75.2430], [13.8930, 75.2430], [13.8930, 75.2450], [13.8920, 75.2450]], center: [13.8925, 75.2440], status: 'idle' },
  { id: 'D', name: 'Field D', path: [[13.8880, 75.2380], [13.8890, 75.2380], [13.8890, 75.2400], [13.8880, 75.2400]], center: [13.8885, 75.2390], status: 'idle' },
  { id: 'E', name: 'Field E', path: [[13.8880, 75.2405], [13.8890, 75.2405], [13.8890, 75.2425], [13.8880, 75.2425]], center: [13.8885, 75.2415], status: 'idle' },
  { id: 'F', name: 'Field F', path: [[13.8880, 75.2430], [13.8890, 75.2430], [13.8890, 75.2450], [13.8880, 75.2450]], center: [13.8885, 75.2440], status: 'idle' },
];

// Disease assignment per field for the demo
const FIELD_RESULTS: Record<string, FieldStatus> = {
  A: 'healthy', B: 'healthy', C: 'disease', D: 'healthy', E: 'stressed', F: 'healthy',
};

export default function App() {
  const [demoState, setDemoState] = useState<DemoState>('IDLE');
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('System ready.');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [activeFieldScan, setActiveFieldScan] = useState<string | null>(null);
  const [qrField, setQrField] = useState<Field | null>(null);
  const [connectedFarmers, setConnectedFarmers] = useState<Record<string, boolean>>({});
  const [localIp, setLocalIp] = useState(window.location.hostname);
  const [showDroneCam, setShowDroneCam] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  
  const [metrics, setMetrics] = useState({
    temperature: 24.5,
    humidity: 65,
    solar: 850,
    wind: 3.2,
    soil: 45
  });

  // Get base URL using server-detected IP
  const baseUrl = `http://${localIp}:3000`;

  // ─── Socket.io Connection ──────────────────────────────────────────────────
  useEffect(() => {
    const host = window.location.hostname;
    const s = io(`http://${host}:3001`);
    socketRef.current = s;

    s.on('connect', () => {
      console.log('[HQ] Connected to sync server');
    });

    // Receive the actual local network IP from the server
    s.on('localIp', (ip: string) => {
      console.log('[HQ] Local IP:', ip);
      setLocalIp(ip);
    });

    s.on('farmerConnected', ({ fieldId }: { fieldId: string }) => {
      setConnectedFarmers(prev => ({ ...prev, [fieldId]: true }));
      // Close QR modal if this field was being shown
      setQrField(prev => prev?.id === fieldId ? null : prev);
    });

    s.on('farmerDisconnected', ({ fieldId }: { fieldId: string }) => {
      setConnectedFarmers(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    });

    s.on('scanRequested', ({ fieldId }: { fieldId: string }) => {
      // A farmer requested a scan — trigger single-field drone scan
      handleFieldScan(fieldId);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // Simulate metrics fluctuation during scan
  useEffect(() => {
    let interval: number;
    if (demoState === 'SCANNING' || demoState === 'FIELD_SCAN') {
      interval = window.setInterval(() => {
        setMetrics(prev => ({
          temperature: prev.temperature + (Math.random() * 0.4 - 0.2),
          humidity: Math.max(0, Math.min(100, prev.humidity + (Math.random() * 2 - 1))),
          solar: Math.max(0, prev.solar + (Math.random() * 20 - 10)),
          wind: Math.max(0, prev.wind + (Math.random() * 0.6 - 0.3)),
          soil: Math.max(0, Math.min(100, prev.soil + (Math.random() * 1 - 0.5)))
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [demoState]);

  // ─── Full Demo (Satellite + All Drones) ────────────────────────────────────
  const handleStartScan = () => {
    setDemoState('SATELLITE_PASS');
    setScanMessage('Acquiring satellite lock... Orbital pass initiated.');
    setScanProgress(0);

    let progress = 0;
    const satInterval = setInterval(() => {
      progress += 2;
      setScanProgress(Math.min(progress, 100));

      if (progress === 10) setScanMessage('Satellite Pass 1 — Multispectral imaging...');
      if (progress === 30) setScanMessage('Satellite Pass 2 — NDVI data acquisition...');
      if (progress === 60) setScanMessage('Satellite Pass 3 — Thermal band capture...');
      if (progress === 85) setScanMessage('Processing orbital imagery... Identifying targets...');

      if (progress >= 100) {
        clearInterval(satInterval);
        setScanMessage('Satellite scan complete. Anomalies detected → Deploying drones...');
        setScanProgress(0);
        setTimeout(() => {
          setDemoState('DEPLOYING');
          setScanMessage('Drone swarm lifting off from base station...');
          setTimeout(() => {
            setDemoState('SCANNING');
            startScanningSimulation();
          }, 2500);
        }, 1200);
      }
    }, 100);
  };

  const startScanningSimulation = () => {
    setScanMessage('Scanning Northern Fields...');
    let progress = 0;
    
    const scanInterval = setInterval(() => {
      progress += 1;
      setScanProgress(progress);
      
      if (progress === 5) {
        updateFieldStatus('A', 'scanning');
        updateFieldStatus('B', 'scanning');
        updateFieldStatus('C', 'scanning');
      }
      if (progress === 50) {
        updateFieldStatus('A', 'scanned');
        updateFieldStatus('B', 'scanned');
        updateFieldStatus('C', 'scanned');
        updateFieldStatus('D', 'scanning');
        updateFieldStatus('E', 'scanning');
        updateFieldStatus('F', 'scanning');
        setScanMessage('Scanning Southern Fields...');
      }
      if (progress >= 100) {
        clearInterval(scanInterval);
        updateFieldStatus('D', 'scanned');
        updateFieldStatus('E', 'scanned');
        updateFieldStatus('F', 'scanned');
        setScanMessage('Scan complete. Drones returning to base.');
        setTimeout(() => {
          handleScanComplete();
        }, 2000);
      }
    }, 100);
  };

  const handleScanComplete = () => {
    setDemoState(prevState => {
      if (prevState === 'SCANNING') {
        setScanMessage('Analyzing crop imagery...');
        setTimeout(() => {
          finishAnalysis();
        }, 3000);
        return 'ANALYZING';
      }
      return prevState;
    });
  };

  const finishAnalysis = () => {
    setFields(prev => prev.map(f => ({ ...f, status: FIELD_RESULTS[f.id] || 'healthy' })));
    setDemoState('REPORT_READY');
    setScanMessage('Analysis complete. Report generated.');
  };

  // ─── Single-Field Drone Scan (triggered by Farmer App) ────────────────────
  const handleFieldScan = (fieldId: string) => {
    setActiveFieldScan(fieldId);
    setDemoState('FIELD_SCAN');
    updateFieldStatus(fieldId, 'scanning');
    setScanMessage(`Drone deploying to ${fieldId}...`);
    setScanProgress(0);

    let progress = 0;
    const fieldScanInterval = setInterval(() => {
      progress += 1;
      setScanProgress(progress);

      if (progress === 10) setScanMessage(`Drone scanning Field ${fieldId}...`);
      if (progress === 50) setScanMessage(`Capturing multispectral data...`);
      if (progress === 80) setScanMessage(`Running crop analysis on Field ${fieldId}...`);

      if (progress >= 100) {
        clearInterval(fieldScanInterval);
        const result = FIELD_RESULTS[fieldId] || 'healthy';
        updateFieldStatus(fieldId, result);
        setDemoState('IDLE');
        setActiveFieldScan(null);
        setScanMessage(`Field ${fieldId} scan complete: ${result}.`);
        setScanProgress(0);

        // Notify farmer via socket
        if (socketRef.current) {
          socketRef.current.emit('scanComplete', { fieldId, status: result });
        }
      }
    }, 100);
  };

  const updateFieldStatus = (id: string, status: FieldStatus) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  const resetDemo = () => {
    setDemoState('IDLE');
    setFields(initialFields);
    setScanProgress(0);
    setScanMessage('System ready.');
    setIsReportOpen(false);
    setSelectedField(null);
    setActiveFieldScan(null);
    if (socketRef.current) {
      socketRef.current.emit('resetDemo');
    }
  };

  const handleFieldSelect = (field: Field) => {
    setIsReportOpen(false);
    setSelectedField(field);
  };

  const handleFieldClick = (field: Field) => {
    if (demoState === 'REPORT_READY') {
      setSelectedField(field);
    } else if (demoState === 'IDLE') {
      // Show QR code for this field
      setQrField(field);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 p-2 rounded-lg text-white">
            <Leaf size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none">AgriSense</h1>
            <p className="text-sm text-emerald-700 font-medium mt-1">AI for Every Acre.</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* Connected farmers count */}
          {Object.keys(connectedFarmers).length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-full">
              <Smartphone size={14} />
              <span>{Object.keys(connectedFarmers).length} Farmer{Object.keys(connectedFarmers).length > 1 ? 's' : ''} Connected</span>
            </div>
          )}
          <div className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded-full">
            Demo Village
          </div>
          <div className="flex items-center space-x-2 text-sm font-medium">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${demoState !== 'IDLE' ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${demoState !== 'IDLE' ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
            </span>
            <span className="text-gray-600">
              {demoState === 'IDLE' ? 'System Standby' : demoState === 'FIELD_SCAN' ? `Scanning Field ${activeFieldScan}` : 'System Active'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 flex gap-6 overflow-hidden">
        
        {/* Left Sidebar / Control Panel */}
        <div className="w-80 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6">Control Panel</h2>
            
            <div className="space-y-4 flex-1">
              <button
                onClick={handleStartScan}
                disabled={demoState !== 'IDLE'}
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  demoState === 'IDLE' 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Satellite size={18} />
                <span>Start Satellite Scan</span>
              </button>

              <button
                disabled={demoState !== 'SATELLITE_PASS'}
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  demoState === 'SATELLITE_PASS' 
                    ? 'bg-violet-600 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {demoState === 'SATELLITE_PASS' ? <Loader2 size={18} className="animate-spin" /> : <Satellite size={18} />}
                <span>{demoState === 'SATELLITE_PASS' ? 'Satellite Passing...' : 'Satellite Pass'}</span>
              </button>

              <button
                disabled={demoState !== 'DEPLOYING' && demoState !== 'SCANNING' && demoState !== 'FIELD_SCAN'}
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  demoState === 'DEPLOYING' || demoState === 'SCANNING' || demoState === 'FIELD_SCAN'
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {(demoState === 'DEPLOYING' || demoState === 'FIELD_SCAN') ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                <span>{demoState === 'DEPLOYING' ? 'Deploying Drones...' : demoState === 'FIELD_SCAN' ? `Scanning Field ${activeFieldScan}...` : 'Drone Scanning...'}</span>
              </button>

              <button
                disabled={demoState !== 'ANALYZING'}
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  demoState === 'ANALYZING' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {demoState === 'ANALYZING' ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
                <span>{demoState === 'ANALYZING' ? 'Running AI Analysis...' : 'Run AI Analysis'}</span>
              </button>

              <button
                onClick={() => setIsReportOpen(true)}
                disabled={demoState !== 'REPORT_READY'}
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  demoState === 'REPORT_READY' 
                    ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm hover:shadow' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <FileText size={18} />
                <span>View Farmer Report</span>
              </button>

              <button
                onClick={() => setShowDroneCam(true)}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm hover:shadow"
              >
                <Camera size={18} />
                <span>Live Drone Camera</span>
              </button>
            </div>

            {demoState !== 'IDLE' && (
              <button onClick={resetDemo} className="mt-4 text-sm text-gray-500 hover:text-gray-900 font-medium text-center w-full transition-colors">
                Reset Demo
              </button>
            )}
          </div>

          {/* Connected Farmers */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Farmer Devices</h2>
            {Object.keys(connectedFarmers).length === 0 ? (
              <p className="text-xs text-gray-400">Click a field on the map to generate a QR code for farmers to connect.</p>
            ) : (
              <div className="space-y-2">
                {Object.keys(connectedFarmers).map(fId => (
                  <div key={fId} className="flex items-center justify-between bg-emerald-50 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wifi size={14} className="text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-700">Field {fId}</span>
                    </div>
                    <span className="text-xs text-emerald-500 font-medium">Connected</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Metrics Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Live Telemetry</h2>
            <Metrics metrics={metrics} />
          </div>
        </div>

        {/* Center / Map Area */}
        <div className="flex-1 relative flex flex-col z-0">
          <Map 
            fields={fields} 
            demoState={demoState}
            activeFieldScan={activeFieldScan}
            onFieldClick={handleFieldClick}
          />
          
          {/* Floating Status Panel */}
          <AnimatePresence>
            {demoState !== 'IDLE' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-lg border border-gray-200/50 min-w-[320px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{scanMessage}</span>
                  {(demoState === 'SATELLITE_PASS' || demoState === 'SCANNING' || demoState === 'FIELD_SCAN') && <span className="text-sm font-mono text-emerald-600">{scanProgress}%</span>}
                </div>
                
                {(demoState === 'SATELLITE_PASS' || demoState === 'SCANNING' || demoState === 'FIELD_SCAN') && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full ${demoState === 'SATELLITE_PASS' ? 'bg-violet-500' : demoState === 'FIELD_SCAN' ? 'bg-cyan-500' : 'bg-emerald-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ ease: "linear", duration: 0.2 }}
                    />
                  </div>
                )}
                
                {demoState === 'ANALYZING' && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ ease: "easeInOut", duration: 3 }}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrField && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setQrField(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Connect to {qrField.name}</h3>
                  <p className="text-sm text-gray-500">Scan with your phone to join</p>
                </div>
                <button onClick={() => setQrField(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-center mb-6">
                <QRCodeSVG 
                  value={`${baseUrl}/farmer/${qrField.id}`}
                  size={200}
                  bgColor="transparent"
                  fgColor="#1f2937"
                  level="M"
                />
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-2 rounded-lg">
                  {baseUrl}/farmer/{qrField.id}
                </p>
                {connectedFarmers[qrField.id] && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-emerald-600 text-sm font-medium">
                    <Wifi size={14} />
                    <span>Farmer Connected!</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReportModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        fields={fields}
        onFieldSelect={handleFieldSelect}
      />
      <FieldDetailsModal 
        isOpen={selectedField !== null} 
        onClose={() => setSelectedField(null)} 
        field={selectedField} 
      />
      <DroneCameraModal 
        isOpen={showDroneCam} 
        onClose={() => setShowDroneCam(false)} 
      />
    </div>
  );
}
