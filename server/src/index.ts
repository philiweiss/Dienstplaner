import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import usersRouter from './routes/users.js';
import shiftTypesRouter from './routes/shiftTypes.js';
import assignmentsRouter from './routes/assignments.js';
import weekConfigsRouter from './routes/weekConfigs.js';
import authRouter from './routes/auth.js';
import handoversRouter from './routes/handovers.js';
import calendarRouter from './routes/calendar.js';

const app = express();

// CORS: allow configured origins (supports dev + prod)
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,https://dev.wproducts.de')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser clients
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(express.json());

// Serve built SPA (frontend) from server/public
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// Health endpoint remains under /api
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/shift-types', shiftTypesRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/week-configs', weekConfigsRouter);
app.use('/api/handovers', handoversRouter);
app.use('/api/calendar', calendarRouter);

// SPA fallback for all non-API GET requests
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).json({
      error: 'Frontend not deployed',
      message: 'No index.html found in server/public. Build the SPA (vite build) and copy dist/ to server/public/.',
      steps: [
        'npm ci',
        'npm run build  # at project root to create dist/',
        'mkdir -p server/public',
        'rsync -a dist/ server/public/',
        'cd server && npm run build && mkdir -p tmp && touch tmp/restart.txt'
      ]
    });
  }
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Dienstplaner API listening on port ${PORT}`);
});
