import app from './app';
import { env } from './config/env';

// Last-resort safety net: a stray rejection or thrown error outside the
// request lifecycle should be logged, not silently terminate the process
// (which on Render surfaces as a 502 until the service restarts).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.listen(env.port, () => {
  console.log(`MobiCova Digital Health API running on http://localhost:${env.port}`);
});
