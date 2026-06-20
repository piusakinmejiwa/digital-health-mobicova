import type { ReactElement } from 'react';

// Branded, theme-specific hero illustrations (vector). Used as the visual on each
// content page until a real photo URL is supplied (see contentData heroImage).
// Warm teal panel + simple white iconography, with an orange accent.
const ICONS: Record<string, ReactElement> = {
  care: ( // telemedicine — chat bubble + medical cross
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M150 110h150a22 22 0 0 1 22 22v70a22 22 0 0 1-22 22h-70l-34 30v-30h-46a22 22 0 0 1-22-22v-70a22 22 0 0 1 22-22z" />
      <path d="M225 140v54M198 167h54" stroke="#F0A93C" />
    </g>
  ),
  people: ( // about / careers — community
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="240" cy="120" r="26" />
      <path d="M196 220c0-30 20-48 44-48s44 18 44 48" />
      <circle cx="160" cy="150" r="20" stroke="#F0A93C" />
      <path d="M126 222c0-24 16-38 34-38" stroke="#F0A93C" />
      <circle cx="320" cy="150" r="20" />
      <path d="M320 184c18 0 34 14 34 38" />
    </g>
  ),
  network: ( // partners — hub & spokes
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="240" cy="180" r="26" />
      <circle cx="150" cy="110" r="18" stroke="#F0A93C" />
      <circle cx="330" cy="110" r="18" />
      <circle cx="150" cy="250" r="18" />
      <circle cx="330" cy="250" r="18" stroke="#F0A93C" />
      <path d="M165 122l55 42M315 122l-55 42M165 238l55-42M315 238l-55-42" />
    </g>
  ),
  message: ( // contact — speech bubble + dots
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M150 110h180a20 20 0 0 1 20 20v80a20 20 0 0 1-20 20H230l-44 34v-34h-36a20 20 0 0 1-20-20v-80a20 20 0 0 1 20-20z" />
      <circle cx="200" cy="170" r="5" fill="#fff" stroke="none" />
      <circle cx="240" cy="170" r="5" fill="#F0A93C" stroke="none" />
      <circle cx="280" cy="170" r="5" fill="#fff" stroke="none" />
    </g>
  ),
  shield: ( // insurance — shield + check
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M240 90l70 26v60c0 48-30 80-70 98-40-18-70-50-70-98v-60z" />
      <path d="M210 178l22 22 42-46" stroke="#F0A93C" />
    </g>
  ),
  devices: ( // channels — phones
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="170" y="100" width="86" height="160" rx="16" />
      <path d="M200 232h26" />
      <rect x="276" y="140" width="64" height="120" rx="14" stroke="#F0A93C" />
      <path d="M298 240h20" stroke="#F0A93C" />
    </g>
  ),
  code: ( // developers — code brackets
    <g fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
      <path d="M196 130l-46 50 46 50" />
      <path d="M284 130l46 50-46 50" />
      <path d="M258 116l-36 128" stroke="#F0A93C" />
    </g>
  ),
  webhook: ( // webhooks — connected nodes
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="170" cy="130" r="20" />
      <circle cx="320" cy="160" r="20" stroke="#F0A93C" />
      <circle cx="230" cy="250" r="20" />
      <path d="M186 146l34 88M250 244l54-72M188 132h112" />
    </g>
  ),
  tag: ( // pricing — price tag
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M160 150l78-40 92 40v0a16 16 0 0 1 0 0l-1 84-92 40-78-40z" transform="rotate(-8 240 180)" />
      <circle cx="214" cy="150" r="12" stroke="#F0A93C" />
      <path d="M235 205l40-18" stroke="#F0A93C" />
    </g>
  ),
  lock: ( // security — padlock
    <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="180" y="170" width="120" height="92" rx="14" />
      <path d="M204 170v-22a36 36 0 0 1 72 0v22" />
      <path d="M240 200v28" stroke="#F0A93C" />
      <circle cx="240" cy="200" r="3" fill="#F0A93C" stroke="#F0A93C" />
    </g>
  ),
};

export default function HeroIllustration({ kind = 'care' }: { kind?: string }) {
  return (
    <svg viewBox="0 0 480 360" width="100%" role="img" aria-hidden="true" style={{ display: 'block', borderRadius: 16 }}>
      <defs>
        <linearGradient id="mcHero" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A7B7B" />
          <stop offset="1" stopColor="#0E2A2A" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" rx="18" fill="url(#mcHero)" />
      <circle cx="410" cy="60" r="70" fill="#ffffff" opacity="0.06" />
      <circle cx="70" cy="320" r="90" fill="#F0A93C" opacity="0.10" />
      {ICONS[kind] || ICONS.care}
    </svg>
  );
}
