import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, Polyline, Rectangle } from 'react-leaflet';
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
  activeFieldScan?: string | null;
  onFieldClick?: (field: Field) => void;
}

const BASE_STATION: [number, number] = [13.890252, 75.242048];
const MAP_CENTER: [number, number] = [13.890252, 75.242048];

// ─── Satellite Configuration ─────────────────────────────────────────────────
// Realistic sun-synchronous orbital passes: slight diagonal SW→NE trajectory
// Each pass is staggered with a time offset for realism
const SAT_PATHS: { start: [number, number]; end: [number, number]; delay: number }[] = [
  { start: [13.8868, 75.2340], end: [13.8938, 75.2480], delay: 0 },      // Pass 1 — immediate
  { start: [13.8858, 75.2350], end: [13.8928, 75.2490], delay: 0.15 },   // Pass 2 — 15% delay
  { start: [13.8848, 75.2360], end: [13.8918, 75.2500], delay: 0.30 },   // Pass 3 — 30% delay
];

// Scan swath width in degrees (simulates sensor footprint)
const SWATH_WIDTH = 0.0008;

// Satellite icon — detailed with solar panels, body, and pulsing scan beam
const satelliteHtml = `<div style="position:relative; display:flex; align-items:center; justify-content:center; width:44px; height:44px;">
  <!-- Outer scan pulse -->
  <div style="position:absolute; width:44px; height:44px; border-radius:50%; border: 2px solid rgba(139,92,246,0.4); animation: satPulse 2s ease-out infinite;"></div>
  <!-- Inner glow -->
  <div style="position:absolute; width:28px; height:28px; border-radius:50%; background: radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%); animation: satGlow 1.5s ease-in-out infinite alternate;"></div>
  <!-- Satellite SVG -->
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 8px rgba(139,92,246,0.7)); position:relative; z-index:2;">
    <path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/>
    <path d="M10 14.5 6.5 18a2.41 2.41 0 0 0 0 3.4l.1.1a2.41 2.41 0 0 0 3.4 0L13.5 18"/>
    <path d="m12 12 4 4"/>
    <path d="m17 7 4.3 4.3a2.41 2.41 0 0 1 0 3.4l-2.6 2.6a2.41 2.41 0 0 1-3.4 0L11 13"/>
  </svg>
</div>`;

const satelliteIcon = L.divIcon({
  html: satelliteHtml,
  className: 'bg-transparent border-none',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

// ─── Drone Configuration ─────────────────────────────────────────────────────
// Drone with spinning rotor blades animation
// Note: Drone HTML is no longer static; it will be dynamically generated
// to include the live telemetry data and scanning lasers.

// Base station
const baseHtml = `<div style="position: relative; display: flex; align-items: center; justify-content: center;">
  <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #1f2937, #374151); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.2);">
    <div style="width: 8px; height: 8px; background-color: #34d399; border-radius: 50%; animation: basePulse 2s ease-in-out infinite;"></div>
  </div>
  <div style="position: absolute; top: 32px; font-size: 10px; font-weight: 700; color: #1f2937; background-color: rgba(255,255,255,0.95); padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgb(0 0 0 / 0.1); letter-spacing: 0.5px;">BASE</div>
</div>`;

const baseIcon = L.divIcon({
  html: baseHtml,
  className: 'bg-transparent border-none',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// ─── Animation Helpers ───────────────────────────────────────────────────────
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const lerpLatLng = (start: [number, number], end: [number, number], t: number): [number, number] => [
  lerp(start[0], end[0], t),
  lerp(start[1], end[1], t)
];
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

// Generate a proper lawnmower/boustrophedon survey pattern for a field
function generateSurveyPattern(field: Field, passes: number = 5): [number, number][] {
  const [[lat1, lng1], [lat2, lng2], [lat3, lng3], [lat4, lng4]] = field.path;
  const points: [number, number][] = [];
  
  for (let i = 0; i <= passes; i++) {
    const t = i / passes;
    if (i % 2 === 0) {
      // Left to right
      points.push([lerp(lat1, lat4, t), lerp(lng1, lng4, t)]);
      points.push([lerp(lat2, lat3, t), lerp(lng2, lng3, t)]);
    } else {
      // Right to left (boustrophedon — alternating direction like real surveys)
      points.push([lerp(lat2, lat3, t), lerp(lng2, lng3, t)]);
      points.push([lerp(lat1, lat4, t), lerp(lng1, lng4, t)]);
    }
  }
  
  return points;
}

// Compute the scan swath polygon for a satellite at a given position along its path
function computeSwathPolygon(
  pathStart: [number, number], 
  currentPos: [number, number], 
  swathWidth: number
): [number, number][] {
  // Calculate perpendicular offset based on the path direction
  const dlat = currentPos[0] - pathStart[0];
  const dlng = currentPos[1] - pathStart[1];
  const len = Math.sqrt(dlat * dlat + dlng * dlng);
  if (len === 0) return [];
  
  const perpLat = (-dlng / len) * swathWidth;
  const perpLng = (dlat / len) * swathWidth;
  
  return [
    [pathStart[0] + perpLat, pathStart[1] + perpLng],
    [pathStart[0] - perpLat, pathStart[1] - perpLng],
    [currentPos[0] - perpLat, currentPos[1] - perpLng],
    [currentPos[0] + perpLat, currentPos[1] + perpLng],
  ];
}

// ─── Map Component ───────────────────────────────────────────────────────────
export function Map({ fields, demoState, activeFieldScan, onFieldClick }: MapProps) {
  const [d1, setD1] = useState<[number, number]>(BASE_STATION);
  const [d2, setD2] = useState<[number, number]>(BASE_STATION);
  const [d3, setD3] = useState<[number, number]>(BASE_STATION);
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite'>('osm');

  // Satellite positions & trails
  const [satPositions, setSatPositions] = useState<[number, number][]>(SAT_PATHS.map(p => p.start));
  const [satTrails, setSatTrails] = useState<[number, number][][]>([[], [], []]);

  // Drone camera FOV polygons
  const [droneFovs, setDroneFovs] = useState<([number, number][] | null)[]>([null, null, null]);

  // Live telemetry data for each drone
  const [telemetry, setTelemetry] = useState({
    d1: { ndvi: '0.65', mst: '42%' },
    d2: { ndvi: '0.62', mst: '40%' },
    d3: { ndvi: '0.68', mst: '45%' },
  });

  // Dynamic drone icon generator
  const getDroneIcon = (isScanning: boolean, tData: { ndvi: string, mst: string }) => {
    return L.divIcon({
      className: 'bg-transparent border-none overflow-visible',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      html: `
        <div style="position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:36px; z-index: 1000;">
          
          ${isScanning ? `
            <!-- Live Telemetry Floating Bubble -->
            <div style="position:absolute; top:-40px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.9); backdrop-filter:blur(4px); padding:4px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); color:white; font-family:monospace; font-size:10px; font-weight:600; white-space:nowrap; display:flex; flex-direction:column; gap:2px; box-shadow:0 4px 12px rgba(0,0,0,0.3); pointer-events:none; animation: floatBubble 2s ease-in-out infinite;">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span style="color:#94a3b8;">N:</span> <span style="color:#34d399;">${tData.ndvi}</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span style="color:#94a3b8;">M:</span> <span style="color:#60a5fa;">${tData.mst}</span>
              </div>
              <!-- Tooltip pointing arrow -->
              <div style="position:absolute; bottom:-4px; left:50%; transform:translateX(-50%) rotate(45deg); width:8px; height:8px; background:rgba(15,23,42,0.9); border-right:1px solid rgba(255,255,255,0.1); border-bottom:1px solid rgba(255,255,255,0.1);"></div>
            </div>
          ` : ''}

          <!-- Rotor blur ring -->
          <div style="position:absolute; width:32px; height:32px; border-radius:50%; border: 1.5px dashed rgba(59,130,246,0.5); animation: rotorSpin 0.3s linear infinite;"></div>
          
          <!-- Drone body -->
          <div style="color: #1e3a5f; filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.15)); transform: rotate(-45deg);">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#1e3a5f" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L2.5 8.5L8 12l-4 4-2.5-.5-1.5 1.5 4.5 1.5 1.5 4.5 1.5-1.5-.5-2.5 4-4 3.5 5.5 1.7-1.2c.4-.2.7-.6.6-1.1Z"/>
            </svg>
          </div>

          ${isScanning ? `
            <!-- Sweeping Laser Cone (Origin at top center so it sweeps like a pendulum) -->
            <div style="position:absolute; top:24px; left:50%; margin-left:-30px; width:60px; height:80px; background: linear-gradient(to bottom, rgba(59,130,246,0.4) 0%, transparent 100%); clip-path: polygon(50% 0, 100% 100%, 0 100%); transform-origin: top center; animation: laserSweep 1.5s ease-in-out infinite; pointer-events:none; z-index:-1;"></div>
          ` : ''}
          
        </div>
      `
    });
  };

  // ─── Satellite Pass Animation ──────────────────────────────────────────────
  useEffect(() => {
    if (demoState !== 'SATELLITE_PASS') {
      setSatTrails([[], [], []]);
      return;
    }

    let startTime = Date.now();
    let frameId: number;
    const DURATION = 5000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const globalT = Math.min(elapsed / DURATION, 1);
      
      const newPositions: [number, number][] = [];
      const newTrails: [number, number][][] = [];

      SAT_PATHS.forEach((path, i) => {
        // Each satellite has a staggered start
        const localT = Math.max(0, Math.min((globalT - path.delay) / (1 - path.delay), 1));
        const eased = easeInOutCubic(localT);
        
        const pos = lerpLatLng(path.start, path.end, eased);
        newPositions.push(pos);
        
        // Build trail from start to current position by sampling points
        const trailPoints: [number, number][] = [];
        const steps = Math.floor(eased * 30);
        for (let j = 0; j <= steps; j++) {
          const tt = j / 30;
          trailPoints.push(lerpLatLng(path.start, path.end, tt));
        }
        trailPoints.push(pos);
        newTrails.push(trailPoints);
      });

      setSatPositions(newPositions);
      setSatTrails(newTrails);

      if (globalT < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => cancelAnimationFrame(frameId);
  }, [demoState]);

  // ─── Drone Animation ──────────────────────────────────────────────────────
  useEffect(() => {
    let startTime = Date.now();
    let animationFrameId: number;
    
    const startD1 = d1;
    const startD2 = d2;
    const startD3 = d3;

    // Generate proper survey patterns for each drone's assigned fields
    const survey1 = [...generateSurveyPattern(fields[0], 5), ...generateSurveyPattern(fields[3], 5)];
    const survey2 = [...generateSurveyPattern(fields[1], 5), ...generateSurveyPattern(fields[4], 5)];
    const survey3 = [...generateSurveyPattern(fields[2], 5), ...generateSurveyPattern(fields[5], 5)];

    // Full paths: base → first survey point → survey → return near last point
    const path1 = [startD1, ...survey1];
    const path2 = [startD2, ...survey2];
    const path3 = [startD3, ...survey3];

    // Live telemetry number fluctuation
    let telemetryInterval: number | undefined;
    if (demoState === 'SCANNING' || demoState === 'FIELD_SCAN') {
      telemetryInterval = window.setInterval(() => {
        setTelemetry({
          d1: { ndvi: (0.6 + Math.random() * 0.15).toFixed(2), mst: Math.floor(35 + Math.random() * 15) + '%' },
          d2: { ndvi: (0.6 + Math.random() * 0.15).toFixed(2), mst: Math.floor(35 + Math.random() * 15) + '%' },
          d3: { ndvi: (0.6 + Math.random() * 0.15).toFixed(2), mst: Math.floor(35 + Math.random() * 15) + '%' },
        });
      }, 150);
    }

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (demoState === 'DEPLOYING') {
        // Staggered deployment — each drone lifts off with a slight delay
        const stagger = [0, 200, 400];
        const newFovs: ([number, number][] | null)[] = [];
        
        [{ set: setD1, path: path1, delay: stagger[0] },
         { set: setD2, path: path2, delay: stagger[1] },
         { set: setD3, path: path3, delay: stagger[2] }].forEach(({ set, path, delay }) => {
          const localElapsed = Math.max(0, elapsed - delay);
          const t = Math.min(localElapsed / 2000, 1);
          const easeT = easeInOutCubic(t);
          set(lerpLatLng(path[0], path[1], easeT));
          newFovs.push(null);
        });
        
        setDroneFovs(newFovs);
      } else if (demoState === 'SCANNING') {
        const t = Math.min(elapsed / 10000, 1);
        
        const pos1 = getPointAlongPath(path1, t);
        const pos2 = getPointAlongPath(path2, t);
        const pos3 = getPointAlongPath(path3, t);
        
        setD1(pos1);
        setD2(pos2);
        setD3(pos3);

        // Camera FOV rectangles under each drone
        const fovSize = 0.0003;
        const makeFov = (p: [number, number]): [number, number][] => [
          [p[0] - fovSize, p[1] - fovSize],
          [p[0] - fovSize, p[1] + fovSize],
          [p[0] + fovSize, p[1] + fovSize],
          [p[0] + fovSize, p[1] - fovSize],
        ];
        setDroneFovs([makeFov(pos1), makeFov(pos2), makeFov(pos3)]);
      } else if (demoState === 'ANALYZING') {
        const t = Math.min(elapsed / 2500, 1);
        const easeT = easeInOutCubic(t);
        setD1(lerpLatLng(startD1, BASE_STATION, easeT));
        setD2(lerpLatLng(startD2, BASE_STATION, easeT));
        setD3(lerpLatLng(startD3, BASE_STATION, easeT));
        setDroneFovs([null, null, null]);
      } else if (demoState === 'FIELD_SCAN' && activeFieldScan) {
        // Single-drone field scan
        const targetField = fields.find(f => f.id === activeFieldScan);
        if (targetField) {
          const singleSurvey = generateSurveyPattern(targetField, 5);
          const singlePath = [BASE_STATION, ...singleSurvey, BASE_STATION];

          const DEPLOY_TIME = 2000;
          const SCAN_TIME = 8000;
          const RETURN_TIME = 2000;
          const TOTAL = DEPLOY_TIME + SCAN_TIME + RETURN_TIME;

          if (elapsed < DEPLOY_TIME) {
            // Flying to field
            const t = easeInOutCubic(elapsed / DEPLOY_TIME);
            setD1(lerpLatLng(BASE_STATION, singlePath[1], t));
          } else if (elapsed < DEPLOY_TIME + SCAN_TIME) {
            // Scanning
            const scanElapsed = elapsed - DEPLOY_TIME;
            const t = Math.min(scanElapsed / SCAN_TIME, 1);
            const pos = getPointAlongPath(singleSurvey, t);
            setD1(pos);
          } else if (elapsed < TOTAL) {
            // Returning to base
            const returnElapsed = elapsed - DEPLOY_TIME - SCAN_TIME;
            const t = easeInOutCubic(Math.min(returnElapsed / RETURN_TIME, 1));
            const lastSurveyPoint = singleSurvey[singleSurvey.length - 1];
            setD1(lerpLatLng(lastSurveyPoint, BASE_STATION, t));
          }
        }
      } else if (demoState === 'IDLE') {
        setD1(BASE_STATION);
        setD2(BASE_STATION);
        setD3(BASE_STATION);
        setDroneFovs([null, null, null]);
      }

      if (elapsed < 12000) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(telemetryInterval);
    };
  }, [demoState, activeFieldScan]);

  // ─── Field Styling ─────────────────────────────────────────────────────────
  const getPathOptions = (status: FieldStatus) => {
    switch (status) {
      case 'idle': return { color: '#94a3b8', fillColor: '#f8fafc', fillOpacity: 0.3, weight: 1.5 };
      case 'scanning': return { color: '#3b82f6', fillColor: '#dbeafe', fillOpacity: 0.5, weight: 2, dashArray: '6 3' };
      case 'scanned': return { color: '#64748b', fillColor: '#e2e8f0', fillOpacity: 0.3, weight: 1.5 };
      case 'healthy': return { color: '#10b981', fillColor: '#d1fae5', fillOpacity: 0.55, weight: 2 };
      case 'stressed': return { color: '#f59e0b', fillColor: '#fef3c7', fillOpacity: 0.55, weight: 2 };
      case 'disease': return { color: '#ef4444', fillColor: '#fee2e2', fillOpacity: 0.55, weight: 2 };
      default: return { color: '#94a3b8', fillColor: '#f8fafc', fillOpacity: 0.3, weight: 1.5 };
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
            attribution='Tiles &copy; Esri'
          />
        )}
        
        {/* Field polygons */}
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

        {/* Base station */}
        <Marker position={BASE_STATION} icon={baseIcon} />

        {/* ─── SATELLITE PASS VISUALS ─── */}
        {demoState === 'SATELLITE_PASS' && (
          <>
            {SAT_PATHS.map((path, i) => {
              const currentPos = satPositions[i];
              const trail = satTrails[i];
              const swath = computeSwathPolygon(path.start, currentPos, SWATH_WIDTH);
              
              return (
                <React.Fragment key={`sat-${i}`}>
                  {/* Full orbital path guideline (faint) */}
                  <Polyline
                    positions={[path.start, path.end]}
                    pathOptions={{
                      color: '#a78bfa',
                      weight: 1,
                      opacity: 0.2,
                      dashArray: '3 6',
                    }}
                  />
                  
                  {/* Completed scan trail — glowing center line */}
                  {trail.length > 1 && (
                    <>
                      <Polyline
                        positions={trail}
                        pathOptions={{
                          color: '#8b5cf6',
                          weight: 3,
                          opacity: 0.7,
                        }}
                      />
                      {/* Outer glow for the trail */}
                      <Polyline
                        positions={trail}
                        pathOptions={{
                          color: '#a78bfa',
                          weight: 8,
                          opacity: 0.15,
                        }}
                      />
                    </>
                  )}
                  
                  {/* Scan swath — translucent polygon showing sensor footprint */}
                  {swath.length === 4 && (
                    <Polygon
                      positions={swath}
                      pathOptions={{
                        color: '#7c3aed',
                        fillColor: '#8b5cf6',
                        fillOpacity: 0.08,
                        weight: 0.5,
                        opacity: 0.3,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
            
            {/* Satellite markers */}
            {satPositions.map((pos, i) => (
              <Marker key={`sat-marker-${i}`} position={pos} icon={satelliteIcon} />
            ))}
          </>
        )}

        {/* ─── DRONE PHASE VISUALS ─── */}
        {(demoState === 'DEPLOYING' || demoState === 'SCANNING' || demoState === 'ANALYZING') && (
          <>
            {/* Drone markers */}
            <Marker position={d1} icon={getDroneIcon(demoState === 'SCANNING', telemetry.d1)} />
            <Marker position={d2} icon={getDroneIcon(demoState === 'SCANNING', telemetry.d2)} />
            <Marker position={d3} icon={getDroneIcon(demoState === 'SCANNING', telemetry.d3)} />
          </>
        )}

        {/* ─── SINGLE FIELD SCAN VISUALS ─── */}
        {demoState === 'FIELD_SCAN' && (
          <Marker position={d1} icon={getDroneIcon(true, telemetry.d1)} />
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
