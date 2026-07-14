import './instrument'; // MUST stay first — registers Sentry before app deps load
import * as Sentry from '@sentry/node';
import app from './app';
import { env, assertConfig } from './config/env';
import { getMigrationStatus } from './lib/migrationStatus';

// Refuse to boot production on a weak/missing security config (fail-fast).
assertConfig();

// Last-resort safety net: a stray rejection or thrown error outside the
// request lifecycle should be logged (and reported), not silently terminate the
// process (which on Render surfaces as a 502 until the service restarts).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  Sentry.captureException(err);
});

app.listen(env.port, async () => {
  console.log(`MobiCova Digital Health API running on http://localhost:${env.port}`);

  // Surface migration drift loudly in the deploy logs — the #1 way new code ships
  // ahead of the hand-applied SQL. Never blocks boot.
  try {
    const m = await getMigrationStatus();
    if (m.available && m.pending.length > 0) {
      console.warn(`⚠️  ${m.pending.length} PENDING MIGRATION(S) not applied to the database:`);
      for (const p of m.pending) console.warn(`     · ${p}`);
      console.warn('   Apply the matching paste edition(s) in Supabase before relying on new features.');
    } else if (m.available) {
      console.log(`✓ Database schema up to date (${m.applied}/${m.total} migrations applied).`);
    }
    if (m.unknown.length > 0) {
      console.warn(`ℹ️  ${m.unknown.length} applied migration(s) have no matching file in this build: ${m.unknown.join(', ')}`);
    }
  } catch {
    /* the check is advisory — never let it take the service down */
  }

  // Security nudge: without a shared token the USSD/AT webhooks are open to the
  // internet (a valid org code is still required to actually enrol). Set
  // AT_WEBHOOK_TOKEN and append ?token=… to the Africa's Talking callback URLs.
  if (!env.atWebhookToken) {
    console.warn('⚠️  AT_WEBHOOK_TOKEN is not set — the USSD webhook is unauthenticated. Set it and append ?token=… to the AT callback URLs to lock it down. See docs/USSD-OPERATIONS.md.');
  }
});
