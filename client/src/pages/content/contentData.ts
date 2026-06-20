// Content for the marketing/company/developer pages. Data-driven so all pages
// share one layout (ContentPage). Insurer-agnostic — no single client named.
export type Section = { h: string; p?: string; bullets?: string[] };
export type PageContent = {
  title: string;
  eyebrow?: string;
  intro: string;
  sections: Section[];
  ctaText?: string;
  ctaTo?: string;
  contactForm?: boolean;
};

export const CONTENT: Record<string, PageContent> = {
  about: {
    eyebrow: 'Company',
    title: 'About MobiCova',
    intro: 'MobiCova is digital health infrastructure for Nigeria and Africa — helping insurers, HMOs, employers, clinics and pharmacies connect people to care on any phone, in any language.',
    sections: [
      { h: 'Our mission', p: 'Make quality healthcare reachable for everyone — including the millions on basic phones and in underserved communities who traditional digital health leaves behind.' },
      { h: 'What we do', p: 'One platform for the whole journey of care:', bullets: ['Member enrolment over web, USSD and WhatsApp', 'Telemedicine consultations with licensed doctors', 'Pharmacy fulfilment and prescriptions', 'Health-plan and claims management', 'A free AI Health Buddy for basic health information'] },
      { h: 'Why it matters', p: 'We meet people where they are — on the phone they already have, in the language they actually speak — so getting help does not depend on a smartphone or fast internet.' },
    ],
    ctaText: 'Partner with us', ctaTo: '/contact',
  },
  partners: {
    eyebrow: 'Partners',
    title: 'Partner with MobiCova',
    intro: 'A single, multi-tenant platform that insurers, HMOs, employers, telcos, clinics and pharmacies plug into to enrol members and deliver care — branded as their own.',
    sections: [
      { h: 'Built for partners', p: 'Multi-tenant by design:', bullets: ['White-label branding — your name, colours and logo', 'Single sign-on (SSO/SAML) with your identity provider', 'REST API and webhooks to integrate with your systems', 'Granular roles, admin and a full audit trail', 'Usage and engagement analytics'] },
      { h: 'Who we work with', p: 'Insurers and HMOs, employers, telcos, clinics, pharmacies and diagnostics providers across the ecosystem.' },
      { h: 'How it works', p: 'Book a demo to see MobiCova branded for your organisation, we scope a pilot together, then launch — on infrastructure that already exists.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  careers: {
    eyebrow: 'Company',
    title: 'Careers at MobiCova',
    intro: 'We are building the rails for accessible healthcare across Africa. If that mission excites you, we would love to talk.',
    sections: [
      { h: 'Why join us', p: 'Real impact on people who need it most, the ownership of an early-stage team, and the chance to build infrastructure that matters.' },
      { h: 'How we work', p: 'A small team that ships fast, listens to users, and cares deeply about getting healthcare to people on any phone.' },
      { h: 'Open roles', p: 'We are always keen to meet talented people in engineering, clinical, partnerships and growth. Even if you do not see a specific role advertised, reach out and tell us how you would help.' },
    ],
    ctaText: 'Get in touch', ctaTo: '/contact',
  },
  contact: {
    eyebrow: 'Company',
    title: 'Contact us',
    intro: 'Questions, partnership enquiries or support — we would love to hear from you. Leave your details and we will be in touch.',
    sections: [
      { h: 'Other ways to reach us', p: 'For a partnership or demo, use the form above. For a basic health question, try the free Health Buddy — and for questions about MobiCova, ask Eze, our assistant.' },
    ],
    contactForm: true,
  },
  telemedicine: {
    eyebrow: 'Platform',
    title: 'Telemedicine',
    intro: 'Connect members to licensed doctors for consultations — by app, phone or WhatsApp, from wherever they are.',
    sections: [
      { h: 'For members', p: 'See a doctor without travelling, get referrals and follow-ups, and keep a record of your care — all on the phone you already have.' },
      { h: 'For partners', p: 'Telemedicine is built into enrolment and claims, backed by a network of licensed providers, and delivered across every channel.' },
      { h: 'On any phone', p: 'Works over the web and WhatsApp, with USSD-initiated access for basic phones — so care is not limited to smartphone owners.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  insurance: {
    eyebrow: 'Platform',
    title: 'Insurance & claims',
    intro: 'Manage health plans, enrol members and process claims on one platform — for insurers, HMOs and employers.',
    sections: [
      { h: 'Plan management', p: 'Configure plans, premiums, benefits and commissions, and manage your members from one console.' },
      { h: 'Enrolment on any phone', p: 'Bring members on board via web, USSD or WhatsApp — reaching people regardless of device or data.' },
      { h: 'Claims', p: 'Members submit and track claims with less friction, and your team manages them in one place.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  channels: {
    eyebrow: 'Platform',
    title: 'Channels — on any phone',
    intro: 'MobiCova reaches members where they are: a web app, WhatsApp, USSD and SMS — so no one is left out for lack of a smartphone or data.',
    sections: [
      { h: 'Web app', p: 'A full experience for smartphone users — enrolment, care, claims and the member portal.' },
      { h: 'WhatsApp', p: 'Conversational enrolment and the free Health Buddy, on the app most people already use.' },
      { h: 'USSD', p: 'Menu-driven access on any basic phone — no internet required.' },
      { h: 'SMS', p: 'Notifications and reminders to keep members informed.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  developers: {
    eyebrow: 'Developers',
    title: 'Developer platform & API',
    intro: 'Integrate MobiCova with your systems — enrolment, members, claims and real-time events — through a clean REST API.',
    sections: [
      { h: 'REST API', p: 'Programmatic access to core resources so you can connect MobiCova to your existing tools and workflows.' },
      { h: 'Webhooks', p: 'Receive real-time events at your own endpoints. See the Webhooks page for detail.' },
      { h: 'Keys & security', p: 'Scoped API keys, signed webhooks and audit logging. Sign in to your developer settings to generate keys and view the API console.' },
    ],
    ctaText: 'Talk to us', ctaTo: '/contact',
  },
  webhooks: {
    eyebrow: 'Developers',
    title: 'Webhooks',
    intro: 'Get notified in real time when things happen in MobiCova — new enrolments, claim updates and more — pushed straight to your systems.',
    sections: [
      { h: 'How it works', p: 'Register an endpoint, and MobiCova sends a signed HTTP request whenever a subscribed event occurs.' },
      { h: 'Events', p: 'Subscribe to the events that matter to you — such as enrolment and claim status changes.' },
      { h: 'Reliable & secure', p: 'Payloads are signed so you can verify they came from MobiCova, with retries for resilience.' },
    ],
    ctaText: 'Talk to us', ctaTo: '/contact',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pricing',
    intro: 'Flexible pricing that scales with your members. What you pay depends on your size, the channels you use, and the modules you need.',
    sections: [
      { h: 'How pricing works', p: 'Pricing is shaped by member numbers, the channels you enable (USSD, WhatsApp, SMS) and the modules you choose — so you only pay for what you use.' },
      { h: "What's included", p: 'The core platform, member enrolment and management, white-label branding, and the free AI Health Buddy as a front door to your services.' },
      { h: 'Get a tailored quote', p: 'Tell us about your members and goals and we will put together a quote and a pilot plan that fits.' },
    ],
    ctaText: 'Get a quote', ctaTo: '/contact',
  },
  security: {
    eyebrow: 'Trust',
    title: 'Security & compliance',
    intro: 'We build trust into the platform — protecting member data and meeting Nigerian data-protection requirements.',
    sections: [
      { h: 'Data protection', p: 'We align with the Nigeria Data Protection Act / NDPR, use member data only to deliver the service, and never sell it. See our Privacy Policy for detail.' },
      { h: 'Platform security', p: 'Encryption in transit, access controls, audit logging and single sign-on protect your members and your team.' },
      { h: 'On our roadmap', p: 'An independent security review and SOC 2 / ISO 27001 certification as we scale.' },
    ],
    ctaText: 'Talk to us', ctaTo: '/contact',
  },
};
