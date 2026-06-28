import dotenv from 'dotenv';
dotenv.config();

// Allowed browser origins for CORS. CLIENT_URL may be a comma-separated list so a
// custom domain and the Render URL (and localhost in dev) can all be permitted.
// Trailing slashes are stripped so origins match the browser's Origin header.
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  // Error tracking (Sentry). Absent ⇒ disabled (errors log to the console only),
  // same graceful-degradation pattern as every other integration here. Set
  // SENTRY_DSN in the environment to switch on reporting — no code change.
  sentryDsn: process.env.SENTRY_DSN || '',
  appEnv: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  // 0 = capture errors only (no performance traces — cheapest). Raise toward 1.0
  // to sample a fraction of requests for latency tracing.
  sentryTracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0'),
  // When true, /readyz returns 503 while any migration in the repo hasn't been
  // applied to the database — an opt-in hard guard against serving traffic on a
  // schema the code doesn't match. Default off: boot logs + /health still warn.
  migrationsStrict: process.env.MIGRATIONS_STRICT === 'true',
  // The deployed git commit. Render injects RENDER_GIT_COMMIT automatically; it's
  // surfaced on /health so a post-deploy check can confirm it's hitting the NEW
  // version (not the old one still serving during a zero-downtime swap).
  gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '',
  databaseUrl: process.env.DATABASE_URL || '',
  // Optional PEM-encoded CA certificate for the database. When set, the server
  // verifies the DB's TLS certificate against it (defence against MITM) instead
  // of trusting it blindly. Supply via env to avoid committing the cert.
  databaseCaCert: process.env.DATABASE_CA_CERT || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID || '',
  // Optional — Supabase Storage for claim documents (receipts, scans). When the
  // URL + service-role key are set, uploads go to a private bucket and the API
  // stores a signed URL; when unset, claims still work but document upload is
  // disabled (graceful degradation, same as Stripe/Anthropic).
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'claim-documents',
  // Member portal OTP login. When true (or when no delivery channel is
  // configured), the one-time code is returned in the API response and logged so
  // the flow is testable without an SMS/WhatsApp gateway. Turn OFF in a real
  // deployment that has a delivery channel wired up.
  otpDevMode: process.env.OTP_DEV_MODE === 'true',
  // Transactional email (welcome / activation messages). When RESEND_API_KEY is
  // unset, email is in "demo mode": messages are logged, not sent — nothing
  // breaks (same graceful-degradation pattern as Stripe/WhatsApp). Set the key +
  // a verified EMAIL_FROM to switch on real delivery via Resend.
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'MobiCova <onboarding@mobicova.com>',
  // Optional inbox to notify when a "Shape MobiCova" (/shape) feedback form is submitted.
  feedbackNotifyEmail: process.env.FEEDBACK_NOTIFY_EMAIL || '',
  // Comma-separated emails granted platform-admin access to the catalog Admin UI.
  platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // Canonical client origin (first one listed) — used for redirect URLs (payment
  // callbacks etc.) where a single absolute URL is required.
  clientUrl: clientUrls[0],
  // Every allowed origin, for CORS.
  clientUrls,
  // Public base URL of THIS API, used to derive the SAML Service Provider
  // identifiers (entityID, ACS callback, login URL) that partners hand to their
  // IdP. Must be the externally reachable origin in production (e.g.
  // https://mobicova-api.onrender.com), with no trailing slash.
  serverUrl: (process.env.SERVER_URL || 'http://localhost:4000').replace(/\/$/, ''),
  // Dedicated PUBLIC bucket for blog images (Supabase Storage; reuses the existing
  // supabaseUrl + supabaseServiceRoleKey already configured for claim documents).
  supabaseBlogBucket: process.env.SUPABASE_BLOG_BUCKET || 'blog',
  // AI image generation (optional). Provider-agnostic; defaults to OpenAI. Add the
  // matching key to enable the "Generate with AI" buttons (images upload to the bucket).
  imageProvider: (process.env.IMAGE_PROVIDER || 'openai').toLowerCase(),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  // Cost controls for OpenAI image generation. quality: low (~$0.015) | medium
  // (~$0.06) | high (~$0.20). low is fine for web hero images.
  imageQuality: (process.env.IMAGE_QUALITY || 'low').toLowerCase(),
  imageSize: process.env.IMAGE_SIZE || '1536x1024',
  // Daily.co video calling (optional). Add DAILY_API_KEY to enable live
  // member ↔ doctor video consultations. Absent ⇒ the call endpoints return a
  // graceful 503 and the UI falls back to the demo call screen.
  dailyApiKey: process.env.DAILY_API_KEY || '',
  // Masked phone calls (Phase 2, optional). Provider-agnostic: Africa's Talking
  // (Nigeria-native) or Twilio. Absent ⇒ "Call my phone" is hidden and the voice
  // button keeps the in-app VoIP from Phase 1.
  voiceProvider: (process.env.VOICE_PROVIDER || 'africastalking').toLowerCase(),
  // Africa's Talking Voice. Use AT_SANDBOX=true + AT_USERNAME=sandbox to build/test
  // before a production voice number clears. AT_VOICE_NUMBER is the masking number
  // both parties see (e.g. +234…). AT_WEBHOOK_TOKEN guards the public callbacks.
  atUsername: process.env.AT_USERNAME || '',
  atApiKey: process.env.AT_API_KEY || '',
  atVoiceNumber: process.env.AT_VOICE_NUMBER || '',
  atSandbox: process.env.AT_SANDBOX === 'true',
  atWebhookToken: process.env.AT_WEBHOOK_TOKEN || '',
  // Twilio Voice (fallback provider; set VOICE_PROVIDER=twilio to use).
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioVoiceNumber: process.env.TWILIO_VOICE_NUMBER || '',
  // Outbound SMS via Africa's Talking (reuses AT_USERNAME/AT_API_KEY). Sender is
  // the alphanumeric sender ID or shortcode AT issues; blank uses the AT default.
  // Powers Daily Health Tips SMS. AT_SANDBOX routes to the AT sandbox.
  atSmsSender: process.env.AT_SMS_SENDER || '',
  // WhatsApp tips via Meta Cloud API reuse whatsappToken + whatsappPhoneId above.
  // Business-initiated tips need an APPROVED template; absent ⇒ skipped gracefully.
  whatsappTemplate: process.env.WHATSAPP_TEMPLATE || '',
  whatsappLang: process.env.WHATSAPP_LANG || 'en',
  // Shared secret a scheduler presents to POST /health-tips/run-daily so only
  // your cron (Render Cron / cron-job.org / GitHub Actions) can trigger sends.
  healthTipsCronSecret: process.env.HEALTH_TIPS_CRON_SECRET || '',
  // Shared secret guarding POST /reports/run (scheduled client reports). Point a
  // daily/weekly/monthly cron at /reports/run?cadence=… with this secret.
  reportsCronSecret: process.env.REPORTS_CRON_SECRET || '',
  // Google Geocoding API key — turns pharmacy/member addresses into coordinates
  // so prescriptions can route to the nearest pharmacy. Absent ⇒ geocoding is
  // skipped (coords can still be set directly); distance ranking just needs coords.
  geocodeApiKey: process.env.GEOCODE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
  // Consent-gated call recording (Daily cloud recording — a paid Daily feature).
  // Only records when the member consents AND this is on. Absent ⇒ no recording,
  // but consent is still captured for the record.
  dailyRecordingEnabled: process.env.DAILY_RECORDING_ENABLED === 'true',
  // Guards the public Daily recording webhook (?token= on the URL set in Daily).
  dailyWebhookToken: process.env.DAILY_WEBHOOK_TOKEN || '',
  // PharmaRun external pharmacy fulfilment (optional). Absent ⇒ prescriptions
  // stay on the internal pharmacist dispensary. PharmaRun picks the nearest
  // outlet from the patient's location; payment is settled upstream (B2B), so
  // the order is a pure fulfilment request.
  // TODO(pharmarun): confirm base URLs + auth scheme from the API docs.
  pharmarunApiKey: process.env.PHARMARUN_API_KEY || '',
  pharmarunBaseUrl: (process.env.PHARMARUN_BASE_URL || 'https://api.pharmarun.com').replace(/\/$/, ''),
  pharmarunSandboxUrl: (process.env.PHARMARUN_SANDBOX_URL || 'https://sandbox.pharmarun.com').replace(/\/$/, ''),
  pharmarunSandbox: process.env.PHARMARUN_SANDBOX === 'true',
  pharmarunWebhookSecret: process.env.PHARMARUN_WEBHOOK_SECRET || '',
};
