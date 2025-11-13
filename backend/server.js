import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('failed to ensure data dir', e);
  }
}

await ensureDataDir();

function docFilePath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

// Create a new document
app.post('/api/docs', async (req, res) => {
  const { title = 'Untitled' } = req.body || {};
  const id = uuidv4();
  const doc = { id, title, content: '', updatedAt: new Date().toISOString() };
  await fs.writeFile(docFilePath(id), JSON.stringify(doc, null, 2));
  res.status(201).json(doc);
});

// Get a document
app.get('/api/docs/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const raw = await fs.readFile(docFilePath(id), 'utf8');
    const doc = JSON.parse(raw);
    res.json(doc);
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

// Save a document
app.put('/api/docs/:id', async (req, res) => {
  const id = req.params.id;
  const { content, title } = req.body || {};
  try {
    const raw = await fs.readFile(docFilePath(id), 'utf8');
    const doc = JSON.parse(raw);
    doc.content = content ?? doc.content;
    doc.title = title ?? doc.title;
    doc.updatedAt = new Date().toISOString();
    await fs.writeFile(docFilePath(id), JSON.stringify(doc, null, 2));
    // Broadcast to WS clients
    broadcast({ type: 'doc:update', doc });
    res.json(doc);
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

// List docs (simple)
app.get('/api/docs', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const docs = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf8');
      docs.push(JSON.parse(raw));
    }
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: 'failed' });
  }
});

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`API server listening on http://${HOST}:${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});

// WebSocket server for realtime
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  console.log('ws connected');
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'doc:edit') {
        // msg: { type: 'doc:edit', id, content }
        const { id, content } = msg;
        try {
          const rawDoc = await fs.readFile(docFilePath(id), 'utf8');
          const doc = JSON.parse(rawDoc);
          doc.content = content;
          doc.updatedAt = new Date().toISOString();
          await fs.writeFile(docFilePath(id), JSON.stringify(doc, null, 2));
          broadcast({ type: 'doc:update', doc });
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: 'doc not found' }));
        }
      }
    } catch (e) {
      console.warn('bad ws message', e);
    }
  });
});

export default app;
