// server.js
console.log('[server] boot');

const express = require('express');
const cors = require('cors');
const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME,
  PORT
} = require('./config');

// node-fetch v3 via dynamic import
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// safety: surface unexpected errors
process.on('unhandledRejection', e => console.error('[server] unhandledRejection', e));
process.on('uncaughtException', e => console.error('[server] uncaughtException', e));

const app = express();
app.use(cors());
app.use(express.json());

// Airtable base config
const AT_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
const AT_HEADERS = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, table: AIRTABLE_TABLE_NAME });
});

// List tasks (optional filterByFormula)
app.get('/api/tasks', async (req, res) => {
  try {
    const url = new URL(AT_URL);
    if (req.query.filterByFormula) {
      url.searchParams.set('filterByFormula', req.query.filterByFormula);
    }
    const r = await fetch(url, { headers: AT_HEADERS });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);
    res.json(j);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create tasks (expects {records:[{fields:{...}}]})
app.post('/api/tasks', async (req, res) => {
  try {
    const r = await fetch(AT_URL, {
      method: 'POST',
      headers: AT_HEADERS,
      body: JSON.stringify(req.body),
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);
    res.json(j);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update a single task by ID: body => { fields: {...} }
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const r = await fetch(`${AT_URL}/${req.params.id}`, {
      method: 'PATCH',
      headers: AT_HEADERS,
      body: JSON.stringify({ fields: req.body.fields || {} }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);
    res.json(j);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bulk update: body => { records: [{ id, fields }, ...] }
app.patch('/api/tasks', async (req, res) => {
  try {
    const r = await fetch(AT_URL, {
      method: 'PATCH',
      headers: AT_HEADERS,
      body: JSON.stringify(req.body),
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);
    res.json(j);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const { runMorningRoutine } = require('./morning-triage-service');

app.post('/api/morning-routine', async (req, res) => {
  try {
    console.log('[morning-routine] incoming', req.body);
    const result = await runMorningRoutine(req.body || {});
    const safe = result || { success: false, promoted: [], decision: null, note: 'Empty result from routine' };
    console.log('[morning-routine] result', safe);
    res.json(safe);
  } catch (e) {
    console.error('[morning-routine] error', e);
    res.status(500).json({ error: e.message });
  }
});

console.log('[server] calling listen on', PORT);
app.listen(PORT, () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});