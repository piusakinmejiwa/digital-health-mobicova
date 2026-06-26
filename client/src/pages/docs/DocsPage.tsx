import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './Docs.css';

interface Doc {
  id: string;
  group: string;
  kicker: string;
  title: string;
  toc: string[];
  body: string; // trusted static HTML
}

const DOCS: Doc[] = [
  {
    id: 'quickstart', group: 'Get started', kicker: 'Get started', title: 'Quick start',
    toc: ['Create an account', 'Your join code', 'Go live'],
    body: `
      <p>Welcome to MobiCova. This guide takes a new partner organisation from sign-up to enrolling its first member in about five minutes.</p>
      <h3>Create an account</h3>
      <p>Your platform admin creates your organisation and invites you. On first login you'll land on the <b>Dashboard</b> with a setup checklist that walks you through the essentials.</p>
      <h3>Your join code</h3>
      <p>Every organisation gets a 6-digit <b>join code</b>. Members type it as the first step of WhatsApp or USSD enrolment so the record is attributed to you.</p>
      <div class="callout">Tip: find your join code any time on the <b>WhatsApp &amp; USSD</b> page or via <code>/auth/me</code>.</div>
      <h3>Go live</h3>
      <p>Create your first plan, add members (or import a CSV), and you're collecting enrolments across every channel.</p>`,
  },
  {
    id: 'members', group: 'Get started', kicker: 'Get started', title: 'Adding members',
    toc: ['One at a time', 'Bulk CSV import', 'Over WhatsApp / USSD'],
    body: `
      <p>There are three ways to bring members onto the platform — all funnel into the same member records, attributed to your organisation.</p>
      <h3>One at a time</h3><p>Use <b>Members → Add member</b> for a single record with full health profile.</p>
      <h3>Bulk CSV import</h3><p>The Members page offers an <b>Import CSV</b> flow. The only required column is <code>fullName</code>; up to 1,000 rows per import, with a per-row error report.</p>
      <h3>Over WhatsApp / USSD</h3><p>Members self-enrol from a basic phone using your join code — no dashboard needed.</p>`,
  },
  {
    id: 'plans', group: 'Get started', kicker: 'Get started', title: 'Plans & enrolment',
    toc: ['Create a plan', 'Premiums', 'Enrolling members'],
    body: `
      <p>A plan is the cover members enrol into. Plans are tied to a NAICOM-licensed underwriter partner.</p>
      <h3>Create a plan</h3><p>Set a name, monthly premium (NGN) and underwriter. Refine covered benefits at any time.</p>
      <h3>Premiums</h3><p>Premiums are collected via Paystack (NGN-native) or Stripe. Commission and underwriter splits are visible on the Billing page.</p>
      <h3>Enrolling members</h3><p>Once a plan is live, members can enrol over any channel and pay their first premium.</p>`,
  },
  {
    id: 'whatsapp', group: 'Channels', kicker: 'Channels', title: 'WhatsApp & USSD intake',
    toc: ['How it works', 'USSD', 'WhatsApp'],
    body: `
      <p>Partners enrol members without the dashboard — from a feature phone (USSD) or a chat (WhatsApp). A short conversation collects the join code, name and gender, then writes a member record.</p>
      <h3>USSD</h3><p>Stateless — the aggregator replays the full input each request. Replies are prefixed <code>CON</code> (more input) or <code>END</code> (done).</p>
      <h3>WhatsApp</h3><p>Stateful — each sender's progress is persisted between messages.</p>
      <div class="callout">Try both without a telco account using the in-app simulators on the <b>WhatsApp &amp; USSD</b> page.</div>`,
  },
  {
    id: 'branding', group: 'Channels', kicker: 'Channels', title: 'Branding the portal',
    toc: ['Brand kit', 'Live preview'],
    body: `
      <p>White-label what members see on the portal, WhatsApp and their member card from <b>Branding</b>.</p>
      <h3>Brand kit</h3><p>Set a display name, logo mark, primary &amp; accent colours and a support contact.</p>
      <h3>Live preview</h3><p>A phone preview updates as you edit, so you see exactly what members will get before saving. The member app reads these settings live.</p>`,
  },
  {
    id: 'auth', group: 'Developers', kicker: 'Developers', title: 'API authentication',
    toc: ['API keys', 'Making a request', 'Rate limits'],
    body: `
      <p>The public REST API lives at <code>/api/public/v1</code> and is read-only, automatically scoped to your organisation.</p>
      <h3>API keys</h3><p>Generate keys from <b>API &amp; webhooks</b>. The full key (<code>mk_live_…</code>) is shown once; only a hash is stored.</p>
      <h3>Making a request</h3>
      <div class="code"><span class="p">$</span> curl https://api.mobicovahealth.com/api/public/v1/members \\
  -H <span class="s">"Authorization: Bearer mk_live_…"</span></div>
      <h3>Rate limits</h3><p>List endpoints take <code>?limit</code> (1–200) and <code>?offset</code>, returning <code>{ data, pagination }</code>.</p>`,
  },
  {
    id: 'webhooks', group: 'Developers', kicker: 'Developers', title: 'Webhooks',
    toc: ['Register an endpoint', 'Signature', 'Events'],
    body: `
      <p>Subscribe to events and MobiCova POSTs a signed JSON envelope to your endpoint.</p>
      <h3>Register an endpoint</h3><p>Add a URL on <b>API &amp; webhooks</b> and pick events (or leave empty for all). A per-endpoint secret is shown once.</p>
      <h3>Signature</h3><p>Each delivery carries <code>X-MobiCova-Signature: t=&lt;ts&gt;,v1=&lt;hmac&gt;</code> — HMAC-SHA256 of <code>&lt;timestamp&gt;.&lt;body&gt;</code>.</p>
      <h3>Events</h3><ul><li><code>member.enrolled</code></li><li><code>claim.created</code></li><li><code>claim.status_changed</code></li></ul>`,
  },
];

const GROUPS = ['Get started', 'Channels', 'Developers'];

export default function DocsPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('a') && DOCS.some((d) => d.id === params.get('a')) ? params.get('a')! : 'quickstart';
  const [activeId, setActiveId] = useState(initial);
  const doc = DOCS.find((d) => d.id === activeId) || DOCS[0];

  const open = (id: string) => {
    setActiveId(id);
    setParams({ a: id }, { replace: true });
    window.scrollTo(0, 0);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Help &amp; docs</h1>
          <p>Guides for getting the most out of MobiCova.</p>
        </div>
      </div>

      <div className="docs">
        <nav className="docs-nav">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="dn-group">{g}</div>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <span
                  key={d.id}
                  className={`dn-item ${d.id === activeId ? 'on' : ''}`}
                  onClick={() => open(d.id)}
                >
                  {d.title}
                </span>
              ))}
            </div>
          ))}
        </nav>

        <article className="docs-article">
          <div className="kick">{doc.kicker}</div>
          <h2>{doc.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: doc.body }} />
        </article>

        <aside className="docs-toc">
          <div className="tt">On this page</div>
          {doc.toc.map((t) => <a key={t}>{t}</a>)}
        </aside>
      </div>
    </div>
  );
}
