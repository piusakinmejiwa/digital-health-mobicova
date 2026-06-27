import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { smsConfigured, whatsappConfigured } from '../lib/messaging';

// Public platform status for the /status page. Reflects REAL availability: a
// live DB ping drives the overall state. The `services` map reports which
// capabilities are ENABLED (configuration), not their individual uptime — so we
// never imply a service is "down" when it's simply not switched on.
export async function getPlatformStatus(_req: Request, res: Response): Promise<void> {
  let db = false;
  try {
    await query('SELECT 1');
    db = true;
  } catch {
    db = false;
  }

  res.json({
    status: db ? 'operational' : 'degraded',
    components: {
      api: true,            // this handler responded
      database: db,
    },
    services: {
      telemedicine: !!env.dailyApiKey,
      sms: smsConfigured(),
      whatsapp: whatsappConfigured(),
      email: !!env.resendApiKey,
      payments: !!(env.paystackSecretKey || env.stripeSecretKey),
      ai: !!env.anthropicApiKey,
    },
    time: new Date().toISOString(),
  });
}
