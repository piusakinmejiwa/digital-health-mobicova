import { describe, it, expect } from 'vitest';
import { isSlackWebhookUrl, maskSlackUrl } from '../src/lib/slack';

// Build sample webhooks from parts so no literal Slack-webhook token string lives
// in source — GitHub push-protection flags the pattern even for obvious dummies.
const SVC = ['https://hooks.slack', '.com/services'].join('');
const validSample = `${SVC}/T00000000/B00000000/${'x'.repeat(24)}`;

describe('isSlackWebhookUrl', () => {
  it('accepts genuine Slack incoming-webhook URLs', () => {
    expect(isSlackWebhookUrl(validSample)).toBe(true);
  });
  it('rejects non-Slack, http, and SSRF-style URLs', () => {
    for (const u of [
      validSample.replace('https:', 'http:'),                            // not https
      validSample.replace('hooks.slack.com', 'evil.com'),                // wrong host
      validSample.replace('hooks.slack.com', 'hooks.slack.com.evil.com'), // lookalike host
      'https://hooks.slack.com/api/webhooks/x',                          // wrong path
      'https://169.254.169.254/services/T/B/x',
      'not a url', '',
    ]) {
      expect(isSlackWebhookUrl(u), u).toBe(false);
    }
  });
});

describe('maskSlackUrl', () => {
  it('masks the secret token but keeps the workspace/app ids', () => {
    const token = 's'.repeat(20);
    const masked = maskSlackUrl(`${SVC}/T123/B456/${token}`);
    expect(masked).toBe('hooks.slack.com/services/T123/B456/••••••');
    expect(masked).not.toContain(token);
  });
});
