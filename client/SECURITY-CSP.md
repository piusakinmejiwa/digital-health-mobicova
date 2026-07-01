# Content-Security-Policy — client (SPA)

The document-level CSP in `index.html` carries only the directives that are safe to
ship blind for a Vite+React build:

```
upgrade-insecure-requests; object-src 'none'; base-uri 'self'
```

The higher-value directives (`script-src`, `style-src`, `connect-src`, `frame-src`)
must be delivered as **HTTP response headers from the static host** (Render Static
Site → Headers, or the CDN in front of it), NOT via `<meta>`, because:

- `frame-ancestors` and `report-uri` are ignored in a `<meta>` CSP.
- A wrong `connect-src` silently breaks **every** API/XHR call, and the full Vite
  bundle can't be exercised in the CI-less dev sandbox — so this needs to be enabled
  and verified against a real production build.

## Recommended header (adjust origins, then verify)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';        # React/inline style={{}} attributes need this
  img-src 'self' data: https:;             # Supabase storage, blog covers, avatars
  font-src 'self' data:;
  connect-src 'self' https://<API_ORIGIN> https://*.ingest.sentry.io https://*.daily.co;
  frame-src https://*.daily.co;            # telemedicine video iframe
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests
```

Replace `<API_ORIGIN>` with the real API host (e.g. `api.mobicovahealth.com` /
the `onrender.com` URL). Add any other third parties actually loaded (analytics, fonts).

## How to verify before enabling in prod
1. Build the client (`npm run build`) and serve `dist/` with the header above.
2. Open the app, sign in, load the dashboard, open Buddy/Ask-Eze, start a video call.
3. Watch the browser console for `Refused to … because it violates the … CSP`
   messages and widen the offending directive (usually `connect-src` for a missed
   API/telemetry origin, or `style-src`).
4. Only promote once the console is clean across the main flows.

Until then the document-level baseline above is active and adds no breakage risk.
