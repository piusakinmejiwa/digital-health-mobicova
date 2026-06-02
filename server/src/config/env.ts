import dotenv from 'dotenv';
dotenv.config();

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
  // Comma-separated emails granted platform-admin access to the catalog Admin UI.
  platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Public base URL of THIS API, used to derive the SAML Service Provider
  // identifiers (entityID, ACS callback, login URL) that partners hand to their
  // IdP. Must be the externally reachable origin in production (e.g.
  // https://mobicova-api.onrender.com), with no trailing slash.
  serverUrl: (process.env.SERVER_URL || 'http://localhost:4000').replace(/\/$/, ''),
};
