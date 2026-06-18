import { HELPLINES } from './buddySafety';

// Curated short health tips for the USSD Health Buddy. USSD can't do open-ended
// chat (stateless, ~182-char screens), so it's a fixed menu of canned answers —
// reviewed here by the clinician, kept short, each naming its source. This is the
// "canned-answer library" from the buddy scope (also zero model cost).

type Tip = { key: string; label: string; text: string };

const TIPS: Tip[] = [
  { key: '1', label: 'Fever', text: 'Fever = body fighting infection. Rest and drink fluids. See a clinic if very high, lasts over 3 days, or with stiff neck or confusion. (NHS)' },
  { key: '2', label: 'Malaria', text: 'Malaria spreads by mosquito bites, common in Nigeria: fever, chills, headache. It can worsen fast - get tested and treated at a clinic. (WHO)' },
  { key: '3', label: 'Sore throat', text: 'Most sore throats are viral and ease in a week. Warm fluids and rest help. See a clinic if severe, over a week, or hard to swallow. (NHS)' },
  { key: '4', label: 'Hydration', text: 'For diarrhoea or vomiting, sip fluids; ORS replaces lost water and salts. Get care if little urine, sunken eyes, or a sleepy child. (WHO)' },
  { key: '5', label: 'Headache', text: 'Most headaches ease with rest, fluids and pain relief. Get urgent care for a sudden severe headache, or one with fever and stiff neck. (NHS)' },
  { key: '6', label: 'Mental health', text: 'Feeling low or anxious is common. Talk to someone you trust and keep a routine. If it lasts over 2 weeks or feels too much, see a clinician. (NHS)' },
];

const DISCLAIMER_SHORT = 'Info only, not a diagnosis.';

export function buddyMenuScreen(): string {
  const items = TIPS.map((t) => `${t.key} ${t.label}`).join('\n');
  return `MobiCova Health Buddy - pick a topic:\n${items}\n9 Emergency help`;
}

export function buddyTipScreen(choice: string): string {
  if (choice === '9') {
    const lines = HELPLINES.filter((h) => h.number !== '112')
      .slice(0, 2)
      .map((h) => `${h.name.split(' (')[0]} ${h.number}`)
      .join('\n');
    return `In danger? Call 112 now or go to the nearest hospital.\n${lines}`;
  }
  const tip = TIPS.find((t) => t.key === choice);
  if (!tip) return 'That is not a valid choice. Dial again and pick a number from the menu.';
  return `${tip.text}\n${DISCLAIMER_SHORT}`;
}

export function buddyTopicLabel(choice: string): string {
  if (choice === '9') return 'emergency';
  return TIPS.find((t) => t.key === choice)?.label || `choice ${choice}`;
}
