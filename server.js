import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Shared demo state
let demoState = {
  phase: 'IDLE', // IDLE | SATELLITE_PASS | DEPLOYING | SCANNING | ANALYZING | REPORT_READY | FIELD_SCAN
  activeFieldId: null,     // which field is being scanned (for single-field mode)
  connectedFarmers: {},     // { fieldId: socketId }
  fieldStatuses: {},        // { A: 'idle', B: 'scanning', ... }
};

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current state to newly connected client
  socket.emit('stateUpdate', demoState);

  // Farmer joins a specific field
  socket.on('joinField', (fieldId) => {
    demoState.connectedFarmers[fieldId] = socket.id;
    console.log(`[Socket] Farmer joined field ${fieldId}`);
    io.emit('farmerConnected', { fieldId, socketId: socket.id });
    socket.emit('stateUpdate', demoState);
  });

  // Farmer requests a drone scan for their field
  socket.on('requestScan', (fieldId) => {
    console.log(`[Socket] Scan requested for field ${fieldId}`);
    demoState.phase = 'FIELD_SCAN';
    demoState.activeFieldId = fieldId;
    demoState.fieldStatuses[fieldId] = 'scanning';
    io.emit('stateUpdate', demoState);
    io.emit('scanRequested', { fieldId });
  });

  // HQ reports scan complete for a field
  socket.on('scanComplete', ({ fieldId, status }) => {
    console.log(`[Socket] Scan complete for field ${fieldId}: ${status}`);
    demoState.fieldStatuses[fieldId] = status;
    demoState.phase = 'IDLE';
    demoState.activeFieldId = null;
    io.emit('stateUpdate', demoState);
    io.emit('fieldReport', { fieldId, status });
  });

  // HQ triggers the full satellite + drone demo (original flow)
  socket.on('startFullDemo', () => {
    console.log('[Socket] Full demo started');
    demoState.phase = 'SATELLITE_PASS';
    io.emit('stateUpdate', demoState);
  });

  // HQ updates the phase
  socket.on('updatePhase', (phase) => {
    demoState.phase = phase;
    io.emit('stateUpdate', demoState);
  });

  // Reset everything
  socket.on('resetDemo', () => {
    demoState = {
      phase: 'IDLE',
      activeFieldId: null,
      connectedFarmers: {},
      fieldStatuses: {},
    };
    io.emit('stateUpdate', demoState);
  });

  socket.on('disconnect', () => {
    // Remove farmer from connected list
    for (const [fieldId, sid] of Object.entries(demoState.connectedFarmers)) {
      if (sid === socket.id) {
        delete demoState.connectedFarmers[fieldId];
        io.emit('farmerDisconnected', { fieldId });
      }
    }
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[AgriSense Sync] Socket.IO server running on http://0.0.0.0:${PORT}`);
});
