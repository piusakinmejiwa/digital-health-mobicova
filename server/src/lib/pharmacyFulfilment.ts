import { env } from '../config/env';

// PharmaRun fulfilment adapter. Gated on PHARMARUN_API_KEY: absent ⇒
// pharmarunConfigured() is false and prescriptions stay on the internal
// pharmacist dispensary (graceful fallback, same pattern as the voice/Daily layers).
//
// Confirmed from the partner meeting:
//   • PharmaRun selects the nearest fulfilling outlet from the patient's location,
//     so we send the patient's address/coords (we do NOT manage their outlet list).
//   • Payment is settled upstream (employer/insurer/fintech/telco) and reconciled
//     B2B, so the order carries no payment fields and charges no one.
//
// TODO(pharmarun): everything marked below is a placeholder until we have the API
// spec — exact base URL, auth scheme, request/response field names, status
// strings, and webhook signature. The shape here is deliberately isolated so
// wiring the real spec is a contained change.

export function pharmarunConfigured(): boolean {
  return !!env.pharmarunApiKey;
}

function baseUrl(): string {
  return env.pharmarunSandbox ? env.pharmarunSandboxUrl : env.pharmarunBaseUrl;
}

export interface FulfilmentItem {
  medication: string;
  dosage?: string;
  instructions?: string;
  quantity?: number;
}

export interface FulfilmentOrderInput {
  prescriptionId: string;
  items: FulfilmentItem[];
  patient: {
    name: string;
    phone: string;
    address: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  prescriber: { name: string; mdcn?: string };
  deliveryMethod?: 'delivery' | 'pickup';
}

export interface FulfilmentOrderResult {
  orderId: string;
  status: string;
  trackingUrl?: string;
  raw?: unknown;
}

// Map our prescription into PharmaRun's create-order request body.
// TODO(pharmarun): rename/restructure fields to match their create-order schema.
function toPharmarunOrder(input: FulfilmentOrderInput): Record<string, unknown> {
  return {
    reference: input.prescriptionId, // our id, so webhooks can be reconciled
    customer: { name: input.patient.name, phone: input.patient.phone },
    // PharmaRun routes to the nearest outlet from this location:
    delivery_address: input.patient.address,
    city: input.patient.city,
    latitude: input.patient.latitude ?? undefined,
    longitude: input.patient.longitude ?? undefined,
    fulfilment: input.deliveryMethod ?? 'delivery',
    prescriber: input.prescriber.name,
    items: input.items.map((i) => ({
      name: i.medication,
      dosage: i.dosage,
      instructions: i.instructions,
      quantity: i.quantity ?? 1,
    })),
  };
}

// Submit an order to PharmaRun. Throws on failure; callers treat it as best-effort
// so a fulfilment hiccup never blocks issuing the prescription.
export async function createFulfilmentOrder(input: FulfilmentOrderInput): Promise<FulfilmentOrderResult> {
  if (!pharmarunConfigured()) throw new Error('PharmaRun is not configured');

  // TODO(pharmarun): confirm the path (e.g. POST /v1/orders).
  const res = await fetch(`${baseUrl()}/orders`, {
    method: 'POST',
    headers: {
      // TODO(pharmarun): confirm auth — API-key header vs Bearer token.
      Authorization: `Bearer ${env.pharmarunApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(toPharmarunOrder(input)),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!res.ok) {
    throw new Error(`PharmaRun order failed (${res.status}): ${json?.message || text.slice(0, 200)}`);
  }
  // TODO(pharmarun): map the real response field names.
  return {
    orderId: String(json?.id ?? json?.order_id ?? json?.data?.id ?? ''),
    status: String(json?.status ?? json?.data?.status ?? 'submitted'),
    trackingUrl: json?.tracking_url ?? json?.data?.tracking_url ?? undefined,
    raw: json,
  };
}

// Map a PharmaRun status string to our internal fulfilment_status state machine
// (pending → ready → out_for_delivery → delivered / collected / cancelled).
// TODO(pharmarun): replace the heuristics below with their documented statuses.
export function mapFulfilmentStatus(external: string): string {
  const s = (external || '').toLowerCase();
  if (/cancel|reject|fail|declin/.test(s)) return 'cancelled';
  if (/deliver(ed|y[_-]?complete)|completed/.test(s)) return 'delivered';
  if (/collect|picked[_-]?up/.test(s)) return 'collected';
  if (/out[_-]?for[_-]?delivery|dispatch|in[_-]?transit|en[_-]?route/.test(s)) return 'out_for_delivery';
  if (/ready|prepared|packed|accepted|confirmed/.test(s)) return 'ready';
  return 'pending';
}
