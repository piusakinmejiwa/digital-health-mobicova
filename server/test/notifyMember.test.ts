import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the channel senders + config so we can drive availability and outcomes
// deterministically, with no live credentials.
vi.mock('../src/config/env', () => ({ env: { resendApiKey: 'test', whatsappLang: 'en' } }));
vi.mock('../src/lib/messaging', () => ({
  smsConfigured: vi.fn(() => true),
  whatsappConfigured: vi.fn(() => true),
  sendSms: vi.fn(async () => ({ ok: true })),
  sendWhatsAppTemplate: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../src/lib/email', () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));

import * as messaging from '../src/lib/messaging';
import * as email from '../src/lib/email';
import { notifyMember } from '../src/lib/notifyMember';

const waCfg = messaging.whatsappConfigured as unknown as ReturnType<typeof vi.fn>;
const smsCfg = messaging.smsConfigured as unknown as ReturnType<typeof vi.fn>;
const wa = messaging.sendWhatsAppTemplate as unknown as ReturnType<typeof vi.fn>;
const sms = messaging.sendSms as unknown as ReturnType<typeof vi.fn>;
const mail = email.sendEmail as unknown as ReturnType<typeof vi.fn>;

const contact = { phone: '+2348010000000', whatsapp: '+2348010000000', email: 'm@example.com' };
const message = {
  sms: 'Reminder: your consultation is at 3pm.',
  whatsapp: { template: 'appointment_reminder', params: ['Amaka', 'today', '3pm'] },
  email: { subject: 'Reminder', html: '<p>Reminder</p>', text: 'Reminder' },
};

beforeEach(() => {
  vi.clearAllMocks();
  waCfg.mockReturnValue(true); smsCfg.mockReturnValue(true);
  wa.mockResolvedValue({ ok: true }); sms.mockResolvedValue({ ok: true }); mail.mockResolvedValue({ sent: true });
});

describe('notifyMember — reachOnce', () => {
  it('prefers WhatsApp when available and stops there', async () => {
    const r = await notifyMember(contact, message);
    expect(r.via).toBe('whatsapp');
    expect(r.delivered).toEqual(['whatsapp']);
    expect(wa).toHaveBeenCalledTimes(1);
    expect(sms).not.toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();
  });

  it('falls back to SMS when WhatsApp is unconfigured (e.g. Meta not approved yet)', async () => {
    waCfg.mockReturnValue(false);
    const r = await notifyMember(contact, message);
    expect(r.via).toBe('sms');
    expect(wa).not.toHaveBeenCalled();
    expect(sms).toHaveBeenCalledTimes(1);
    expect(mail).not.toHaveBeenCalled();
  });

  it('falls WhatsApp → SMS → email when each prior channel fails to send', async () => {
    wa.mockResolvedValue({ ok: false, error: 'template not approved' });
    sms.mockResolvedValue({ ok: false, error: 'AT down' });
    const r = await notifyMember(contact, message);
    expect(r.via).toBe('email');
    expect(r.attempted.map((a) => a.channel)).toEqual(['whatsapp', 'sms', 'email']);
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it('returns via=null when no channel can deliver', async () => {
    wa.mockResolvedValue({ ok: false, error: 'x' });
    sms.mockResolvedValue({ ok: false, error: 'y' });
    mail.mockResolvedValue({ sent: false, error: 'z' });
    const r = await notifyMember(contact, message);
    expect(r.via).toBeNull();
    expect(r.delivered).toEqual([]);
  });

  it('honours a custom channel order', async () => {
    const r = await notifyMember(contact, message, { order: ['sms', 'whatsapp', 'email'] });
    expect(r.via).toBe('sms');
    expect(wa).not.toHaveBeenCalled();
  });
});

describe('notifyMember — broadcast', () => {
  it('sends on every opted-in channel, independent of each other', async () => {
    const r = await notifyMember(contact, message, { mode: 'broadcast', channels: ['sms', 'email'] });
    expect(r.delivered.sort()).toEqual(['email', 'sms']);
    expect(sms).toHaveBeenCalledTimes(1);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(wa).not.toHaveBeenCalled(); // not in the opted-in set
  });

  it('a failed channel does not stop the others', async () => {
    sms.mockResolvedValue({ ok: false, error: 'AT down' });
    const r = await notifyMember(contact, message, { mode: 'broadcast', channels: ['sms', 'email'] });
    expect(r.delivered).toEqual(['email']);
    expect(mail).toHaveBeenCalledTimes(1);
  });
});
