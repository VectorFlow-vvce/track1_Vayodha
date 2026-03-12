import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Droplets, Thermometer, Wind, Sprout, Map as MapIcon } from 'lucide-react';
import { Field } from './Map';

interface FieldDetailsModalProps {
  field: Field | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FieldDetailsModal({ field, isOpen, onClose }: FieldDetailsModalProps) {
  if (!field) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-700 bg-emerald-100 border-emerald-200';
      case 'stressed': return 'text-yellow-800 bg-yellow-100 border-yellow-200';
      case 'disease': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'Optimal Health';
      case 'stressed': return 'Water Stress Detected';
      case 'disease': return 'Early Blight Detected';
      default: return 'Pending Analysis';
    }
  };

  // Generate deterministic random-looking data based on field ID
  const seed = field.id.charCodeAt(0);
  const cropType = seed % 2 === 0 ? 'Wheat' : 'Maize';
  const area = (seed * 1.2 % 5 + 2).toFixed(1);
  const moisture = field.status === 'stressed' ? 22 : 45 + (seed % 15);
  const ndvi = field.status === 'disease' ? 0.45 : field.status === 'stressed' ? 0.55 : 0.82;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[10000]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-[10001] overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-2xl font-bold text-gray-900">{field.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(field.status)}`}>
                    {getStatusText(field.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 flex items-center space-x-2">
                  <MapIcon size={14} />
                  <span>{field.center[0].toFixed(5)}, {field.center[1].toFixed(5)}</span>
                  <span>•</span>
                  <span>{area} Hectares</span>
                  <span>•</span>
                  <span>Crop: {cropType}</span>
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 bg-white shadow-sm border border-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* RGB Image */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center space-x-2">
                    <span>High-Res Optical</span>
                  </h3>
                  <div className="aspect-video rounded-xl overflow-hidden bg-gray-200 border border-gray-200 relative group">
                    <img 
                      src={`https://picsum.photos/seed/${field.id}optical/600/400`} 
                      alt="Optical" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium border border-white/50 px-4 py-2 rounded-lg backdrop-blur-sm">View Full Resolution</span>
                    </div>
                  </div>
                </div>

                {/* NDVI Image */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center space-x-2">
                    <span>Multispectral (NDVI)</span>
                  </h3>
                  <div className="aspect-video rounded-xl overflow-hidden bg-gray-200 border border-gray-200 relative group">
                    <img 
                      src={`https://picsum.photos/seed/${field.id}ndvi/600/400`} 
                      alt="NDVI" 
                      className="w-full h-full object-cover mix-blend-luminosity"
                      style={{ filter: field.status === 'disease' ? 'sepia(1) hue-rotate(-50deg) saturate(3)' : field.status === 'stressed' ? 'sepia(1) hue-rotate(10deg) saturate(2)' : 'sepia(1) hue-rotate(80deg) saturate(2)' }}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium border border-white/50 px-4 py-2 rounded-lg backdrop-blur-sm">Analyze Layers</span>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Field Telemetry & Analysis</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center space-x-2 text-gray-500 mb-2">
                    <Activity size={16} className="text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">NDVI Score</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{ndvi.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-1">Target: &gt; 0.75</div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center space-x-2 text-gray-500 mb-2">
                    <Droplets size={16} className="text-blue-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Soil Moisture</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{moisture}%</div>
                  <div className="text-xs text-gray-500 mt-1">Target: 40-60%</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center space-x-2 text-gray-500 mb-2">
                    <Thermometer size={16} className="text-orange-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Canopy Temp</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">26.4°C</div>
                  <div className="text-xs text-gray-500 mt-1">Ambient: 24.5°C</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center space-x-2 text-gray-500 mb-2">
                    <Sprout size={16} className="text-emerald-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Est. Yield</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{(Number(area) * (field.status === 'healthy' ? 4.2 : 3.1)).toFixed(1)} t</div>
                  <div className="text-xs text-gray-500 mt-1">Based on current health</div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
