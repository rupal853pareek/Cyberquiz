// Cyber Awareness - Permission Stats Backend
// Run with:  node server.js
// Requires: npm install express

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'responses.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load existing responses from disk so restarts don't lose data
let responses = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    responses = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.warn('Could not parse responses.json, starting fresh.');
    responses = [];
  }
}

function saveResponses() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2));
}

function normalizeStatus(v) {
  return ['granted', 'denied', 'dismissed', 'unsupported'].includes(v) ? v : 'unknown';
}

// POST /api/submit  -- called by the quiz page
app.post('/api/submit', (req, res) => {
  const { name, location, microphone, coords, timestamp } = req.body || {};
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name: (name || 'Anonymous').toString().trim().slice(0, 80) || 'Anonymous',
    location: normalizeStatus(location),
    microphone: normalizeStatus(microphone),
    coords: coords || null,
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString(),
    userAgent: (req.headers['user-agent'] || '').toString().slice(0, 200),
    timestamp: timestamp || new Date().toISOString(),
  };
  responses.push(entry);
  saveResponses();
  res.json({ ok: true, id: entry.id });
});

// GET /api/stats -- feeds the live dashboard
app.get('/api/stats', (req, res) => {
  const stats = {
    total: responses.length,
    location: { granted: 0, denied: 0, dismissed: 0, unsupported: 0, unknown: 0 },
    microphone: { granted: 0, denied: 0, dismissed: 0, unsupported: 0, unknown: 0 },
    recent: responses.slice(-25).reverse().map(r => ({
      name: r.name,
      location: r.location,
      microphone: r.microphone,
      timestamp: r.timestamp,
    })),
  };
  for (const r of responses) {
    stats.location[r.location] = (stats.location[r.location] || 0) + 1;
    stats.microphone[r.microphone] = (stats.microphone[r.microphone] || 0) + 1;
  }
  res.json(stats);
});

// POST /api/reset -- clears all responses (useful between sessions)
app.post('/api/reset', (req, res) => {
  responses = [];
  saveResponses();
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================');
  console.log(' Cyber Awareness Permissions Server is running');
  console.log('================================================');
  console.log(` Quiz page : http://localhost:${PORT}/`);
  console.log(` Dashboard : http://localhost:${PORT}/dashboard.html`);
  console.log(' ');
  console.log(' Share your LAN IP with attendees, e.g.');
  console.log('   http://<your-ip>:' + PORT + '/');
  console.log('================================================');
});
