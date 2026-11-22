import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { SwarmEngine } from '../engine/SwarmEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Serve static UI assets if built
const distPath = path.resolve(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

const engine = new SwarmEngine();

// Broadcast WebSocket events
engine.onEvent((event) => {
  const data = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
});

// REST Endpoints
app.get('/api/bots', (req, res) => {
  res.json({ bots: engine.getBots() });
});

app.get('/api/messages', (req, res) => {
  res.json({ messages: engine.getMessages() });
});

app.post('/api/messages', async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }
  const msg = await engine.postUserMessage(content);
  res.json({ message: msg });
});

app.get('/api/approvals', (req, res) => {
  res.json({
    pending: engine.getApprovalGate().getPendingApprovals(),
    history: engine.getApprovalGate().getHistory(),
  });
});

app.post('/api/approvals/:id', (req, res) => {
  const { id } = req.params;
  const { decision, modifiedInput } = req.body;
  if (!decision || !['approve', 'reject', 'modify'].includes(decision)) {
    return res.status(400).json({ error: 'Valid decision (approve, reject, modify) required' });
  }
  const ok = engine.getApprovalGate().resolveApproval(id, decision, modifiedInput);
  res.json({ success: ok });
});

app.get('/api/workspaces/:agentId', (req, res) => {
  const { agentId } = req.params;
  try {
    const info = engine.getWorkspaceManager().getWorkspaceInfo(agentId);
    res.json({ workspace: info });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[GrabBots Core Engine] Server running at http://localhost:${PORT}`);
  console.log(`[GrabBots Core Engine] WebSocket stream ready at ws://localhost:${PORT}`);
});
