import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Globe } from 'lucide-react';
import { DemoState } from '../App';

export type FieldStatus = 'idle' | 'scanning' | 'scanned' | 'healthy' | 'stressed' | 'disease';

export interface Field {
  id: string;
  name: string;
  path: [number, number][];
  center: [number, number];
  status: FieldStatus;
}

interface MapProps {
  fields: Field[];
  demoState: DemoState;
  onFieldClick?: (field: Field) => void;
}

const BASE_STATION: [number, number] = [13.890252, 75.242048];
const MAP_CENTER: [number, number] = [13.890252, 75.242048];

const droneHtml = `<div style="color: #1f2937; filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)); transform: rotate(-45deg);"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#1f2937" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L2.5 8.5L8 12l-4 4-2.5-.5-1.5 1.5 4.5 1.5 1.5 4.5 1.5-1.5-.5-2.5 4-4 3.5 5.5 1.7-1.2c.4-.2.7-.6.6-1.1Z"/></svg></div>`;

const droneIcon = L.divIcon({
  html: droneHtml,
  className: 'bg-transparent border-none',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const baseHtml = `<div style="position: relative; display: flex; align-items: center; justify-content: center;">
  <div style="width: 24px; height: 24px; background-color: #1f2937; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
    <div style="width: 8px; height: 8px; background-color: #34d399; border-radius: 50%;"></div>
  </div>
  <div style="position: absolute; top: 28px; font-size: 10px; font-weight: bold; color: #1f2937; background-color: rgba(255,255,255,0.9); padding: 2px 4px; border-radius: 4px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);">BASE</div>
</div>`;

const baseIcon = L.divIcon({
  html: baseHtml,
  className: 'bg-transparent border-none',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Helper for interpolation
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const lerpLatLng = (start: [number, number], end: [number, number], t: number): [number, number] => [
  lerp(start[0], end[0], t),
  lerp(start[1], end[1], t)
];
const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

function getPointAlongPath(path: [number, number][], t: number): [number, number] {
  if (t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];
  
  const totalSegments = path.length - 1;
  const scaledT = t * totalSegments;
  const index = Math.floor(scaledT);
  const segmentT = scaledT - index;
  
  const start = path[index];
  const end = path[index + 1];
  
  return [
    start[0] + (end[0] - start[0]) * segmentT,
    start[1] + (end[1] - start[1]) * segmentT
  ];
}

function generateZigZag(field: Field): [number, number][] {
  const [[lat1, lng1], [lat2, lng2], [lat3, lng3], [lat4, lng4]] = field.path;
  return [
    [lat1, lng1],
    [lat2, lng2],
    [(lat2+lat3)/2, (lng2+lng3)/2],
    [(lat1+lat4)/2, (lng1+lng4)/2],
    [lat4, lng4],
    [lat3, lng3]
  ];
}

export function Map({ fields, demoState, onFieldClick }: MapProps) {
  const [d1, setD1] = useState<[number, number]>(BASE_STATION);
  const [d2, setD2] = useState<[number, number]>(BASE_STATION);
  const [d3, setD3] = useState<[number, number]>(BASE_STATION);
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite'>('osm');

  useEffect(() => {
    let startTime = Date.now();
    let animationFrameId: number;
    
    const startD1 = d1;
    const startD2 = d2;
    const startD3 = d3;

    // Precompute paths for scanning
    const path1 = [startD1, ...generateZigZag(fields[0]), ...generateZigZag(fields[3]), fields[3].center];
    const path2 = [startD2, ...generateZigZag(fields[1]), ...generateZigZag(fields[4]), fields[4].center];
    const path3 = [startD3, ...generateZigZag(fields[2]), ...generateZigZag(fields[5]), fields[5].center];

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (demoState === 'DEPLOYING') {
        const t = Math.min(elapsed / 2000, 1);
        const easeT = easeInOutQuad(t);
        setD1(lerpLatLng(startD1, path1[0], easeT));
        setD2(lerpLatLng(startD2, path2[0], easeT));
        setD3(lerpLatLng(startD3, path3[0], easeT));
      } else if (demoState === 'SCANNING') {
        const t = Math.min(elapsed / 10000, 1); // 10 seconds scan
        setD1(getPointAlongPath(path1, t));
        setD2(getPointAlongPath(path2, t));
        setD3(getPointAlongPath(path3, t));
      } else if (demoState === 'ANALYZING') {
        const t = Math.min(elapsed / 2000, 1);
        const easeT = easeInOutQuad(t);
        setD1(lerpLatLng(startD1, BASE_STATION, easeT));
        setD2(lerpLatLng(startD2, BASE_STATION, easeT));
        setD3(lerpLatLng(startD3, BASE_STATION, easeT));
      } else if (demoState === 'IDLE') {
        setD1(BASE_STATION);
        setD2(BASE_STATION);
        setD3(BASE_STATION);
      }

      if (elapsed < 10000) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => cancelAnimationFrame(animationFrameId);
  }, [demoState]); // Only re-run when demoState changes

  const getPathOptions = (status: FieldStatus) => {
    switch (status) {
      case 'idle': return { color: '#cbd5e1', fillColor: '#f8fafc', fillOpacity: 0.4, weight: 2 };
      case 'scanning': return { color: '#3b82f6', fillColor: '#dbeafe', fillOpacity: 0.6, weight: 2 };
      case 'scanned': return { color: '#94a3b8', fillColor: '#f1f5f9', fillOpacity: 0.4, weight: 2 };
      case 'healthy': return { color: '#10b981', fillColor: '#d1fae5', fillOpacity: 0.6, weight: 2 };
      case 'stressed': return { color: '#eab308', fillColor: '#fef08a', fillOpacity: 0.6, weight: 2 };
      case 'disease': return { color: '#ef4444', fillColor: '#fee2e2', fillOpacity: 0.6, weight: 2 };
      default: return { color: '#cbd5e1', fillColor: '#f8fafc', fillOpacity: 0.4, weight: 2 };
    }
  };

  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative z-0">
      <MapContainer 
        center={MAP_CENTER} 
        zoom={16} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        attributionControl={false}
      >
        {mapStyle === 'osm' ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        ) : (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
          />
        )}
        
        {fields.map((field) => (
          <Polygon 
            key={field.id} 
            positions={field.path} 
            pathOptions={getPathOptions(field.status)}
            eventHandlers={{
              click: () => onFieldClick && onFieldClick(field)
            }}
          >
            <Tooltip direction="center" permanent className="bg-transparent border-none shadow-none text-xs font-bold text-gray-700 drop-shadow-md">
              {field.name}
            </Tooltip>
          </Polygon>
        ))}

        <Marker position={BASE_STATION} icon={baseIcon} />
        
        {(demoState !== 'IDLE') && (
          <>
            <Marker position={d1} icon={droneIcon} />
            <Marker position={d2} icon={droneIcon} />
            <Marker position={d3} icon={droneIcon} />
          </>
        )}
      </MapContainer>

      {/* Map Style Toggle */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setMapStyle(mapStyle === 'osm' ? 'satellite' : 'osm')}
          className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/50 hover:bg-white transition-all duration-200 group flex items-center justify-center"
          title={mapStyle === 'osm' ? 'Switch to Satellite' : 'Switch to Street View'}
        >
          {mapStyle === 'osm' ? (
            <Globe className="w-5 h-5 text-gray-700 group-hover:text-blue-600" />
          ) : (
            <Layers className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
          )}
          <span className="ml-2 text-sm font-semibold text-gray-700 pr-1">
            {mapStyle === 'osm' ? 'Satellite' : 'Street'}
          </span>
        </button>
      </div>
    </div>
  );
}
