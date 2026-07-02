# Karibu Ujerumani Deployment

## URL wiring

Canonical public app URL:

```text
https://www.karibujerumani.online/
```

The frontend resolves the API base in this order:

1. `window.KARIBU_API_BASE`, if set before `src/app.js` loads.
2. `localStorage.karibu_api_base`, useful for local QA.
3. Local/LAN preview fallback: `http://<current-host>:8000`.
4. Production fallback: same origin as the frontend.

The apex domain `https://karibujerumani.online/` redirects to the `www` URL above.

For this Vercel deployment, `vercel.json` routes backend paths through the FastAPI entrypoint at `api/index.py`, so the frontend should call the same origin:

```text
https://www.karibujerumani.online/auth/register
https://www.karibujerumani.online/health
```

For a split deployment, set this before the app module:

```html
<script>
  window.KARIBU_API_BASE = "https://api.your-domain.example";
</script>
```

Do not leave production pointing at `127.0.0.1` or `localhost`; those URLs only work on the developer machine.

If the backend is served on a separate public API host, set:

```html
<script>
  window.KARIBU_API_BASE = "https://api.karibujerumani.online";
</script>
```

If the backend is reverse-proxied under the same domain, no override is needed.

## Required hosted backend environment

Set these in Vercel project environment variables:

```text
DATABASE_URL=<Supabase transaction pooler URL>
SECRET_KEY=<strong production secret>
GEMINI_API_KEY=<optional, for Karibu Chat>
SUPABASE_URL=https://nmhqvnguhpktkcoyqwlc.supabase.co
SEED_DEMO_DATA=false
```

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
