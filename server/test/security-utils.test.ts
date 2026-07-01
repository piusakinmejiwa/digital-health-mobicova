import { describe, it, expect } from 'vitest';
import { isPrivateIp, assertPublicHttpUrl, isBlockedHostnameForTest } from '../src/lib/ssrfGuard';
import { constantTimeEqual } from '../src/lib/safeCompare';

describe('ssrfGuard.isPrivateIp', () => {
  it('flags loopback / private / link-local / reserved IPv4', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '52.94.236.248']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
  it('flags loopback / ULA / link-local IPv6 and mapped private v4', () => {
    for (const ip of ['::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it('treats a non-IP string as unsafe', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

describe('ssrfGuard.assertPublicHttpUrl', () => {
  it('rejects the cloud metadata endpoint and other internal targets', () => {
    for (const u of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:4000/admin',
      'http://localhost/x',
      'http://10.1.2.3/',
      'https://foo.internal/x',
      'ftp://example.com/x',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(assertPublicHttpUrl(u), u).toBeNull();
    }
  });
  it('accepts a normal public https endpoint', () => {
    expect(assertPublicHttpUrl('https://hooks.example.com/mobicova')).not.toBeNull();
  });
});

describe('safeCompare.constantTimeEqual', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEqual('sha256=abc', 'sha256=abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('short', 'a-much-longer-value')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

// isBlockedHostnameForTest is only referenced by the test; keep a trivial assertion
// so an unused-import lint doesn't complain if the export is present.
describe('ssrfGuard hostnames', () => {
  it('blocks obvious internal hostnames', () => {
    expect(isBlockedHostnameForTest('localhost')).toBe(true);
    expect(isBlockedHostnameForTest('metadata.google.internal')).toBe(true);
    expect(isBlockedHostnameForTest('api.stripe.com')).toBe(false);
  });
});
