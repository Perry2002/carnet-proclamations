import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

import { connectDB } from './db.js';
import Session from './models/Session.js';
import Entry from './models/Entry.js';
import { signAdminToken, requireAuth } from './auth.js';
import { streamSessionReport } from './pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(cookieParser());

// Sert les fichiers statiques buildés par Vite (JS/CSS/images).
app.use(express.static(path.join(__dirname, 'dist')));

// S'assure que la base est connectée avant les routes qui en ont besoin
// (login/logout n'utilisent pas la base, inutile de la solliciter pour elles).
async function withDB(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Connexion à la base de données impossible' });
  }
}
app.use('/api/sessions', withDB);
app.use('/api/public', withDB);

const isProd = process.env.NODE_ENV === 'production';

function computeDailyTotals(session, entries) {
  if (session.type !== 'croisade' || !session.dayCount) return null;
  const totals = Array.from({ length: session.dayCount }, (_, i) => ({
    day: i + 1,
    total: 0,
    entryCount: 0,
  }));
  for (const e of entries) {
    if (e.day && e.day >= 1 && e.day <= session.dayCount) {
      totals[e.day - 1].total += e.count;
      totals[e.day - 1].entryCount += 1;
    }
  }
  return totals;
}

// ---------- Authentification responsable ----------

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  const token = signAdminToken();
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

// ---------- Espace responsable : événements ----------

app.post('/api/sessions', requireAuth, async (req, res) => {
  const { title, type, dayCount } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le titre est requis' });
  }
  const isCroisade = type === 'croisade';
  let resolvedDayCount = null;
  if (isCroisade) {
    const parsed = parseInt(dayCount, 10);
    resolvedDayCount = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 31) : 7;
  }
  const session = await Session.create({
    title: title.trim(),
    type: isCroisade ? 'croisade' : 'culte',
    dayCount: resolvedDayCount,
    slug: nanoid(8),
  });
  res.json(session);
});

app.get('/api/sessions', requireAuth, async (req, res) => {
  const sessions = await Session.find().sort({ createdAt: -1 }).lean();
  const totals = await Entry.aggregate([
    { $group: { _id: '$sessionId', total: { $sum: '$count' }, entryCount: { $sum: 1 } } },
  ]);
  const totalsMap = Object.fromEntries(totals.map((t) => [String(t._id), t]));

  res.json(
    sessions.map((s) => ({
      ...s,
      total: totalsMap[String(s._id)]?.total || 0,
      entryCount: totalsMap[String(s._id)]?.entryCount || 0,
    }))
  );
});

app.get('/api/sessions/:id', requireAuth, async (req, res) => {
  const session = await Session.findById(req.params.id).lean();
  if (!session) return res.status(404).json({ error: 'Événement introuvable' });
  const entries = await Entry.find({ sessionId: session._id }).sort({ submittedAt: 1 }).lean();
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const dailyTotals = computeDailyTotals(session, entries);
  res.json({ session, entries, total, dailyTotals });
});

app.patch('/api/sessions/:id/close', requireAuth, async (req, res) => {
  const session = await Session.findByIdAndUpdate(
    req.params.id,
    { status: 'closed', closedAt: new Date() },
    { new: true }
  );
  if (!session) return res.status(404).json({ error: 'Événement introuvable' });
  res.json(session);
});

app.patch('/api/sessions/:id/reopen', requireAuth, async (req, res) => {
  const session = await Session.findByIdAndUpdate(
    req.params.id,
    { status: 'open', closedAt: null },
    { new: true }
  );
  if (!session) return res.status(404).json({ error: 'Événement introuvable' });
  res.json(session);
});

app.delete('/api/sessions/:id/entries/:entryId', requireAuth, async (req, res) => {
  await Entry.findOneAndDelete({ _id: req.params.entryId, sessionId: req.params.id });
  res.json({ ok: true });
});

app.get('/api/sessions/:id/report', requireAuth, async (req, res) => {
  const session = await Session.findById(req.params.id).lean();
  if (!session) return res.status(404).json({ error: 'Événement introuvable' });
  const entries = await Entry.find({ sessionId: session._id }).sort({ submittedAt: 1 }).lean();
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const dailyTotals = computeDailyTotals(session, entries);
  streamSessionReport(res, { session, entries, total, dailyTotals });
});

// ---------- Formulaire public (lien partagé) ----------

app.get('/api/public/:slug', async (req, res) => {
  const session = await Session.findOne({ slug: req.params.slug }).lean();
  if (!session) return res.status(404).json({ error: 'Lien invalide' });
  res.json({
    title: session.title,
    type: session.type,
    status: session.status,
    dayCount: session.dayCount,
  });
});

app.post('/api/public/:slug/entries', async (req, res) => {
  const session = await Session.findOne({ slug: req.params.slug });
  if (!session) return res.status(404).json({ error: 'Lien invalide' });
  if (session.status === 'closed') {
    return res.status(403).json({ error: 'Cet événement est clôturé, les envois ne sont plus acceptés.' });
  }
  const { name, count, day } = req.body || {};
  const parsedCount = Number(count);
  if (!name || !name.trim() || !Number.isFinite(parsedCount) || parsedCount < 0) {
    return res.status(400).json({ error: 'Merci de renseigner un nom et un nombre valide.' });
  }

  let resolvedDay = null;
  if (session.type === 'croisade') {
    const parsedDay = parseInt(day, 10);
    if (!Number.isFinite(parsedDay) || parsedDay < 1 || parsedDay > session.dayCount) {
      return res.status(400).json({ error: 'Merci d\'indiquer un jour de croisade valide.' });
    }
    resolvedDay = parsedDay;
  }

  await Entry.create({
    sessionId: session._id,
    name: name.trim(),
    count: Math.round(parsedCount),
    day: resolvedDay,
  });
  res.json({ ok: true });
});

// ---------- Repli SPA : toute autre route sert le frontend React ----------

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(port, () => console.log(`Serveur lancé sur http://localhost:${port}`));
}

export default app;
