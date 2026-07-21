// Content for the marketing/company/developer pages. Data-driven so all pages
// share one layout (ContentPage). Insurer-agnostic — no single client named.
export type Section = { h: string; p?: string; bullets?: string[] };
export type Faq = { q: string; a: string };
export type PageContent = {
  title: string;
  eyebrow?: string;
  intro: string;
  lead?: string;
  sections: Section[];
  faq?: Faq[];
  ctaText?: string;
  ctaTo?: string;
  secondaryCtaText?: string;  // optional outline button next to the primary CTA
  secondaryCtaTo?: string;
  contactForm?: boolean;
  illustration?: string;  // HeroIllustration kind, shown when no heroImage is set
  heroImage?: string;     // paste a photo URL here to replace the illustration
};

export const CONTENT: Record<string, PageContent> = {
  about: {
    eyebrow: 'Company',
    title: 'About MobiCova',
    intro: 'MobiCova is digital health infrastructure for Nigeria and Africa — helping insurers, HMOs, telcos, clinics and pharmacies connect people to care on any phone, in any language.',
    lead: 'Most digital health tools assume a smartphone, fast data and English. Across Nigeria and much of Africa, that leaves out the majority. MobiCova is built the other way round — for basic phones, low data, and local languages first.',
    sections: [
      { h: 'Our mission', p: 'To make quality healthcare reachable for everyone — especially the millions who are hard to reach with conventional digital health. We do that by meeting people on the phone they already own, through the channel they already use, in the language they actually speak.' },
      { h: 'What we do', p: 'MobiCova is a single platform that carries the whole journey of care, so partners do not have to stitch together five different vendors:', bullets: [
        'Member enrolment over web, USSD and WhatsApp — no app or data required',
        'Telemedicine consultations with licensed doctors',
        'Pharmacy fulfilment, prescriptions and delivery',
        'Health-plan administration and claims processing',
        'A free AI Health Buddy that gives clinician-reviewed basic health information',
        'White-label branding, SSO and an API so partners run it as their own',
      ] },
      { h: 'How we are different', p: 'We lead with reach, not just features. A member can enrol and get help on a feature phone over USSD, ask a health question on WhatsApp in Pidgin, and have it all tie back to their insurer or HMO — without ever installing anything.' },
      { h: 'Built on trust', p: 'Health information is reviewed by a clinician, a deterministic safety layer routes crisis messages to Nigerian helplines, and member data is handled in line with the Nigeria Data Protection Act. Security and certification (SOC 2 / ISO 27001) are on our roadmap as we scale.' },
      { h: 'Who we serve', p: 'Insurers, HMOs and telcos, plus the clinics, pharmacies and diagnostics providers who deliver care — and, through them, the companies, members and patients who finally get easier access to care.' },
    ],
    faq: [
      { q: 'Is MobiCova a health insurer?', a: 'No. MobiCova is the technology platform that insurers and HMOs use to enrol members and deliver care. The cover itself comes from your insurer or plan.' },
      { q: 'Where does MobiCova operate?', a: 'We are focused on Nigeria first, building for the wider African market. Availability of specific plans depends on the partner you enrol through.' },
    ],
    ctaText: 'Partner with us', ctaTo: '/contact',
  },
  partners: {
    eyebrow: 'Partners',
    title: 'Partner with MobiCova',
    intro: 'A single, multi-tenant platform that insurers, HMOs, telcos, clinics and pharmacies plug into to enrol members and deliver care — branded as their own, live in weeks not months.',
    lead: 'Instead of building enrolment, channels, telemedicine and claims from scratch, you launch on infrastructure that already exists and already reaches members on any phone.',
    sections: [
      { h: 'Built for partners', p: 'MobiCova is multi-tenant from the ground up, so every partner gets their own branded, isolated workspace:', bullets: [
        'White-label branding — your name, colours and logo across the member experience',
        'Single sign-on (SSO / SAML) with your own identity provider',
        'REST API and webhooks to integrate enrolment, members, claims and events',
        'Granular roles and permissions for your team, with a full audit trail',
        'Usage, enrolment and engagement analytics',
      ] },
      { h: 'Who we work with', p: 'The platform is deliberately insurer-agnostic — it serves the whole ecosystem:', bullets: [
        'Insurers & HMOs — enrol and manage members, process claims',
        'Companies & their staff — reached through their insurer or HMO, with care on any phone',
        'Telcos — bundle health access with airtime and data',
        'Clinics & pharmacies — receive referrals and fulfil prescriptions',
        'Diagnostics providers — connect testing into the care journey',
      ] },
      { h: 'How a partnership works', p: 'It is a short path from conversation to launch:', bullets: [
        '1. Book a demo — see MobiCova branded for your organisation',
        '2. Scope a pilot — we agree channels, plans and success measures',
        '3. Launch — go live on existing infrastructure, branded as yours',
        '4. Grow — add channels, languages and modules as you scale',
      ] },
      { h: 'The free Health Buddy advantage', p: 'Our free, multilingual AI Health Buddy is an always-on front door that brings members in and keeps them engaged — a growth channel for your services rather than a cost centre.' },
    ],
    faq: [
      { q: 'Can the platform carry our brand?', a: 'Yes — it is fully white-label per organisation: your name, colours, logo and support details, with your own SSO.' },
      { q: 'How do we integrate with our existing systems?', a: 'Through our REST API and webhooks — push and pull enrolment, members, claims and real-time events. See the Developers and Webhooks pages.' },
      { q: 'How quickly can we launch?', a: 'Because the platform already exists, pilots typically start in weeks. The pace depends mainly on your integration and which channels you enable.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  careers: {
    eyebrow: 'Company',
    title: 'Careers at MobiCova',
    intro: 'We are building the rails for accessible healthcare across Africa. If using technology to get care to people who are usually left out sounds like your kind of work, we would love to talk.',
    sections: [
      { h: 'Why join us', p: 'The impact is real and immediate — every feature is about getting a person closer to care. You get the ownership and pace of an early-stage team, and the chance to build infrastructure that genuinely matters for the continent.' },
      { h: 'How we work', p: 'A small, focused team that ships quickly, talks to real users, and cares about the details that make the difference on a basic phone or a slow connection. We value clear thinking, kindness and getting things done.' },
      { h: 'Where we are hiring', p: 'We are always interested in strong people across:', bullets: [
        'Engineering — full-stack, mobile/USSD/WhatsApp channels, data',
        'Clinical & health content — reviewing and shaping what the platform tells people',
        'Partnerships & growth — working with insurers and HMOs',
        'Operations & support — keeping members and partners happy',
      ] },
      { h: 'No role listed for you?', p: 'We still want to hear from exceptional people. Tell us what you do and how you would help us reach more people with better care.' },
    ],
    faq: [
      { q: 'Do you hire remotely?', a: 'Tell us where you are and how you like to work — we care more about impact than location. Get in touch and we will be honest about what fits.' },
      { q: 'I am a clinician — can I get involved?', a: 'Yes. We work with clinicians to review health content and safety. Reach out via the contact form and mention your specialty.' },
    ],
    ctaText: 'Get in touch', ctaTo: '/contact',
  },
  contact: {
    eyebrow: 'Company',
    title: 'Contact us',
    intro: 'Partnership enquiries, demos, press or support — leave your details below and the right person will get back to you.',
    sections: [
      { h: 'Other ways to get help', p: 'For a partnership or demo, use the form above and tell us a little about your organisation. For a basic health question, the free Health Buddy can help straight away. For quick questions about MobiCova itself, ask Eze, our assistant, on any page.' },
      { h: 'For members', p: 'If you are already enrolled through an insurer or HMO, your fastest route for plan or claims questions is usually your member portal or your provider — but we are always happy to point you in the right direction.' },
    ],
    contactForm: true,
  },
  telemedicine: {
    eyebrow: 'Platform',
    title: 'Telemedicine',
    intro: 'Connect members to licensed doctors for consultations — by app, phone or WhatsApp — so getting medical advice does not mean travelling or waiting in a queue.',
    lead: 'For many people the nearest doctor is hours away. Telemedicine on MobiCova brings the consultation to the phone in their hand.',
    sections: [
      { h: 'For members', p: 'Speak to a qualified doctor from wherever you are, get a diagnosis or referral, follow up on a previous visit, and keep a simple record of your care — without losing a day of work or paying for transport.' },
      { h: 'For partners', p: 'Telemedicine is built into the same platform as enrolment and claims, backed by a network of licensed providers. It plugs into your plans, so a consultation can flow straight through to a referral, prescription or claim.' },
      { h: 'On any phone', p: 'Members on smartphones use the app or WhatsApp; members on basic phones can request a consultation over USSD and be called back — so telemedicine is not limited to people who can afford a smartphone and data.' },
      { h: 'Safe by design', p: 'Consultations are with licensed clinicians, and the free Health Buddy clearly stays in its lane — it offers basic information only and routes anything urgent to emergency services and helplines.' },
    ],
    faq: [
      { q: 'Do members need the internet?', a: 'Not necessarily — smartphone users can use the app or WhatsApp, while basic-phone users can request a callback over USSD.' },
      { q: 'Are the doctors licensed?', a: 'Yes. Consultations are delivered through a network of licensed, registered clinicians.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  insurance: {
    eyebrow: 'Platform',
    title: 'Insurance & claims',
    intro: 'Manage health plans, enrol members and process claims on one platform — purpose-built for insurers and HMOs who need to reach members on any phone.',
    sections: [
      { h: 'Plan management', p: 'Configure plans, premiums, benefits and commissions, and manage your whole membership from a single console — with the flexibility to support individual, family and group cover.' },
      { h: 'Enrolment on any phone', p: 'Bring members on board however they are reachable — a web form for smartphone users, a guided WhatsApp conversation, or a USSD flow on a basic phone. Every member gets a membership ID that works across channels.' },
      { h: 'Claims that flow', p: 'Members submit and track claims with far less friction, and your team manages and processes them in one place — reducing the back-and-forth that frustrates everyone and slows payouts.' },
      { h: 'Branded as yours', p: 'The entire experience carries your brand, with your own sign-on and support details, so members feel they are dealing directly with you — because they are.' },
    ],
    faq: [
      { q: 'Can members enrol without a smartphone?', a: 'Yes — enrolment works over USSD and WhatsApp as well as the web, so a basic phone is enough.' },
      { q: 'Does this replace our core insurance system?', a: 'It complements it. MobiCova handles enrolment, member engagement, channels and claims capture, and integrates with your systems via API.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  channels: {
    eyebrow: 'Platform',
    title: 'Channels — on any phone',
    intro: 'MobiCova reaches members where they actually are: a web app, WhatsApp, USSD and SMS. No one is left out for lack of a smartphone or data.',
    lead: 'Coverage is only as good as the channel that reaches the member. We cover the full range — from a polished web app to a feature-phone USSD menu.',
    sections: [
      { h: 'Web app', p: 'A full, modern experience for smartphone users — enrolment, care, claims, telemedicine and the member portal, all in one place.' },
      { h: 'WhatsApp', p: 'Conversational enrolment and the free Health Buddy, on the app most Nigerians already use every day — friendly, familiar and low-data.' },
      { h: 'USSD', p: 'Menu-driven access on any basic phone, with no internet required. Members dial a short code and navigate simple screens — the same flows, reachable by anyone.' },
      { h: 'SMS', p: 'Notifications, reminders and one-time codes to keep members informed and secure, even with no data at all.' },
      { h: 'Multilingual across every channel', p: 'As we roll out Nigerian Pidgin, Hausa, Yoruba and Igbo, members can use the channels — and the Health Buddy — in the language they are most comfortable with, with the same safety standards in each.' },
    ],
    faq: [
      { q: 'Which networks does USSD work on?', a: 'USSD is provisioned across the major Nigerian networks through our aggregator partners as part of go-live.' },
      { q: 'Do members pay for USSD or SMS?', a: 'That depends on the billing model agreed for your deployment — it can be sponsored or carried by standard airtime. We help you choose.' },
    ],
    ctaText: 'Book a demo', ctaTo: '/contact',
  },
  developers: {
    eyebrow: 'Developers',
    title: 'Developer platform & API',
    intro: 'Integrate MobiCova with your systems — enrolment, members, claims and real-time events — through a clean, well-scoped REST API.',
    sections: [
      { h: 'REST API', p: 'Programmatic access to the core resources you need, so you can connect MobiCova to your existing tools, data warehouse and member systems rather than running two sources of truth.' },
      { h: 'Webhooks', p: 'Subscribe to real-time events and receive signed callbacks at your own endpoints when something changes — see the Webhooks page for detail.' },
      { h: 'Keys & access', p: 'Generate scoped API keys from your developer settings, with an in-app API console to explore endpoints, and audit logging so you can see exactly what happened.' },
      { h: 'Security first', p: 'API keys are scoped and revocable, webhook payloads are signed so you can verify origin, and everything runs over encrypted transport. See the Security page for our wider posture.' },
    ],
    faq: [
      { q: 'How do I get API keys?', a: 'Sign in to your MobiCova workspace and open developer settings to generate and manage scoped keys. The in-app API console lets you try endpoints.' },
      { q: 'Is there a sandbox?', a: 'Yes — the platform includes simulators for the USSD and WhatsApp channels so you can build and test flows without going live.' },
    ],
    ctaText: 'Talk to us', ctaTo: '/contact',
    secondaryCtaText: 'View the API reference', secondaryCtaTo: '/developers/api',
  },
  webhooks: {
    eyebrow: 'Developers',
    title: 'Webhooks',
    intro: 'Get notified in real time when things happen in MobiCova — new enrolments, claim updates and more — pushed straight to your systems so you never have to poll.',
    sections: [
      { h: 'How it works', p: 'Register one or more HTTPS endpoints, choose the events you care about, and MobiCova sends a signed HTTP request to your endpoint whenever a subscribed event occurs.' },
      { h: 'Events you can subscribe to', p: 'Stay in sync with what matters to your business:', bullets: [
        'Member enrolment and updates',
        'Claim submission and status changes',
        'Other platform events as your integration grows',
      ] },
      { h: 'Reliable & verifiable', p: 'Each payload is signed so you can confirm it genuinely came from MobiCova, and deliveries are retried on failure so a brief outage on your side does not lose an event.' },
      { h: 'Manage from one place', p: 'Add, test and remove webhook endpoints from your developer settings, and use the audit log to see what was sent and when.' },
    ],
    faq: [
      { q: 'How do I verify a webhook is genuine?', a: 'Each request is signed; verify the signature with your endpoint secret before acting on the payload.' },
      { q: 'What happens if my endpoint is down?', a: 'Deliveries are retried, so a short outage will not cause you to miss events.' },
    ],
    ctaText: 'Talk to us', ctaTo: '/contact',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pricing',
    intro: 'Flexible pricing that scales with your members. What you pay depends on your size, the channels you use, and the modules you need — so you only pay for what you actually use.',
    lead: 'Every partner is different, so rather than a rigid price list we tailor a plan to your members and goals — and prove the value with a pilot first.',
    sections: [
      { h: 'How pricing works', p: 'Three things shape your cost:', bullets: [
        'Members — pricing scales with the size of your membership',
        'Channels — the per-message economics of USSD, WhatsApp and SMS vary, so your channel mix matters',
        'Modules — enrolment, telemedicine, claims, languages and more, chosen to fit your needs',
      ] },
      { h: "What's always included", p: 'The core platform, member enrolment and management, white-label branding, SSO, and the free AI Health Buddy as an always-on front door to your services.' },
      { h: 'Start with a pilot', p: 'We usually begin with a focused pilot so you can see real engagement and cost before committing at scale — then grow from there.' },
      { h: 'Get a tailored quote', p: 'Tell us roughly how many members you have, which channels you want, and what you are trying to achieve, and we will put together a clear quote and a pilot plan.' },
    ],
    faq: [
      { q: 'Why no fixed price list?', a: 'Because cost depends heavily on your member numbers and channel mix (USSD/WhatsApp/SMS economics differ). A short conversation gets you an accurate quote rather than a misleading headline figure.' },
      { q: 'Is there a free way to try it?', a: 'The Health Buddy is free to try right now, and we typically run a paid pilot so you can validate value before scaling.' },
    ],
    ctaText: 'Get a quote', ctaTo: '/contact',
  },
  security: {
    eyebrow: 'Trust',
    title: 'Security & compliance',
    intro: 'We build trust into the platform — protecting member data, securing the system, and meeting Nigerian data-protection requirements.',
    sections: [
      { h: 'Data protection', p: 'We align with the Nigeria Data Protection Act / NDPR. We collect only what is needed to deliver the service, use it only for that purpose, never sell it, and honour data-subject rights. See our Privacy Policy for the full picture.' },
      { h: 'Platform security', p: 'Protecting member and partner data is foundational:', bullets: [
        'Encryption of data in transit',
        'Role-based access controls and least privilege',
        'Audit logging of sensitive actions',
        'Single sign-on (SSO/SAML) for partner teams',
        'Scoped, revocable API keys and signed webhooks',
      ] },
      { h: 'Health-content safety', p: 'The AI Health Buddy answers only from clinician-reviewed sources, and a separate deterministic safety layer routes crisis, emergency and distress messages to Nigerian helplines and 112 — in every language we support.' },
      { h: 'On our roadmap', p: 'As we scale we are pursuing an independent security review and penetration test, and SOC 2 / ISO 27001 certification, to give partners formal assurance.' },
    ],
    faq: [
      { q: 'Are you NDPR-compliant?', a: 'We align our data handling with the Nigeria Data Protection Act / NDPR, and our Privacy Policy sets out lawful basis, rights and retention. Formal certifications are on our roadmap.' },
      { q: 'Do you sell member data?', a: 'No. Member data is used only to deliver the service and is never sold.' },
    ],
    ctaText: 'Talk to us', ctaTo: '/contact',
  },
};

// Which illustration each page uses (until a real photo URL is added via heroImage).
const ILLUSTRATIONS: Record<string, string> = {
  about: 'people', partners: 'network', careers: 'people', contact: 'message',
  telemedicine: 'care', insurance: 'shield', channels: 'devices',
  developers: 'code', webhooks: 'webhook', pricing: 'tag', security: 'lock',
};
for (const [k, v] of Object.entries(ILLUSTRATIONS)) {
  if (CONTENT[k]) CONTENT[k].illustration = v;
}
