// Hermetic test environment. Set BEFORE any src module loads — config/env reads
// process.env at import, and dotenv.config() does NOT override already-present
// keys, so these stick even if a real .env exists on disk.
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.ANTHROPIC_API_KEY = ''; // force AI "off" so the 503/fallback paths run
process.env.DATABASE_URL = '';      // no real DB; smoke tests never call query()
process.env.NODE_ENV = 'test';
