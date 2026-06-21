import { env } from '../config/env';

// Geocoding + distance for routing prescriptions to the nearest pharmacy.
// Geocoding (address → coordinates) uses the Google Geocoding API and is gated
// on a key; the distance ranking itself is pure maths (no API), so once coords
// exist, "nearest" works regardless of the key.

export function geocodeConfigured(): boolean {
  return !!env.geocodeApiKey;
}

export type Coords = { lat: number; lng: number };

// Turn a free-text address into coordinates. Returns null if geocoding is
// unconfigured or the address can't be resolved (caller leaves coords unset).
export async function geocode(address: string): Promise<Coords | null> {
  const q = (address || '').trim();
  if (!q || !geocodeConfigured()) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${env.geocodeApiKey}`;
    const res = await fetch(url);
    const json: any = await res.json().catch(() => ({}));
    const loc = json?.results?.[0]?.geometry?.location;
    if (json?.status === 'OK' && loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch (err) {
    console.error('[geo] geocode failed:', err);
    return null;
  }
}

// Great-circle distance in kilometres (Haversine).
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
