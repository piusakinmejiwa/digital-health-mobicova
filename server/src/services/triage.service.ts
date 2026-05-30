import { anthropic, anthropicEnabled, TRIAGE_MODEL } from '../config/anthropic';

export type TriageLevel = 'emergency' | 'urgent' | 'gp' | 'self_care' | 'info' | 'unknown';

export interface TriageMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MemberContext {
  fullName?: string;
  gender?: string;
  dateOfBirth?: string | null;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
}

export interface TriageResult {
  reply: string;
  triageLevel: TriageLevel;
  recommendation: string;
  engine: 'claude' | 'rules';
}

const SYSTEM_PROMPT = `You are the MobiCova AI Health Assistant, serving users across Nigeria through a mobile app, WhatsApp, and USSD.

Your role is health TRIAGE and guidance — guiding people to the right level of care. You do NOT diagnose conditions, prescribe medication, or replace a doctor. MobiCova is a health platform that connects people to licensed providers; you help them decide what to do next.

Behaviour:
- Be warm, clear, and concise. Use simple language suitable for a wide audience.
- Ask focused follow-up questions when you need more information (one or two at a time).
- Take red-flag symptoms seriously (chest pain, difficulty breathing, stroke signs, severe bleeding, sudden severe pain, suicidal thoughts, pregnancy emergencies). Advise emergency care immediately for these.
- When appropriate, recommend a telemedicine consultation (available on MobiCova) or in-person care.
- Never provide a definitive diagnosis. Frame guidance as "this could be consistent with…" and direct to a clinician.

Assign exactly one triage level:
- "emergency": needs emergency care now (call emergency services / go to nearest hospital).
- "urgent": should see a doctor within 24 hours; offer a telemedicine consultation now.
- "gp": should book a (non-urgent) telemedicine or in-person consultation soon.
- "self_care": can likely be managed at home with guidance; safety-net advice on when to escalate.
- "info": general health information request, no symptoms to triage.

You MUST respond with ONLY a JSON object, no other text, in this exact shape:
{"reply": "<your conversational message to the user>", "triageLevel": "<one of: emergency|urgent|gp|self_care|info>", "recommendation": "<one short sentence: the recommended next action>"}`;

function ruleBasedTriage(messages: TriageMessage[]): TriageResult {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() || '';

  const emergency = ['chest pain', 'can\'t breathe', 'cannot breathe', 'difficulty breathing', 'unconscious',
    'severe bleeding', 'stroke', 'suicid', 'fainted', 'seizure', 'numb on one side'];
  const urgent = ['high fever', 'severe pain', 'vomiting blood', 'dehydrated', 'pregnan', 'broken', 'fracture',
    'persistent vomiting', 'blood in'];
  const gp = ['fever', 'cough', 'rash', 'headache', 'sore throat', 'pain', 'diarrhea', 'diarrhoea', 'malaria',
    'cold', 'flu', 'infection'];

  let triageLevel: TriageLevel = 'info';
  let reply = '';
  let recommendation = '';

  if (emergency.some((k) => lastUser.includes(k))) {
    triageLevel = 'emergency';
    reply = 'These symptoms can be serious. Please seek emergency care immediately — call your local emergency number or go to the nearest hospital now. Do not wait.';
    recommendation = 'Seek emergency care immediately.';
  } else if (urgent.some((k) => lastUser.includes(k))) {
    triageLevel = 'urgent';
    reply = 'This sounds like it should be reviewed by a doctor soon. I can connect you to a licensed doctor through a MobiCova telemedicine consultation within the next few hours. In the meantime, rest and stay hydrated, and seek emergency care if symptoms worsen.';
    recommendation = 'Book an urgent telemedicine consultation today.';
  } else if (gp.some((k) => lastUser.includes(k))) {
    triageLevel = 'gp';
    reply = 'Thanks for sharing that. This is something a doctor can help assess. I\'d recommend booking a telemedicine consultation so a licensed physician can review your symptoms. If anything gets significantly worse — like high fever, trouble breathing, or severe pain — please seek care urgently.';
    recommendation = 'Book a telemedicine consultation for review.';
  } else if (!lastUser.trim()) {
    triageLevel = 'info';
    reply = 'Hello! I\'m the MobiCova Health Assistant. Tell me what symptoms you\'re experiencing or what health question you have, and I\'ll help guide you to the right care.';
    recommendation = 'Awaiting the user\'s symptoms or question.';
  } else {
    triageLevel = 'self_care';
    reply = 'Thanks for the details. From what you\'ve described, this may be manageable with rest and self-care for now. Keep monitoring how you feel. If symptoms persist beyond a few days, worsen, or you develop fever, severe pain, or breathing difficulty, please book a consultation or seek care.';
    recommendation = 'Self-care with monitoring; escalate if symptoms worsen.';
  }

  return { reply, triageLevel, recommendation, engine: 'rules' };
}

export async function runTriage(messages: TriageMessage[], member?: MemberContext): Promise<TriageResult> {
  if (!anthropicEnabled || !anthropic) {
    return ruleBasedTriage(messages);
  }

  let contextBlock = '';
  if (member) {
    const parts: string[] = [];
    if (member.gender) parts.push(`gender: ${member.gender}`);
    if (member.dateOfBirth) parts.push(`date of birth: ${member.dateOfBirth}`);
    if (member.allergies?.length) parts.push(`allergies: ${member.allergies.join(', ')}`);
    if (member.chronicConditions?.length) parts.push(`chronic conditions: ${member.chronicConditions.join(', ')}`);
    if (member.currentMedications?.length) parts.push(`current medications: ${member.currentMedications.join(', ')}`);
    if (parts.length) contextBlock = `\n\nKnown member health context (use to inform triage, but still ask what you need): ${parts.join('; ')}.`;
  }

  try {
    const response = await anthropic.messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT + contextBlock,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const parsed = parseTriageJson(text);
    if (parsed) {
      return { ...parsed, engine: 'claude' };
    }
    // If the model didn't return clean JSON, surface its text as the reply.
    return { reply: text || 'Sorry, I had trouble responding. Could you rephrase?', triageLevel: 'unknown', recommendation: '', engine: 'claude' };
  } catch (err) {
    console.error('Claude triage failed, falling back to rules:', err);
    return ruleBasedTriage(messages);
  }
}

function parseTriageJson(text: string): Omit<TriageResult, 'engine'> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (typeof obj.reply === 'string') {
      const levels: TriageLevel[] = ['emergency', 'urgent', 'gp', 'self_care', 'info'];
      const triageLevel: TriageLevel = levels.includes(obj.triageLevel) ? obj.triageLevel : 'unknown';
      return { reply: obj.reply, triageLevel, recommendation: obj.recommendation || '' };
    }
  } catch {
    return null;
  }
  return null;
}
