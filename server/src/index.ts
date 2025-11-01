import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users.js';
import shiftTypesRouter from './routes/shiftTypes.js';
import assignmentsRouter from './routes/assignments.js';
import weekConfigsRouter from './routes/weekConfigs.js';
import authRouter from './routes/auth.js';

const app = express();

app.use(cors({ origin: 'https://dev.wproducts.de' }));
app.use(express.json());

// Friendly root for environments hitting "/"
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'Dienstplaner API',
    health: '/api/health',
    endpoints: '/README (see repository)'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/shift-types', shiftTypesRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/week-configs', weekConfigsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Dienstplaner API listening on port ${PORT}`);
});
