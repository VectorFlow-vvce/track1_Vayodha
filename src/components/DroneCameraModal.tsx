import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Loader2, AlertCircle, Activity, Zap } from 'lucide-react';

interface DroneCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CameraStats {
  fps: number;
  detections: number;
  inference_time: number;
}

const CAMERA_SERVER_URL = 'http://localhost:5001';

export function DroneCameraModal({ isOpen, onClose }: DroneCameraModalProps) {
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [stats, setStats] = useState<CameraStats>({ fps: 0, detections: 0, inference_time: 0 });

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      if (isOpen) {
        stopCamera();
      }
    };
  }, [isOpen]);

  // Poll for stats while camera is active
  useEffect(() => {
    if (cameraStatus !== 'active') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/status`);
        const data = await response.json();
        if (data.active && data.stats) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch camera stats:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [cameraStatus]);

  const startCamera = async () => {
    setCameraStatus('starting');
    setErrorMessage('');

    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/start`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setCameraStatus('active');
      } else {
        setCameraStatus('error');
        setErrorMessage(data.message || 'Failed to start camera');
      }
    } catch (error) {
      setCameraStatus('error');
      setErrorMessage('Cannot connect to camera server. Make sure camera_server.py is running.');
      console.error('Camera start error:', error);
    }
  };

  const stopCamera = async () => {
    try {
      await fetch(`${CAMERA_SERVER_URL}/api/camera/stop`, {
        method: 'POST',
      });
      setCameraStatus('idle');
    } catch (error) {
      console.error('Camera stop error:', error);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-gray-900 rounded-2xl shadow-2xl z-[10000] overflow-hidden border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="bg-cyan-600 p-2 rounded-lg">
                  <Camera size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Live Drone Camera Feed</h2>
                  <p className="text-xs text-gray-400">Real-time crop detection & analysis</p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center space-x-4">
                {cameraStatus === 'active' && (
                  <div className="flex items-center space-x-2 bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">LIVE</span>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 bg-gray-900">
              {/* Video Feed Container */}
              <div className="relative bg-black rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                {cameraStatus === 'starting' && (
                  <div className="aspect-video flex flex-col items-center justify-center space-y-4">
                    <Loader2 size={48} className="text-cyan-500 animate-spin" />
                    <p className="text-gray-400 text-sm">Initializing drone camera...</p>
                    <p className="text-gray-500 text-xs">Loading RF-DETR detection model</p>
                  </div>
                )}

                {cameraStatus === 'error' && (
                  <div className="aspect-video flex flex-col items-center justify-center space-y-4 p-8">
                    <AlertCircle size={48} className="text-red-500" />
                    <p className="text-red-400 text-sm font-semibold">Camera Error</p>
                    <p className="text-gray-400 text-xs text-center max-w-md">{errorMessage}</p>
                    <button
                      onClick={startCamera}
                      className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Retry Connection
                    </button>
                    <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700 text-left">
                      <p className="text-xs text-gray-400 mb-2">To start the camera server:</p>
                      <code className="text-xs text-emerald-400 font-mono">
                        source venv/bin/activate<br />
                        python camera_server.py
                      </code>
                    </div>
                  </div>
                )}

                {cameraStatus === 'active' && (
                  <div className="relative">
                    <img
                      src={`${CAMERA_SERVER_URL}/video_feed`}
                      alt="Live Drone Camera Feed"
                      className="w-full h-auto"
                      style={{ maxHeight: '70vh' }}
                    />

                    {/* Live Stats Overlay */}
                    <div className="absolute top-4 right-4 space-y-2">
                      <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
                        <div className="flex items-center space-x-2">
                          <Activity size={14} className="text-cyan-400" />
                          <span className="text-xs font-mono text-white">{stats.fps} FPS</span>
                        </div>
                      </div>

                      <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
                        <div className="flex items-center space-x-2">
                          <Camera size={14} className="text-emerald-400" />
                          <span className="text-xs font-mono text-white">{stats.detections} Objects</span>
                        </div>
                      </div>

                      <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
                        <div className="flex items-center space-x-2">
                          <Zap size={14} className="text-yellow-400" />
                          <span className="text-xs font-mono text-white">{stats.inference_time}ms</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Info Footer */}
              {cameraStatus === 'active' && (
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>🤖 RF-DETR Nano Model</span>
                    <span>•</span>
                    <span>Real-time Segmentation</span>
                    <span>•</span>
                    <span>Multi-spectral Analysis</span>
                  </div>
                  <span className="text-gray-600">AgriSense v1.0</span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
