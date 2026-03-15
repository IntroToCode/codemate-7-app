require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Serve React build ────────────────────────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date(),
      database: 'connected',
    });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(500).json({
      status: 'error',
      timestamp: new Date(),
      database: 'disconnected',
      error: err.message,
    });
  }
});

// ─── Your routes go here ───────────────────────────────────────────────────────
// Example structure — replace with your own:
//
// const itemsRouter = require('./routes/items');
// app.use('/api/items', itemsRouter);
//
// See the assignment doc for what routes your app needs.

// ─── Catch-all: serve React app for any non-API route ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── Start Server on both ports ───────────────────────────────────────────────
// Port 3001 → external port 80 (Replit's default preview URL)
// Port 5000 → webview workflow port
const PORTS = [3001, 5000];
PORTS.forEach((port) => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
});
