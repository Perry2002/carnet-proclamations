import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

import { connectDB } from './db.js';
import Session from './models/Session.js';
import Entry from './models/Entry.js';
import Croisade from './models/Croisade.js';
import { signAdminToken, requireAuth } from './auth.js';
import { streamSessionReport, streamCroisadeReport } from './pdf.js';

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
app.use('/api/croisades', withDB);
app.use('/api/public', withDB);

const isProd = process.env.NODE_ENV === 'production';

async function totalsForSessionIds(sessionIds) {
  const totals = await Entry.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: '$sessionId', total: { $sum: '$count' }, entryCount: { $sum: 1 } } },
  ]);
  return Object.fromEntries(totals.map((t) => [String(t._id), t]));
}

function paginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  return { page, limit };
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

// ---------- Espace responsable : cultes (événements simples, un seul lien) ----------

app.post('/api/sessions', requireAuth, async (req, res) => {
  const { title } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le titre est requis' });
  }
  const session = await Session.create({
    title: title.trim(),
    type: 'culte',
    slug: nanoid(8),
  });
  res.json(session);
});

app.get('/api/sessions', requireAuth, async (req, res) => {
  const { page, limit } = paginationParams(req);
  const filter = { type: 'culte' };
  const total = await Session.countDocuments(filter);
  const sessions = await Session.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const totalsMap = await totalsForSessionIds(sessions.map((s) => s._id));
  res.json({
    items: sessions.map((s) => ({
      ...s,
      total: totalsMap[String(s._id)]?.total || 0,
      entryCount: totalsMap[String(s._id)]?.entryCount || 0,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
});

app.get('/api/sessions/:id', requireAuth, async (req, res) => {
  const session = await Session.findById(req.params.id).lean();
  if (!session) return res.status(404).json({ error: 'Événement introuvable' });
  const entries = await Entry.find({ sessionId: session._id }).sort({ submittedAt: 1 }).lean();
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  res.json({ session, entries, total });
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
  streamSessionReport(res, { session, entries, total });
});

// ---------- Espace responsable : semaines de croisade (un lien par jour) ----------

app.post('/api/croisades', requireAuth, async (req, res) => {
  const { title, dayCount } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le titre est requis' });
  }
  const parsed = parseInt(dayCount, 10);
  const resolvedDayCount = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 31) : 7;

  const croisade = await Croisade.create({ title: title.trim(), dayCount: resolvedDayCount });

  const daySessions = await Session.insertMany(
    Array.from({ length: resolvedDayCount }, (_, i) => ({
      title: `${title.trim()} — Jour ${i + 1}`,
      type: 'croisade',
      croisadeId: croisade._id,
      day: i + 1,
      slug: nanoid(8),
    }))
  );

  res.json({ croisade, sessions: daySessions });
});

app.get('/api/croisades', requireAuth, async (req, res) => {
  const { page, limit } = paginationParams(req);
  const total = await Croisade.countDocuments();
  const croisades = await Croisade.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const allDaySessions = await Session.find({
    croisadeId: { $in: croisades.map((c) => c._id) },
  }).lean();
  const totalsMap = await totalsForSessionIds(allDaySessions.map((s) => s._id));

  const byCroisade = {};
  for (const s of allDaySessions) {
    const key = String(s.croisadeId);
    if (!byCroisade[key]) byCroisade[key] = [];
    byCroisade[key].push(s);
  }

  res.json({
    items: croisades.map((c) => {
      const days = byCroisade[String(c._id)] || [];
      const dayTotal = days.reduce((sum, d) => sum + (totalsMap[String(d._id)]?.total || 0), 0);
      const entryCount = days.reduce((sum, d) => sum + (totalsMap[String(d._id)]?.entryCount || 0), 0);
      const openCount = days.filter((d) => d.status === 'open').length;
      return {
        ...c,
        total: dayTotal,
        entryCount,
        openCount,
        closedCount: days.length - openCount,
      };
    }),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
});

app.get('/api/croisades/:id', requireAuth, async (req, res) => {
  const croisade = await Croisade.findById(req.params.id).lean();
  if (!croisade) return res.status(404).json({ error: 'Semaine introuvable' });

  const days = await Session.find({ croisadeId: croisade._id }).sort({ day: 1 }).lean();
  const totalsMap = await totalsForSessionIds(days.map((d) => d._id));

  const dayList = days.map((d) => ({
    ...d,
    total: totalsMap[String(d._id)]?.total || 0,
    entryCount: totalsMap[String(d._id)]?.entryCount || 0,
  }));
  const grandTotal = dayList.reduce((sum, d) => sum + d.total, 0);

  res.json({ croisade, days: dayList, grandTotal });
});

app.patch('/api/croisades/:id/close-all', requireAuth, async (req, res) => {
  const croisade = await Croisade.findById(req.params.id).lean();
  if (!croisade) return res.status(404).json({ error: 'Semaine introuvable' });
  await Session.updateMany(
    { croisadeId: croisade._id, status: 'open' },
    { status: 'closed', closedAt: new Date() }
  );
  res.json({ ok: true });
});

app.get('/api/croisades/:id/report', requireAuth, async (req, res) => {
  const croisade = await Croisade.findById(req.params.id).lean();
  if (!croisade) return res.status(404).json({ error: 'Semaine introuvable' });

  const daySessions = await Session.find({ croisadeId: croisade._id }).sort({ day: 1 }).lean();
  const allEntries = await Entry.find({
    sessionId: { $in: daySessions.map((d) => d._id) },
  }).sort({ submittedAt: 1 }).lean();

  const entriesBySession = {};
  for (const e of allEntries) {
    const key = String(e.sessionId);
    if (!entriesBySession[key]) entriesBySession[key] = [];
    entriesBySession[key].push(e);
  }

  const days = daySessions.map((d) => {
    const dayEntries = entriesBySession[String(d._id)] || [];
    return {
      day: d.day,
      title: d.title,
      entries: dayEntries,
      total: dayEntries.reduce((sum, e) => sum + e.count, 0),
    };
  });
  const grandTotal = days.reduce((sum, d) => sum + d.total, 0);

  streamCroisadeReport(res, { croisade, days, grandTotal });
});

// ---------- Formulaire public (lien partagé, pour un culte ou un jour de croisade) ----------

app.get('/api/public/:slug', async (req, res) => {
  const session = await Session.findOne({ slug: req.params.slug }).lean();
  if (!session) return res.status(404).json({ error: 'Lien invalide' });
  res.json({ title: session.title, status: session.status });
});

app.post('/api/public/:slug/entries', async (req, res) => {
  const session = await Session.findOne({ slug: req.params.slug });
  if (!session) return res.status(404).json({ error: 'Lien invalide' });
  if (session.status === 'closed') {
    return res.status(403).json({ error: 'Cet événement est clôturé, les envois ne sont plus acceptés.' });
  }
  const { name, count } = req.body || {};
  const parsedCount = Number(count);
  if (!name || !name.trim() || !Number.isFinite(parsedCount) || parsedCount < 0) {
    return res.status(400).json({ error: 'Merci de renseigner un nom et un nombre valide.' });
  }
  await Entry.create({ sessionId: session._id, name: name.trim(), count: Math.round(parsedCount) });
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
