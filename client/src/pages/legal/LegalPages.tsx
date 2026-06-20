import type { ReactNode } from 'react';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';

// Public legal/policy pages. Content is a solid working draft — bracketed [ ... ]
// items and the overall wording should be confirmed by legal before launch.
const UPDATED = '19 June 2026';

function Legal({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="mk">
        <article style={{ maxWidth: 780, margin: '0 auto', padding: '48px 20px 64px', lineHeight: 1.7 }}>
          <h1 style={{ marginBottom: 6 }}>{title}</h1>
          <p style={{ color: '#5e6e6e', marginTop: 0 }}>Last updated: {UPDATED}</p>
          {intro && <p>{intro}</p>}
          {children}
        </article>
      </div>
      <SiteFooter />
    </>
  );
}

export function PrivacyPage() {
  return (
    <Legal
      title="Privacy Policy"
      intro="MobiCova Health (&ldquo;MobiCova&rdquo;, &ldquo;we&rdquo;) respects your privacy. This notice explains what we collect, why, and your rights under the Nigeria Data Protection Act / NDPR."
    >
      <h2>Who we are</h2>
      <p>MobiCova Health is the data controller for the information described here. Contact our privacy team at <strong>[privacy@mobicova.com]</strong>. Data Protection Officer: <strong>[name / contact]</strong>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Enrolment data</strong> — name, phone number, date of birth, gender, location and plan details you provide (via web, USSD or WhatsApp).</li>
        <li><strong>Health Buddy conversations</strong> — the questions you ask and our answers, tied to an anonymous session ID (no account needed). This can include health information, which is sensitive personal data.</li>
        <li><strong>Safety signals</strong> — where our automatic safety system detects a crisis, emergency or distress message, it is flagged for safety monitoring.</li>
        <li><strong>Technical data</strong> — limited device/network information needed to deliver the service.</li>
      </ul>

      <h2>Why we use it (lawful basis)</h2>
      <ul>
        <li>To provide enrolment, the Health Buddy and related services — performance of a service you requested, and your consent.</li>
        <li>For sensitive health data, we rely on your <strong>explicit consent</strong>, which you can withdraw at any time.</li>
        <li>To keep the service safe (e.g. route crisis messages to helplines) — protecting vital interests and our legitimate interest in user safety.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>Trusted processors who help us run the service under contract (hosting/infrastructure, our AI provider that generates Buddy answers, email/SMS providers, and payment processors), and the partner organisation you enrol through where relevant. We do <strong>not</strong> sell your data.</p>

      <h2>Cross-border transfer</h2>
      <p>Some processors operate outside Nigeria (for example our AI and hosting providers). Where data leaves Nigeria we ensure an adequate level of protection as required by the NDPA/NDPR <strong>[mechanism — adequacy / contractual safeguards]</strong>.</p>

      <h2>How long we keep it</h2>
      <p><strong>[Retention periods — e.g. enrolment data for the life of membership + X years; anonymous Buddy logs for X months for safety review.]</strong></p>

      <h2>Your rights</h2>
      <p>You can request access to, correction or deletion of your data, object to or restrict processing, and withdraw consent — contact <strong>[privacy@mobicova.com]</strong>. You may also complain to the <strong>Nigeria Data Protection Commission (NDPC)</strong>.</p>

      <h2>Security</h2>
      <p>We use technical and organisational measures (encryption in transit, access controls, audit logging) to protect your data.</p>

      <h2>Children</h2>
      <p><strong>[State position on under-18 use / parental consent.]</strong></p>

      <h2>Changes</h2>
      <p>We will update this notice as needed and post the current version with its date above.</p>
    </Legal>
  );
}

export function CookiePolicyPage() {
  return (
    <Legal
      title="Cookie Policy"
      intro="We keep this simple: MobiCova uses only essential, functional storage to make the site work. We do not use advertising or analytics tracking."
    >
      <h2>What we use</h2>
      <p>We store a small amount of information in your browser&rsquo;s local storage, only for things you asked the site to do:</p>
      <ul>
        <li><strong>Sign-in</strong> — to keep you logged in to your account.</li>
        <li><strong>Language</strong> — to remember the language you chose.</li>
        <li><strong>Health Buddy session</strong> — an anonymous ID so your conversation and daily limit work (no account, no personal details).</li>
      </ul>

      <h2>What we do NOT use</h2>
      <ul>
        <li>No advertising cookies.</li>
        <li>No third-party analytics or tracking pixels (e.g. Google Analytics, Meta Pixel).</li>
        <li>No cross-site profiling of your activity.</li>
      </ul>

      <h2>Do you need to consent?</h2>
      <p>Because we use only essential, functional storage and no tracking, the law does not require a cookie consent banner. You can clear this storage at any time in your browser settings; the site will simply forget your login and language.</p>

      <h2>Changes</h2>
      <p>If we ever introduce non-essential cookies, we will update this page and ask for your consent first.</p>
    </Legal>
  );
}

export function AiPolicyPage() {
  return (
    <Legal
      title="AI Policy"
      intro="MobiCova uses AI to make basic health information easier to reach. We believe in using it responsibly and being clear about how it works."
    >
      <h2>Where we use AI</h2>
      <p>Our free <strong>Health Buddy</strong> uses AI to answer basic, general health questions in plain language, including in Nigerian languages. We also use AI to help organise symptom information for clinicians.</p>

      <h2>How it works — and its limits</h2>
      <ul>
        <li><strong>Grounded answers.</strong> The Buddy answers only from a curated set of passages reviewed by a clinician and drawn from trusted sources (WHO, NHS and similar). It is instructed not to invent medical facts.</li>
        <li><strong>Not medical advice.</strong> It provides general information only. It does not diagnose, prescribe, or replace a qualified healthcare professional.</li>
        <li><strong>Not for emergencies.</strong> The Buddy is not an emergency or crisis service. A built-in safety layer detects crisis, emergency and distress messages and points you to Nigerian helplines and <strong>112</strong> instead of giving a health answer.</li>
        <li><strong>Human oversight.</strong> The health content is reviewed by a clinician, and flagged safety conversations are monitored.</li>
      </ul>

      <h2>Your data and AI</h2>
      <p>To generate answers, your question is sent to our AI provider. Health Buddy conversations are tied to an anonymous session ID, not your identity. See our <a href="/privacy">Privacy Policy</a> for full detail.</p>

      <h2>Languages</h2>
      <p>As we add Nigerian languages (Pidgin, Hausa, Yoruba, Igbo), the same safeguards apply in each language — including the safety layer that routes a cry for help to support, in that language.</p>

      <h2>Accountability</h2>
      <p>We keep a human in the loop, review our content and safety performance, and welcome feedback at <strong>[support@mobicova.com]</strong>.</p>
    </Legal>
  );
}
