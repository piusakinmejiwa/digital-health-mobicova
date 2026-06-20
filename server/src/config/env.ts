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
};
