import { lookup } from 'dns';
import { isIP } from 'net';
import { promisify } from 'util';

const dnsLookup = promisify(lookup);

// SSRF defence for outbound fetches whose target URL is supplied by a tenant
// (webhook endpoints today). Two layers:
//   1. assertPublicHttpUrl() — a synchronous structural check at save time: must
//      be http/https and must not point at an obviously-internal host or a
//      literal private/loopback/link-local IP.
//   2. isPublicHost() — an async DNS-resolution check at delivery time: resolve
//      the hostname and reject if ANY resolved address is private. This guards
//      against a hostname that resolves to an internal IP and against DNS
//      rebinding (a name that was public at save time but points inward later).

// True if the literal IP is in a loopback / private / link-local / reserved range
// that must never be reachable from a server-side fetch.
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0) return true;                              // 0.0.0.0/8
    if (a === 10) return true;                             // 10.0.0.0/8
    if (a === 127) return true;                            // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;               // 169.254.0.0/16 link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;     // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                             // multicast / reserved
    return false;
  }
  if (v === 6) {
    const ipl = ip.toLowerCase();
    if (ipl === '::1' || ipl === '::') return true;        // loopback / unspecified
    if (ipl.startsWith('fe80')) return true;               // link-local
    if (ipl.startsWith('fc') || ipl.startsWith('fd')) return true; // unique-local fc00::/7
    // IPv4-mapped (::ffff:a.b.c.d) — extract and re-check as v4.
    const mapped = ipl.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // not a valid IP literal → treat as unsafe
}

// Hostnames that are always internal regardless of resolution.
function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === 'metadata.google.internal') return true;
  return false;
}

// Exposed for unit tests only.
export const isBlockedHostnameForTest = isBlockedHostname;

// Structural check used when a tenant SAVES a webhook URL. Rejects non-http(s),
// blocked hostnames, and literal private IPs. Returns the parsed URL or null.
export function assertPublicHttpUrl(u: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const host = parsed.hostname;
  if (!host) return null;
  if (isBlockedHostname(host)) return null;
  // If the host is a literal IP, block private ranges outright.
  if (isIP(host) && isPrivateIp(host)) return null;
  return parsed;
}

// Delivery-time check: resolve the hostname and confirm every address is public.
// Call this immediately before fetching a tenant-supplied URL.
export async function isPublicHost(host: string): Promise<boolean> {
  if (isBlockedHostname(host)) return false;
  if (isIP(host)) return !isPrivateIp(host);
  try {
    const results = await dnsLookup(host, { all: true });
    if (!results.length) return false;
    return results.every((r) => !isPrivateIp(r.address));
  } catch {
    return false; // unresolvable → refuse
  }
}
