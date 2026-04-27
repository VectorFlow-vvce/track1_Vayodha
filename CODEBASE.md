# AgriSense Demo — Complete Codebase Documentation

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Backend Services](#backend-services)
- [Python AI Detection](#python-ai-detection)
- [State Management](#state-management)
- [Animation System](#animation-system)
- [Setup & Installation](#setup--installation)
- [API & Communication](#api--communication)
- [Deployment](#deployment)

---

## 🌾 Project Overview

**AgriSense** is an interactive demonstration platform showcasing AI-powered precision agriculture through drone swarm technology and satellite imagery analysis. The system simulates real-time crop health monitoring, disease detection, and farmer-facing mobile interfaces.

### Key Features
- **Dual-Mode Operation**: HQ control center + individual farmer mobile apps
- **Real-time Synchronization**: Socket.IO-based multi-client state management
- **Satellite + Drone Simulation**: Realistic orbital passes and autonomous drone survey patterns
- **AI-Powered Detection**: RF-DETR segmentation model for crop analysis
- **Interactive Mapping**: Leaflet-based geospatial visualization with custom animations
- **Voice AI Integration**: Apoorva voice assistant for farmer guidance
- **QR Code Connectivity**: Seamless farmer device pairing

---

## 🏗️ Architecture

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   HQ Dashboard   │         │   Farmer App     │         │
│  │   (React/Vite)   │         │  (Mobile View)   │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                             │                    │
│           └─────────────┬───────────────┘                    │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Real-time Sync Layer (Socket.IO)               │
│                    server.js (Port 3001)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Detection Layer                        │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  detector.py     │         │ webcam_detector  │         │
│  │  (RF-DETR Seg)   │         │  (Live Stream)   │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
1. **HQ initiates scan** → Socket.IO broadcasts state change
2. **Farmer requests scan** → Socket.IO notifies HQ → Drone deployed
3. **Satellite pass** → Animated orbital trajectory → Anomaly detection
4. **Drone survey** → Boustrophedon pattern → Field scanning
5. **AI analysis** → RF-DETR segmentation → Health classification
6. **Report generation** → Multi-modal data (NDVI, moisture, thermal)
7. **Farmer notification** → Mobile app updates → Voice AI consultation

---

## 🛠️ Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 6** - Build tool & dev server
- **Tailwind CSS 4** - Styling framework
- **Motion (Framer Motion)** - Animation library
- **React Leaflet** - Interactive maps
- **Leaflet.js** - Geospatial mapping
- **Socket.IO Client** - Real-time communication
- **React Router DOM** - Client-side routing
- **Lucide React** - Icon library
- **QRCode.react** - QR code generation

### Backend
- **Node.js** - Runtime environment
- **Express.js** - HTTP server
- **Socket.IO** - WebSocket server
- **Better-SQLite3** - Database (if needed)

### AI/ML
- **Python 3.10+** - Runtime
- **RF-DETR** - Real-time detection transformer
- **PyTorch** - Deep learning framework
- **OpenCV** - Computer vision
- **Supervision** - Detection utilities
- **Pillow** - Image processing

### DevOps
- **Git** - Version control
- **npm** - Package management
- **Python venv** - Virtual environments
- **CUDA 12.1** - GPU acceleration (optional)

---

## 📁 Project Structure

```
agrisense-demo/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── FarmerApp.tsx        # Farmer mobile interface
│   │   ├── Map.tsx              # Interactive Leaflet map
│   │   ├── Metrics.tsx          # Live telemetry display
│   │   ├── FieldDetailsModal.tsx # Field analysis modal
│   │   └── ReportModal.tsx      # Survey report modal
│   ├── App.tsx                  # HQ dashboard (main app)
│   ├── main.tsx                 # React entry point + routing
│   └── index.css                # Global styles + animations
│
├── server.js                    # Socket.IO sync server
├── detector.py                  # Static image detection
├── webcam_detector.py           # Real-time webcam detection
│
├── package.json                 # Node dependencies
├── requirements.txt             # Python dependencies
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite build config
├── tailwind.config.js           # Tailwind CSS config (implicit)
│
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── metadata.json                # App metadata
├── README.md                    # Setup instructions
│
├── setup_windows.bat            # Windows setup script
├── run_detector.bat             # Windows detector launcher
│
├── node_modules/                # Node packages
├── venv/                        # Python virtual environment
├── public/                      # Static assets
└── dist/                        # Production build output
```

---

## 🧩 Core Components

### 1. **App.tsx** (HQ Dashboard)
**Purpose**: Main control center for AgriSense operations

**Key Features**:
- Satellite scan initiation
- Drone swarm deployment
- Real-time field monitoring
- QR code generation for farmer pairing
- Live telemetry display
- Report generation

**State Management**:
```typescript
type DemoState = 'IDLE' | 'SATELLITE_PASS' | 'DEPLOYING' | 
                 'SCANNING' | 'ANALYZING' | 'REPORT_READY' | 'FIELD_SCAN';

interface Field {
  id: string;
  name: string;
  path: [number, number][];  // Polygon coordinates
  center: [number, number];  // Lat/Lng
  status: FieldStatus;
}
```

**Socket.IO Events**:
- `localIp` - Receives server's local network IP
- `farmerConnected` - Farmer joins a field
- `farmerDisconnected` - Farmer leaves
- `scanRequested` - Farmer requests drone scan
- `scanComplete` - Scan finished, report ready

**Animation Phases**:
1. **SATELLITE_PASS** (5s): Orbital imagery acquisition
2. **DEPLOYING** (2.5s): Drone swarm liftoff
3. **SCANNING** (10s): Boustrophedon field survey
4. **ANALYZING** (3s): AI processing
5. **REPORT_READY**: Results available

---

### 2. **FarmerApp.tsx** (Mobile Interface)
**Purpose**: Farmer-facing mobile application for field-specific monitoring

**Key Features**:
- Field information display (crop, area, soil, irrigation)
- Drone scan request button
- Real-time scan progress with radar animation
- Health report with recommendations
- Voice AI integration (Apoorva)
- Haptic feedback (vibration on report)

**Phases**:
```typescript
type FarmerPhase = 'CONNECTING' | 'IDLE' | 'REQUESTING' | 
                   'SCANNING' | 'REPORT';
```

**Field Data Structure**:
```typescript
const FIELD_INFO: Record<string, {
  name: string;
  crop: string;      // Rice, Sugarcane, Ragi, Cotton, Maize, Coffee
  area: string;      // In acres
  soil: string;      // RedSoil, BlackSoil, Laterite
  irrigation: string; // Canal, Borewell, Rainfed
  district: string;  // Karnataka districts
  season: string;    // Kharif, Rabi
}>;
```

**Status Configuration**:
- **Healthy**: Green, no action needed
- **Stressed**: Amber, water stress detected, increase irrigation
- **Disease**: Red, fungal infection, apply fungicide

**Apoorva Integration**:
- Dynamic URL generation with field context
- Query parameters: crop, area, soil, irrigation, district, season, problem
- Opens in new tab for voice consultation

---

### 3. **Map.tsx** (Interactive Geospatial Visualization)
**Purpose**: Real-time animated map showing satellite passes, drone movements, and field status

**Key Features**:
- Dual map styles (OpenStreetMap / Satellite imagery)
- Animated satellite orbital passes with scan swaths
- Drone survey patterns with live telemetry bubbles
- Field polygon rendering with status-based styling
- Base station marker
- Camera FOV visualization

**Satellite Animation**:
```typescript
const SAT_PATHS = [
  { start: [13.8868, 75.2340], end: [13.8938, 75.2480], delay: 0 },
  { start: [13.8858, 75.2350], end: [13.8928, 75.2490], delay: 0.15 },
  { start: [13.8848, 75.2360], end: [13.8918, 75.2500], delay: 0.30 },
];
```
- 3 staggered orbital passes (sun-synchronous trajectory)
- Scan swath polygons showing sensor footprint
- Trail rendering for completed passes
- 5-second animation duration

**Drone Survey Pattern**:
- **Boustrophedon (lawnmower) pattern**: Alternating left-right passes
- **5 passes per field**: Ensures complete coverage
- **Easing functions**: Smooth acceleration/deceleration
- **Live telemetry**: NDVI and moisture readings in floating bubbles
- **Scanning lasers**: Animated cone sweeping beneath drone

**Field Status Styling**:
```typescript
idle      → Gray, low opacity
scanning  → Blue, dashed border, pulsing
scanned   → Gray, solid
healthy   → Green, high opacity
stressed  → Amber/Yellow
disease   → Red
```

**Custom Markers**:
- **Satellite**: Animated pulse rings + glow + SVG icon
- **Drone**: Spinning rotor blur + body + laser cone + telemetry bubble
- **Base Station**: Pulsing center dot + label

---

### 4. **Metrics.tsx** (Live Telemetry)
**Purpose**: Display real-time environmental sensor data

**Metrics Displayed**:
- **Temperature**: °C (fluctuates ±0.2°C during scan)
- **Humidity**: % (fluctuates ±1%)
- **Solar Index**: W/m² (fluctuates ±10)
- **Wind Speed**: m/s (fluctuates ±0.3)
- **Soil Moisture**: % (fluctuates ±0.5%)

**Update Frequency**: 1 second during active scanning

---

### 5. **FieldDetailsModal.tsx** (Detailed Analysis)
**Purpose**: In-depth field analysis with imagery and telemetry

**Content**:
- **High-Res Optical Image**: RGB drone imagery
- **Multispectral (NDVI)**: False-color vegetation index
- **Telemetry Cards**:
  - NDVI Score (target > 0.75)
  - Soil Moisture (target 40-60%)
  - Canopy Temperature
  - Estimated Yield (tons)

**Image Rendering**:
- Uses Picsum for demo imagery (seeded by field ID)
- CSS filters for NDVI simulation (sepia + hue-rotate + saturate)
- Hover effects for full-resolution view

---

### 6. **ReportModal.tsx** (Survey Summary)
**Purpose**: Aggregated report of all scanned fields

**Features**:
- Overall crop health percentage
- Field-by-field status list
- Action required indicators
- Click-through to detailed field analysis

---

## 🔌 Backend Services

### **server.js** (Socket.IO Sync Server)

**Port**: 3001  
**Purpose**: Real-time state synchronization between HQ and farmer devices

**Shared State**:
```javascript
let demoState = {
  phase: 'IDLE',
  activeFieldId: null,
  connectedFarmers: {},  // { fieldId: socketId }
  fieldStatuses: {},     // { A: 'idle', B: 'scanning', ... }
};
```

**Socket Events**:

**Client → Server**:
- `joinField(fieldId)` - Farmer connects to specific field
- `requestScan(fieldId)` - Farmer requests drone scan
- `scanComplete({ fieldId, status })` - HQ reports scan finished
- `startFullDemo()` - HQ triggers satellite + full drone demo
- `updatePhase(phase)` - HQ updates global phase
- `resetDemo()` - Reset all state

**Server → Client**:
- `stateUpdate(demoState)` - Broadcast current state
- `localIp(ip)` - Send server's local network IP
- `farmerConnected({ fieldId, socketId })` - Notify farmer joined
- `farmerDisconnected({ fieldId })` - Notify farmer left
- `scanRequested({ fieldId })` - Notify scan request
- `fieldReport({ fieldId, status })` - Send scan results

**Network Discovery**:
```javascript
function getLocalIp() {
  // Detects local network IP (e.g., 192.168.1.100)
  // Used for QR code generation
}
```

**CORS Configuration**:
```javascript
cors: {
  origin: '*',
  methods: ['GET', 'POST'],
}
```

---

## 🤖 Python AI Detection

### **detector.py** (Static Image Analysis)

**Purpose**: Run RF-DETR segmentation on a single image

**Model**: `RFDETRSegNano` - Lightweight real-time detection transformer

**Usage**:
```bash
./venv/bin/python3 detector.py sample_watermarked.png
```

**Pipeline**:
1. Load RF-DETR Segmentation Nano model
2. Read image with OpenCV (BGR → RGB)
3. Convert to PIL Image
4. Run inference → `sv.Detections` object
5. Extract class names, confidence scores, bounding boxes
6. Annotate with masks and labels
7. Save to `output_detected.png`

**Output**:
```
Found 3 detections.
  Tomato: 0.92  box=[120, 45, 340, 280]
  Leaf: 0.87  box=[350, 60, 480, 190]
  Disease: 0.78  box=[200, 150, 290, 240]

Saved annotated image → output_detected.png
```

---

### **webcam_detector.py** (Real-time Detection)

**Purpose**: Live webcam feed with real-time RF-DETR segmentation

**Features**:
- **Multi-threaded architecture**: Separate inference thread to prevent blocking
- **Device auto-detection**: MPS (Apple Silicon) > CUDA > CPU
- **Dual FPS tracking**: Display FPS vs Inference FPS
- **Live annotations**: Segmentation masks + confidence labels
- **Threshold filtering**: Configurable confidence threshold (default 0.5)

**Architecture**:
```python
class InferenceThread(threading.Thread):
    def push_frame(frame_rgb)  # Main thread → Inference thread
    def get_results()          # Inference thread → Main thread
    def run()                  # Background inference loop
```

**Performance**:
- **Display FPS**: 30-60 fps (render rate)
- **Inference FPS**: 5-15 fps (model speed, device-dependent)
- **Latency**: Non-blocking, always shows latest detections

**Controls**:
- Press `Q` to quit

**Setup Requirements**:
- Camera access permissions (macOS: System Settings → Privacy → Camera → Terminal)
- CUDA 12.1 for GPU acceleration (Windows with NVIDIA GPU)
- MPS for Apple Silicon acceleration

---

## 🔄 State Management

### Global State (HQ Dashboard)
```typescript
const [demoState, setDemoState] = useState<DemoState>('IDLE');
const [fields, setFields] = useState<Field[]>(initialFields);
const [scanProgress, setScanProgress] = useState(0);
const [scanMessage, setScanMessage] = useState('System ready.');
const [selectedField, setSelectedField] = useState<Field | null>(null);
const [activeFieldScan, setActiveFieldScan] = useState<string | null>(null);
const [connectedFarmers, setConnectedFarmers] = useState<Record<string, boolean>>({});
const [localIp, setLocalIp] = useState(window.location.hostname);
const [metrics, setMetrics] = useState({ temperature, humidity, solar, wind, soil });
```

### Socket State Synchronization
- **Optimistic updates**: UI updates immediately, socket confirms
- **Conflict resolution**: Server state is source of truth
- **Reconnection handling**: Auto-reconnect on disconnect

### Field Results (Hardcoded Demo Data)
```typescript
const FIELD_RESULTS: Record<string, FieldStatus> = {
  A: 'healthy', 
  B: 'healthy', 
  C: 'disease',  // Fungal infection
  D: 'healthy', 
  E: 'stressed', // Water stress
  F: 'healthy',
};
```

---

## 🎨 Animation System

### CSS Animations (index.css)

**Satellite Animations**:
```css
@keyframes satPulse {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.2); opacity: 0; }
}

@keyframes satGlow {
  0% { opacity: 0.2; transform: scale(0.9); }
  100% { opacity: 0.5; transform: scale(1.1); }
}
```

**Drone Animations**:
```css
@keyframes rotorSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes laserSweep {
  0% { transform: rotate(-30deg); }
  50% { transform: rotate(30deg); }
  100% { transform: rotate(-30deg); }
}

@keyframes floatBubble {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-3px); }
  100% { transform: translateY(0px); }
}
```

**Farmer App Animations**:
```css
@keyframes radarSweep {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

### Motion (Framer Motion) Animations

**Modal Entrance**:
```typescript
<motion.div
  initial={{ opacity: 0, y: 20, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: 20, scale: 0.95 }}
/>
```

**Progress Bar**:
```typescript
<motion.div 
  className="h-full bg-emerald-500"
  initial={{ width: 0 }}
  animate={{ width: `${scanProgress}%` }}
  transition={{ ease: "linear", duration: 0.2 }}
/>
```

**Button Interactions**:
```typescript
<motion.button
  whileTap={{ scale: 0.95 }}
  whileHover={{ scale: 1.02 }}
/>
```

### Easing Functions (Map.tsx)
```typescript
const easeInOutCubic = (t: number) => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const easeInOutQuad = (t: number) => 
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** 18+ (for frontend & Socket.IO server)
- **Python** 3.10+ (for AI detection)
- **NVIDIA GPU** (optional, for CUDA acceleration)

### Frontend Setup
```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Run development server
npm run dev
# Runs on http://localhost:3000

# Run Socket.IO sync server (separate terminal)
npm run server
# Runs on http://localhost:3001
```

### Python AI Setup (macOS/Linux)
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install rfdetr opencv-python supervision pillow

# For GPU support (CUDA)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Run static image detector
python detector.py sample_watermarked.png

# Run webcam detector
python webcam_detector.py
```

### Python AI Setup (Windows)
```bash
# Run automated setup script
setup_windows.bat

# This will:
# 1. Create venv
# 2. Install PyTorch with CUDA 12.1
# 3. Install rfdetr and dependencies
# 4. Verify CUDA availability

# Run webcam detector
run_detector.bat
```

---

## 🌐 API & Communication

### REST API
Currently, the app uses Socket.IO for all real-time communication. No REST endpoints are exposed.

### Socket.IO Protocol

**Connection**:
```javascript
const socket = io('http://localhost:3001');
```

**HQ → Server**:
```javascript
socket.emit('startFullDemo');
socket.emit('updatePhase', 'SCANNING');
socket.emit('resetDemo');
socket.emit('scanComplete', { fieldId: 'A', status: 'healthy' });
```

**Farmer → Server**:
```javascript
socket.emit('joinField', 'A');
socket.emit('requestScan', 'A');
```

**Server → All Clients**:
```javascript
socket.on('stateUpdate', (state) => { /* ... */ });
socket.on('farmerConnected', ({ fieldId }) => { /* ... */ });
socket.on('scanRequested', ({ fieldId }) => { /* ... */ });
socket.on('fieldReport', ({ fieldId, status }) => { /* ... */ });
```

### QR Code Generation
```typescript
<QRCodeSVG 
  value={`http://${localIp}:3000/farmer/${fieldId}`}
  size={200}
  level="M"
/>
```

### Apoorva Voice AI Integration
```typescript
const apoorvaUrl = `https://cara-voice.web.app/apoorva?${params}`;
// Query params: crop, area, soil, irrigation, district, season, problem
window.open(apoorvaUrl, '_blank');
```

---

## 📦 Deployment

### Build for Production
```bash
# Build frontend
npm run build
# Output: dist/

# Preview production build
npm run preview
```

### Environment Variables
```bash
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="https://your-domain.com"
```

### Deployment Targets
- **Frontend**: Vercel, Netlify, AWS Amplify, Firebase Hosting
- **Socket.IO Server**: Heroku, Railway, Render, AWS EC2
- **AI Detection**: Local deployment only (requires GPU for real-time)

### Docker (Optional)
```dockerfile
# Frontend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]

# Socket.IO Server
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server.js .
EXPOSE 3001
CMD ["node", "server.js"]
```

---

## 🔧 Configuration Files

### **package.json**
```json
{
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "server": "node server.js",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### **vite.config.ts**
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
```

### **tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## 🎯 Key Algorithms

### Boustrophedon Survey Pattern
```typescript
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
      // Right to left (alternating)
      points.push([lerp(lat2, lat3, t), lerp(lng2, lng3, t)]);
      points.push([lerp(lat1, lat4, t), lerp(lng1, lng4, t)]);
    }
  }
  return points;
}
```

### Satellite Scan Swath Calculation
```typescript
function computeSwathPolygon(
  pathStart: [number, number], 
  currentPos: [number, number], 
  swathWidth: number
): [number, number][] {
  const dlat = currentPos[0] - pathStart[0];
  const dlng = currentPos[1] - pathStart[1];
  const len = Math.sqrt(dlat * dlat + dlng * dlng);
  
  const perpLat = (-dlng / len) * swathWidth;
  const perpLng = (dlat / len) * swathWidth;
  
  return [
    [pathStart[0] + perpLat, pathStart[1] + perpLng],
    [pathStart[0] - perpLat, pathStart[1] - perpLng],
    [currentPos[0] - perpLat, currentPos[1] - perpLng],
    [currentPos[0] + perpLat, currentPos[1] + perpLng],
  ];
}
```

---

## 📊 Performance Considerations

### Frontend Optimization
- **React 19**: Automatic batching, concurrent rendering
- **Vite HMR**: Fast hot module replacement (disabled in AI Studio)
- **Lazy loading**: Route-based code splitting
- **Animation throttling**: RequestAnimationFrame for smooth 60fps
- **Socket.IO**: Efficient binary protocol, auto-reconnection

### Backend Optimization
- **Socket.IO**: Event-driven, non-blocking I/O
- **In-memory state**: No database overhead for demo
- **CORS wildcard**: Allows any origin (dev only)

### AI Model Optimization
- **RF-DETR Nano**: Lightweight variant (vs. base/large)
- **Multi-threading**: Separate inference thread prevents UI blocking
- **Device selection**: MPS > CUDA > CPU (auto-detection)
- **Batch size 1**: Real-time single-frame inference

---

## 🐛 Known Issues & Limitations

1. **Hardcoded Field Results**: Disease/stress status is predetermined, not from actual AI analysis
2. **Demo Data**: Uses Picsum placeholder images instead of real drone imagery
3. **No Persistence**: State resets on server restart (no database)
4. **Local Network Only**: QR codes use local IP, not accessible outside LAN
5. **CUDA Requirement**: Real-time detection requires NVIDIA GPU for optimal performance
6. **Camera Permissions**: macOS requires explicit Terminal camera access for webcam detector

---

## 🔮 Future Enhancements

### Planned Features
- [ ] Real AI integration: Connect RF-DETR output to field status
- [ ] Database persistence: PostgreSQL/MongoDB for state storage
- [ ] User authentication: Multi-tenant farmer accounts
- [ ] Historical data: Time-series crop health tracking
- [ ] Weather API integration: Real-time meteorological data
- [ ] Prescription maps: Variable-rate application recommendations
- [ ] Mobile app: Native iOS/Android apps
- [ ] Cloud deployment: AWS/GCP infrastructure
- [ ] Real drone integration: DJI SDK for actual UAV control
- [ ] Blockchain traceability: Immutable crop health records

---

## 📚 References

### Technologies
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Leaflet Documentation](https://leafletjs.com/)
- [Motion Documentation](https://motion.dev/)
- [RF-DETR Paper](https://arxiv.org/abs/2304.04924)
- [PyTorch Documentation](https://pytorch.org/docs/)

### Concepts
- **NDVI**: Normalized Difference Vegetation Index
- **Boustrophedon Pattern**: Alternating parallel survey lines
- **Sun-Synchronous Orbit**: Satellite orbit maintaining constant solar angle
- **Precision Agriculture**: Data-driven farming optimization
- **Remote Sensing**: Satellite/drone-based crop monitoring

---

## 📝 License

This project is a demonstration application. Check with the project owner for licensing details.

---

## 👥 Contributors

Built for AgriSense Demo — AI for Every Acre.

---

**Last Updated**: 2026-04-27  
**Version**: 1.0.0  
**Documentation Generated**: Automated codebase analysis
