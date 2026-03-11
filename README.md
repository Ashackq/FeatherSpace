# FeatherSpace

Reduced SSR spatial communication platform.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Run server:

```bash
npm run dev:server
```

3. Run client (separate terminal):

```bash
npm run dev:client
```

## Workspace layout

- `client/` React + Phaser client
- `server/` Node.js + WebSocket state sync/signaling relay
- `shared/` contracts and schema files
- `configs/environments/` data-driven room definitions
- `docs/` project documentation

## Deploy to Vercel

Frontend deployment is preconfigured via `vercel.json`.

```bash
npm run build:client
```

For full realtime behavior, deploy `server/` to a persistent Node host (Railway/Render/Fly.io) and keep Vercel for the frontend.

Detailed steps: `docs/deployment_vercel.md`
