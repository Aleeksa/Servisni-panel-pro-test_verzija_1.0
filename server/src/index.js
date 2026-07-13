import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authMiddleware, createToken } from './auth.js';
import { clearAllTasks, createTask, deleteTask, listTasks, updateTask } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 4000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@firma.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'promeni-ovu-lozinku';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'ServisPanel Pro', time: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (String(email || '').trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() || String(password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Pogrešan email ili lozinka.' });
  }
  const user = { email: ADMIN_EMAIL, role: 'admin' };
  const token = createToken(user, process.env.SESSION_SECRET || 'dev-secret-change-me');
  return res.json({ token, user });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { email: req.user.email, role: req.user.role || 'admin' } });
});

app.get('/api/tasks', authMiddleware, async (_req, res, next) => {
  try {
    res.json({ tasks: await listTasks() });
  } catch (err) {
    next(err);
  }
});

app.post('/api/tasks', authMiddleware, async (req, res, next) => {
  try {
    if (!req.body?.title || !req.body?.client || !req.body?.description) {
      return res.status(400).json({ error: 'Naslov, klijent i opis su obavezni.' });
    }
    const task = await createTask(req.body, req.user.email);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res, next) => {
  try {
    const task = await updateTask(req.params.id, req.body, req.user.email);
    if (!task) return res.status(404).json({ error: 'Zadatak nije pronađen.' });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res, next) => {
  try {
    const ok = await deleteTask(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Zadatak nije pronađen.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/tasks', authMiddleware, async (_req, res, next) => {
  try {
    await clearAllTasks();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server greška.' });
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');

if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(clientIndex);
  });
} else {
  app.get('*', (_req, res) => {
    res.status(500).type('html').send(`
      <main style="font-family:system-ui;padding:40px;max-width:760px">
        <h1>Aplikacija nije pripremljena za prikaz</h1>
        <p>Potrebno je prvo pripremiti aplikaciju za produkciju.</p>
        <p>U root folderu projekta pokreni:</p>
        <pre style="background:#111827;color:#e5e7eb;padding:16px;border-radius:12px">npm run build
npm start</pre>
        <p>Za lokalni rad koristi razvojni režim iz uputstva.</p>
      </main>
    `);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ServisPanel Pro running on http://localhost:${PORT}`);
});
