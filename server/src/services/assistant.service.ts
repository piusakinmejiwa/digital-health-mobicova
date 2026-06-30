import { anthropic } from '../config/anthropic';
import { classify, crisisReply, emergencyReply, Safety } from '../lib/buddySafety';
import { languageDirective, toLang, type Lang } from '../i18n';

// MobiCova Assistant — a friendly site guide that answers questions ABOUT the
// MobiCova platform (what it is, enrolment, channels, pricing, data safety).
// Grounded on a small curated FAQ. Personal HEALTH questions are handed off to
// the free Health Buddy — this assistant does not give health advice. Reuses the
// same language plumbing, so it is multilingual as languages come online.

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantAnswer = { reply: string; safety: Safety; handoff?: 'buddy' };

type Faq = { id: string; keywords: string[]; q: string; a: string };

// Curated MobiCova product FAQ (the assistant grounds its answers on these).
const FAQ: Faq[] = [
  { id: 'what-is', keywords: ['what', 'mobicova', 'about', 'platform', 'do'], q: 'What is MobiCova?', a: 'MobiCova is a digital health platform that connects people in Nigeria to care on any phone — through the web, USSD and WhatsApp. It offers health-plan enrolment, telemedicine, pharmacy fulfilment, and a free AI Health Buddy.' },
  { id: 'enrol', keywords: ['enrol', 'enroll', 'register', 'sign', 'join', 'signup', 'membership'], q: 'How do I enrol or sign up?', a: 'You can enrol through your organisation or an insurance partner. On a basic phone, dial the USSD code or message us on WhatsApp; online, use the sign-up page. You receive a membership ID once enrolled.' },
  { id: 'channels', keywords: ['phone', 'ussd', 'whatsapp', 'basic', 'internet', 'channel', 'smartphone'], q: 'Do I need a smartphone or internet?', a: 'No. MobiCova works on any phone: a web app for smartphones, plus USSD and WhatsApp for basic phones — so you can use core features without internet or a smartphone.' },
  { id: 'buddy', keywords: ['buddy', 'health', 'assistant', 'chatbot', 'questions'], q: 'What is the Health Buddy?', a: 'The Health Buddy is a free AI assistant that answers basic health questions in plain language, grounded in trusted sources and reviewed by a clinician. Try it at [Health Buddy](/buddy). It is information only, not a doctor.' },
  { id: 'buddy-free', keywords: ['free', 'cost', 'buddy', 'limit', 'pay'], q: 'Is the Health Buddy free?', a: 'Yes, the Health Buddy is free, with a daily limit on questions. It gives general health information, not a diagnosis.' },
  { id: 'languages', keywords: ['language', 'languages', 'pidgin', 'hausa', 'yoruba', 'igbo', 'english'], q: 'What languages do you support?', a: 'MobiCova is rolling out Nigerian languages — Pidgin, Hausa, Yoruba and Igbo — so you can use the service and the Health Buddy in the language you are most comfortable with.' },
  { id: 'telemedicine', keywords: ['doctor', 'telemedicine', 'consultation', 'consult', 'see'], q: 'Can I see a doctor?', a: 'Yes — MobiCova can connect you to a doctor for a consultation (telemedicine). Ask about it during enrolment or through your member portal.' },
  { id: 'pricing', keywords: ['price', 'pricing', 'cost', 'plan', 'plans', 'much', 'fee'], q: 'How much does it cost?', a: 'Plan pricing depends on the partner or insurer you enrol with. See [pricing](/pricing), or [book a demo](/contact) for partner-specific plans.' },
  { id: 'business', keywords: ['business', 'partner', 'insurer', 'clinic', 'pharmacy', 'employer', 'company', 'integration'], q: 'Can my business or organisation partner with MobiCova?', a: 'Yes. MobiCova provides digital health infrastructure for insurers, clinics, pharmacies and employers — enrolment, member management, telemedicine, claims and channels. [Book a demo](/contact) to discuss a partnership, or see [partners](/partners).' },
  { id: 'privacy', keywords: ['data', 'privacy', 'safe', 'secure', 'ndpr', 'protect'], q: 'Is my data safe?', a: 'We take privacy seriously and follow Nigeria’s data protection law (NDPR/NDPA). We use your data to provide the service and never sell it. See our Privacy Policy for detail.' },
  { id: 'ai', keywords: ['ai', 'artificial', 'intelligence', 'model', 'safe'], q: 'How do you use AI?', a: 'We use AI for the Health Buddy (basic health information) and to help organise symptom information for clinicians. It is grounded, reviewed by a clinician, and never replaces a doctor. See our AI Policy.' },
  { id: 'claims', keywords: ['claim', 'claims', 'insurance', 'reimburse'], q: 'How do claims work?', a: 'If your plan includes insurance, you can submit and track claims through MobiCova. Ask your provider or check your member portal.' },
  { id: 'pharmacy', keywords: ['pharmacy', 'medicine', 'drugs', 'prescription', 'delivery', 'pickup'], q: 'Can I get medicines?', a: 'MobiCova can help with prescriptions and pharmacy pickup or delivery, depending on your plan and partner pharmacies.' },
  { id: 'portal', keywords: ['portal', 'login', 'account', 'member', 'profile', 'signin'], q: 'How do I access my account?', a: 'Members can sign in to view their plan, care options, claims and profile. Use the member login with your phone number to get a one-time code.' },
  { id: 'contact', keywords: ['contact', 'support', 'help', 'reach', 'demo'], q: 'How do I contact MobiCova?', a: '[Contact us](/contact) or [book a demo](/contact). For a personal health question, use the free [Health Buddy](/buddy).' },
  { id: 'insurance-partner', keywords: ['insurer', 'insurance', 'hmo', 'partner', 'cover', 'company', 'plan', 'provider', 'axa', 'mansard', 'hygeia', 'reliance', 'leadway', 'avon', 'nem'], q: 'I have insurance through a partner — how do I use MobiCova?', a: 'If your insurer or HMO partners with MobiCova, you can enrol through them and use your plan via the app, USSD or WhatsApp. Check with your insurer, or contact us to confirm your plan is supported.' },
  { id: 'availability', keywords: ['where', 'available', 'state', 'location', 'area', 'region', 'nigeria'], q: 'Where is MobiCova available?', a: 'MobiCova is rolling out across Nigeria. Which plans are available depends on your insurer or partner — contact us or book a demo to check your area.' },
  { id: 'get-started', keywords: ['start', 'started', 'try', 'begin', 'first', 'new'], q: 'How do I get started?', a: 'The quickest way is to try the free [Health Buddy](/buddy) — no sign-up needed. To enrol as a member, [sign up](/register) or go through your organisation or insurance partner. If you represent a business, [book a demo](/contact).' },
  { id: 'cancel', keywords: ['cancel', 'stop', 'unsubscribe', 'leave', 'refund', 'quit'], q: 'How do I cancel or leave?', a: 'To change or cancel a plan, contact the organisation or insurer you enrolled through, or reach MobiCova support. The free Health Buddy can simply be stopped any time.' },
  { id: 'emergency', keywords: ['emergency', 'urgent', 'danger', 'ambulance', '112', 'dying'], q: 'Is MobiCova for emergencies?', a: 'No — MobiCova and the Health Buddy are not emergency services. If you or someone is in danger, call 112 or go to the nearest hospital immediately.' },
];

const STOP = new Set(['what', 'is', 'the', 'a', 'an', 'do', 'does', 'how', 'can', 'i', 'my', 'me', 'you', 'your', 'to', 'of', 'and', 'for', 'with', 'on', 'in', 'it', 'are', 'about', 'get', 'use']);

function retrieve(text: string, limit = 3): Faq[] {
  const words = new Set((text.toLowerCase().match(/[a-z]{2,}/g) || []).filter((w) => !STOP.has(w)));
  if (words.size === 0) return [];
  const scored = FAQ.map((f) => {
    const hay = `${f.keywords.join(' ')} ${f.q} ${f.a}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += f.keywords.includes(w) ? 2 : 1;
    return { f, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.f);
}

// Heuristic: does this look like a personal health/symptom question (→ Buddy)?
const HEALTH_RE = /\b(symptom|fever|malaria|typhoid|headache|cough|catarrh|flu|cold\b|pregnan|diarr|vomit|nausea|rash|itch|infection|ulcer|asthma|allerg|diabet|hypertension|blood pressure|sore throat|toothache|sick|unwell|in pain|chest pain|stomach ?ache|medicine for|drug for|what.*should i (do|take).*(fever|pain|cough|cold|malaria|rash)|my (baby|child|head|body|stomach|chest|eye|skin|throat|tooth))\b/i;

const SYSTEM = `You are "Eze", a warm, helpful guide to the MobiCova Health platform in Nigeria. If asked your name, you are Eze, MobiCova's assistant.
- Answer questions ABOUT MobiCova, grounded in the FAQ provided. Be specific and genuinely useful — 2 to 5 short sentences, not vague. Don't invent prices, features, dates or promises; if the FAQ doesn't cover it, say so briefly and point them to contact/demo.
- ALWAYS end your answer with a relevant link to the most useful page, written as a markdown link like [Health Buddy](/buddy). Only use pages from this site map:
  /buddy — free AI Health Buddy (any personal health or symptom question)
  /pricing — plans & pricing      /contact — contact us / book a demo
  /register — sign up / enrol      /channels — USSD & WhatsApp for basic phones
  /partners — for insurers, clinics, pharmacies, employers      /about — about MobiCova
  /blog — articles & updates      /health-tips — free daily health tips
  /trust — data safety & security      /ai — how we use AI
- You do NOT give medical or health advice. For ANY personal health or symptom question, do not attempt a diagnosis or treatment — reply in one short sentence and direct them to the free [Health Buddy](/buddy).
- Use markdown links, and **bold** sparingly. Friendly, plain language. Only link to pages listed above.`;

export async function answerAssistant(messages: AssistantMessage[], langInput?: unknown): Promise<AssistantAnswer> {
  const lang: Lang = toLang(langInput);
  const latest = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // Safety first — even a product bot can receive a crisis message.
  const safety = classify(latest, lang);
  if (safety === 'crisis') return { reply: crisisReply(lang), safety };
  if (safety === 'emergency') return { reply: emergencyReply(lang), safety };

  const faqs = retrieve(latest);
  const sourcesBlock = faqs.map((f, i) => `[${i + 1}] ${f.q}\n${f.a}`).join('\n\n');

  // No key → deterministic fallback: top FAQ, health handoff, or a friendly default.
  if (!anthropic) {
    if (HEALTH_RE.test(latest)) {
      return { reply: 'For a personal health question, our free [Health Buddy](/buddy) can help. I can answer questions about MobiCova itself — enrolment, channels, [plans](/pricing) and more.', safety: 'ok', handoff: 'buddy' };
    }
    if (faqs.length) return { reply: faqs[0].a, safety: 'ok' };
    return { reply: "I can help with questions about MobiCova — what it is, how to [enrol](/register), our [channels](/channels), [plans](/pricing) and [data safety](/trust). What would you like to know?", safety: 'ok' };
  }

  try {
    const userTurn = `MobiCova FAQ:\n${sourcesBlock || '(no close match found)'}\n\nQuestion: ${latest}`;
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_BUDDY_MODEL || 'claude-haiku-4-5',
      max_tokens: 350,
      system: `${SYSTEM}${languageDirective(lang)}`,
      messages: [...history, { role: 'user', content: userTurn }],
    });
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    const handoff = HEALTH_RE.test(latest) ? 'buddy' as const : undefined;
    return { reply: text || (faqs[0]?.a ?? "I can help with questions about MobiCova. What would you like to know?"), safety: 'ok', handoff };
  } catch (err) {
    console.error('Assistant generation failed, returning fallback:', err);
    return { reply: faqs[0]?.a ?? "I can help with questions about MobiCova — enrolment, channels, plans and data safety.", safety: 'ok' };
  }
}
