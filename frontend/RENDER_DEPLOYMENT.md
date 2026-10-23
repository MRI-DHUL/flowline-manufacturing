# Frontend Deployment

Render service: `flowline-manufacturing-ui`

- Root directory: `frontend`
- Build command: `npm ci --include=dev && npm run lint && npm test && npm run build`
- Publish directory: `dist`
- Auto-deploy: on commit; Render repeats frontend validation before publishing
- SPA rewrite: `/*` to `/index.html`

Production URL: `https://flowline-manufacturing-ui.onrender.com`