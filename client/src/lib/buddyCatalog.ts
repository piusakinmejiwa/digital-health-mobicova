// Specialty buddies shown on the Health Buddy dashboard. Keys must match
// server/src/lib/buddyCatalog.ts. Each buddy shares the same grounded + safety-
// filtered pipeline; the persona changes tone, framing and suggestions.

export type Specialty = {
  key: string;
  name: string;
  emoji: string;
  blurb: string;
  greeting: string;
  suggestions: string[];
};

export const SPECIALTIES: Specialty[] = [
  { key: 'general', name: 'General Health', emoji: '🩺', blurb: 'Everyday health questions',
    greeting: "Hi! 👋 Ask me a basic health question and I'll share what trusted sources say. I'm not a doctor — for anything serious I'll point you to one.",
    suggestions: ['What helps a fever?', 'What are malaria symptoms?', 'How do I stay hydrated?'] },
  { key: 'menstrual', name: 'Periods & Menstrual', emoji: '🌸', blurb: 'Periods, cycle & cramps',
    greeting: 'Hi! 🌸 Ask me about periods, cycles or cramps — general info from trusted sources.',
    suggestions: ['Is my cycle length normal?', 'What helps period cramps?', 'When should I see a clinician?'] },
  { key: 'gynaecology', name: "Women's Health", emoji: '♀️', blurb: "General women's health",
    greeting: "Hi! Ask me a general women's health question — I'll keep it to trusted, general information.",
    suggestions: ["General women's health tips", 'When should I see a clinician?'] },
  { key: 'paediatrics', name: "Children's Health", emoji: '🧒', blurb: 'For parents & caregivers',
    greeting: "Hi! 🧒 Ask me about your child's health — I'll share general info for caregivers, and flag when to see a clinician.",
    suggestions: ['My child has a fever', 'Keeping a child hydrated'] },
  { key: 'dietetics', name: 'Nutrition & Diet', emoji: '🥗', blurb: 'Healthy eating basics',
    greeting: 'Hi! 🥗 Ask me about healthy eating and staying hydrated.',
    suggestions: ['Tips for healthy eating', 'How much water do I need?'] },
  { key: 'mental_health', name: 'Mental Health', emoji: '🧠', blurb: 'Stress, mood & wellbeing',
    greeting: "Hi! 🧠 Ask me about stress, low mood or wellbeing — you're not alone, and I can point you to support.",
    suggestions: ['Ways to manage stress', "I've been feeling low"] },
  { key: 'general_consult', name: 'General Consultation', emoji: '💬', blurb: 'Not sure where to start?',
    greeting: "Hi! 💬 Tell me what's bothering you and I'll help point you to the right care.",
    suggestions: ["I'm not feeling well", 'Where should I get help?'] },
  { key: 'pharmacy', name: 'Medicines & Pharmacy', emoji: '💊', blurb: 'Using medicines safely',
    greeting: "Hi! 💊 Ask me general questions about taking medicines safely and what to ask your pharmacist. I won't recommend a specific medicine or dose for you — please confirm those with a pharmacist or clinician.",
    suggestions: ['How do I take medicines safely?', 'What should I ask my pharmacist?'] },
  { key: 'safe_emotions', name: 'Safe Emotions', emoji: '💚', blurb: 'A gentle space for feelings',
    greeting: "Hi, I'm here to listen. 💚 Share whatever's on your mind — gently and without judgement. If things feel heavy, I can point you to people who can help right now.",
    suggestions: ['I feel overwhelmed', 'I need someone to talk to'] },
];

export function specialtyByKey(key: string): Specialty {
  return SPECIALTIES.find((s) => s.key === key) || SPECIALTIES[0];
}
