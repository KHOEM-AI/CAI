import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import scanRoutes from './routes/scans';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '2mb' }));

// API versioning (P1 item from the review) — so a future v2 doesn't break old app builds in the field
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/scans', scanRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Fallback error handler — never leak stack traces to the client
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[server] CAI Pro backend listening on :${PORT}`));
