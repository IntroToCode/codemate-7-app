require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');
const migrate = require('./db/migrate');

const restaurantsRouter = require('./routes/restaurants');
const spinsRouter = require('./routes/spins');
const tagsRouter = require('./routes/tags');
const ratingsRouter = require('./routes/ratings');

const app = express();

app.use(cors());
app.use(express.json());

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date(), database: 'connected' });
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

app.use('/api/restaurants', restaurantsRouter);
app.use('/api/spins', spinsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/ratings', ratingsRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

async function startServer() {
  await migrate();

  const PORTS = [3001, 5000];
  PORTS.forEach((port) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = app;
