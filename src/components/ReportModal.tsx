import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, Droplets, ChevronRight } from 'lucide-react';
import { Field } from './Map';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: Field[];
  onFieldSelect: (field: Field) => void;
}

export function ReportModal({ isOpen, onClose, fields, onFieldSelect }: ReportModalProps) {
  const healthyCount = fields.filter(f => f.status === 'healthy').length;
  const overallHealth = Math.round((healthyCount / fields.length) * 100) || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-xl z-[10000] overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">AgriSense Daily Survey</h2>
                <p className="text-sm text-gray-500 mt-1">Location: Shimoga, Karnataka • Fields Scanned: {fields.length}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="text-emerald-600" size={24} />
                  <div>
                    <div className="text-sm font-medium text-emerald-900">Overall Crop Health</div>
                    <div className="text-xs text-emerald-700">Based on AI analysis of {fields.length} fields</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-emerald-700">{overallHealth}%</div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Field Reports</h3>
                <div className="space-y-3">
                  {fields.map(field => (
                    <button
                      key={field.id}
                      onClick={() => onFieldSelect(field)}
                      className="w-full text-left p-4 border border-gray-100 hover:border-indigo-200 hover:shadow-md bg-white rounded-xl flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        {field.status === 'disease' ? (
                          <div className="bg-red-100 p-2 rounded-lg text-red-600"><AlertTriangle size={20} /></div>
                        ) : field.status === 'stressed' ? (
                          <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600"><Droplets size={20} /></div>
                        ) : (
                          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><CheckCircle2 size={20} /></div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-gray-900">{field.name}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {field.status === 'disease' ? 'Early Blight Detected' : field.status === 'stressed' ? 'Water Stress Detected' : 'Optimal Health'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {field.status !== 'healthy' && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${field.status === 'disease' ? 'text-red-700 bg-red-50' : 'text-yellow-800 bg-yellow-50'}`}>
                            Action Required
                          </span>
                        )}
                        <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={onClose} className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm">
                Close Report
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
