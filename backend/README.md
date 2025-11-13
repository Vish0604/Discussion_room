# Backend for collaborative editor

This minimal backend provides:

- REST API to create, list, read, and update documents.
- WebSocket endpoint for real-time document edits.
- Simple file-based persistence under `data/`.

Requirements
- Node 18+ (for ESM and fs/promises)

Install

```powershell
cd frontend/backend
npm install
```

Run

Dev (auto-restart):

```powershell
npm run dev
```

Production:

```powershell
npm start
```

API

- POST /api/docs -> create document (body: { title? })
- GET /api/docs -> list documents
- GET /api/docs/:id -> get document
- PUT /api/docs/:id -> update document (body: { content?, title? })

WebSocket

Connect to ws://localhost:4000/ws

Messages:

- Client -> Server: { type: 'doc:edit', id, content }
- Server -> Clients: { type: 'doc:update', doc }
