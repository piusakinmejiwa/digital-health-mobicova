// ─────────────────────────────────────────────────────────────────────────────
// Social media links shown in the site footer (and anywhere <SocialLinks/> is used).
//
// HOW TO ADD A LINK LATER:
//   Once you've created the account, paste its full URL into the matching `url`
//   below and redeploy. Leave `url` empty ('') to hide that icon — no dead links.
//   e.g.  { key: 'youtube',  ...  url: 'https://youtube.com/@mobicovahealth' },
// ─────────────────────────────────────────────────────────────────────────────

export type Social = { key: string; label: string; url: string };

export const SOCIALS: Social[] = [
  { key: 'youtube',   label: 'YouTube',   url: '' },
  { key: 'linkedin',  label: 'LinkedIn',  url: '' },
  { key: 'instagram', label: 'Instagram', url: '' },
  { key: 'facebook',  label: 'Facebook',  url: '' },
  { key: 'x',         label: 'X',         url: '' },
  { key: 'tiktok',    label: 'TikTok',    url: '' },
];
