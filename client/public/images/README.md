# Marketing site images

The public landing page (`/`) uses these **self-hosted, AI-generated** photos of African people in
healthcare settings (owner-supplied — no third-party licensing). They're resized + JPG-optimised for
fast loading.

| File | Where it shows | Subject |
|------|----------------|---------|
| `hero.jpg` | Hero, top-right of the landing page | Clinician on a telehealth video call in a clinic |
| `insurer.jpg` | "Who it's for" → Insurers tab | Three professionals reviewing an analytics dashboard |
| `employer.jpg` | "Who it's for" → Employers tab | MobiCova-branded pharmacist with the dashboard |
| `telco.jpg` | "Who it's for" → Telcos tab | Community health worker helping a member use a phone |

## To swap a photo
Drop a replacement JPG in this folder using the **same filename** (the page references
`/images/<name>.jpg`). Recommended: landscape, ~1200–1400px wide, JPG, under ~250 KB. The slot ↔
filename mapping lives in `client/src/pages/marketing/MarketingPage.tsx` (`HERO_PHOTO` and each
audience's `photo`).

If a file is ever missing, the page falls back to a clean teal gradient with a ✚ — never a broken
image.
