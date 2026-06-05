# Marketing site images

The public landing page (`/`) uses these **self-hosted** photos of African people in healthcare
settings. They're royalty-free (sourced from Pexels — Pexels License, free for commercial use, no
attribution required) and committed to the repo, so the site has no third-party image dependency.

| File | Where it shows | Subject |
|------|----------------|---------|
| `hero.jpg` | Hero, top-right of the landing page | Health check in a Lagos, Nigeria clinic |
| `insurer.jpg` | "Who it's for" → Insurers tab | Doctor & patient consultation |
| `employer.jpg` | "Who it's for" → Employers tab | Doctor reviewing results with a patient |
| `telco.jpg` | "Who it's for" → Telcos tab | Doctor explaining a diagnosis |

## To swap a photo
Drop a replacement JPG in this folder using the **same filename** — that's it (the page references
`/images/<name>.jpg`). Recommended: landscape, ~1200×900, JPG, optimised under ~300 KB
(e.g. tinypng.com). Slot ↔ filename mapping lives in `client/src/pages/marketing/MarketingPage.tsx`
(`HERO_PHOTO` and each audience's `photo`).

If a file is ever missing, the page falls back to a clean teal gradient with a ✚ — never a broken
image. Only use photos you've licensed or that are explicitly free for commercial use.
