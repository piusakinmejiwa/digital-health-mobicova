import { env } from './env';

// Paystack is the NGN-native payment processor for the Nigerian market. There is
// no official Node SDK, so we call its REST API directly with the global fetch
// (Node 18+). Authenticity of incoming webhooks is established by an HMAC-SHA512
// signature over the raw body using the same secret key — see billing.controller.
export const paystackSecretKey = env.paystackSecretKey;
export const paystackEnabled = !!paystackSecretKey;

const PAYSTACK_BASE = 'https://api.paystack.co';

interface InitParams {
  email: string;
  amount: number; // minor units (kobo for NGN)
  currency?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: { authorization_url: string; access_code: string; reference: string };
}

export async function paystackInitialize(params: InitParams): Promise<PaystackInitResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as PaystackInitResponse;
  if (!res.ok || !json.status) {
    throw new Error(`Paystack initialize failed: ${json.message || res.statusText}`);
  }
  return json;
}
