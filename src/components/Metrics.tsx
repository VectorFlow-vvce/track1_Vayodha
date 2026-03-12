import React from 'react';
import { motion } from 'motion/react';
import { Thermometer, Droplets, Sun, Wind, Sprout } from 'lucide-react';

interface MetricsProps {
  metrics: {
    temperature: number;
    humidity: number;
    solar: number;
    wind: number;
    soil: number;
  };
}

export function Metrics({ metrics }: MetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-6">
      <MetricCard icon={<Thermometer size={16} />} label="Temperature" value={`${metrics.temperature.toFixed(1)}°C`} />
      <MetricCard icon={<Droplets size={16} />} label="Humidity" value={`${metrics.humidity.toFixed(0)}%`} />
      <MetricCard icon={<Sun size={16} />} label="Solar Index" value={`${metrics.solar.toFixed(0)} W/m²`} />
      <MetricCard icon={<Wind size={16} />} label="Wind Speed" value={`${metrics.wind.toFixed(1)} m/s`} />
      <MetricCard icon={<Sprout size={16} />} label="Soil Moisture" value={`${metrics.soil.toFixed(0)}%`} className="col-span-2" />
    </div>
  );
}

function MetricCard({ icon, label, value, className = '' }: { icon: React.ReactNode, label: string, value: string, className?: string }) {
  return (
    <div className={`bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center space-x-3 ${className}`}>
      <div className="text-emerald-600 bg-emerald-100/50 p-2 rounded-lg">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
        <div className="text-sm font-mono font-medium text-gray-900">{value}</div>
      </div>
    </div>
  );
}
