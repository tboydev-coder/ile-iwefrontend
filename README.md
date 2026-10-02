# Standalone frontend

This directory contains all React UI, client routing, static assets, and browser tooling. It builds without the backend source directory.

```powershell
npm ci
$env:VITE_API_URL='http://127.0.0.1:8000/api/v1'
npm run dev
```

For persistent local configuration, create `.env` containing only `VITE_API_URL=http://127.0.0.1:8000/api/v1`. The complete project variable reference is `../backend/.env.example`; never copy backend secrets into the frontend. The local fallback API URL is also port `8000`.

For deployment, set `VITE_API_URL` to your public HTTPS API URL and run `npm run build`. Publish `dist/` and rewrite client routes to `index.html`. Changing the API URL requires a rebuild. No proxy or frontend server-side API is used. The backend must allow your frontend origin through `CORS_ORIGINS`.

Run `npm test` for component tests. Connected browser tests (`npm run test:e2e`) use `E2E_FRONTEND_URL` and optionally `E2E_BROWSER_PATH`; use a frontend configured against a disposable test API because these tests create data.
