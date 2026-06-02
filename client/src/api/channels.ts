import api from './client';

// WhatsApp simulator — runs one conversational turn server-side and returns the
// assistant's reply (no Meta account needed).
export async function simulateWhatsapp(data: { from: string; message: string }): Promise<{ reply: string; done: boolean; step: string }> {
  return (await api.post('/channels/whatsapp/simulate', data)).data;
}

// USSD simulator — posts the accumulated, '*'-joined input exactly as a telco
// gateway would, and returns the raw `CON …` / `END …` screen text.
export async function simulateUssd(data: { phoneNumber: string; text: string }): Promise<string> {
  return (await api.post('/channels/ussd', data, { responseType: 'text' })).data;
}
