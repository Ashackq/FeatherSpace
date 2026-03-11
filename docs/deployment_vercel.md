# Vercel Deployment Guide

This project is ready for Vercel deployment for the frontend app in `client/`.

## What Deploys on Vercel

- Frontend SPA: `client/` (React + Vite)
- Build output: `client/dist`

Configured by:

- `vercel.json`

## Important Realtime Note

Vercel is excellent for hosting the frontend, but long-lived WebSocket state servers are not a good fit for Vercel Serverless Functions.

For production realtime behavior:

1. Deploy frontend on Vercel.
2. Deploy `server/` WebSocket service on a persistent host (Railway, Render, Fly.io, etc.).
3. Point frontend realtime URLs to that backend host.

## Deploy Steps

1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Keep project root as repository root.
4. Vercel auto-reads `vercel.json`:
   - install: `npm install`
   - build: `npm run build:client`
   - output: `client/dist`
5. Deploy.

## SPA Routing

`vercel.json` rewrites all routes to `index.html`, so app routes like:

- `/rooms`
- `/rooms/research-studio`
- `/settings`

load correctly on refresh.

## Recommended Next Step

Add environment-driven runtime config in the frontend (for example `VITE_WS_URL`) and set it in Vercel Project Settings when the realtime backend is deployed.