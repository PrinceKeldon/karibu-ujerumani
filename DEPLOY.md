# Karibu Ujerumani Deployment

## URL wiring

The frontend resolves the API base in this order:

1. `window.KARIBU_API_BASE`, if set before `src/app.js` loads.
2. `localStorage.karibu_api_base`, useful for local QA.
3. Local/LAN preview fallback: `http://<current-host>:8000`.
4. Production fallback: same origin as the frontend.

For a same-domain deployment, route API traffic through the same origin as the PWA.

For a split deployment, set this before the app module:

```html
<script>
  window.KARIBU_API_BASE = "https://api.your-domain.example";
</script>
```

Do not leave production pointing at `127.0.0.1` or `localhost`; those URLs only work on the developer machine.

## Current local preview

Frontend:

```bash
npm run dev
```

API:

```bash
venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open:

```text
http://127.0.0.1:5173/
```

## PWA files

- `manifest.webmanifest` is the active manifest.
- `sw.js` is the active service worker.
- `offline.html` is the navigation fallback.
- `icons/icon.svg` is the current install icon.

After any change to cached files, bump the service worker `VERSION` constant so browsers pick up the new assets.
