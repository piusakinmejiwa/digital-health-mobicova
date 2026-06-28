import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import HeroIllustration from '../../components/marketing/HeroIllustration';
import {
  SUBPROCESSORS, SECURITY_MEASURES, COMPLIANCE, COMPLIANCE_BADGE, SECURITY_CONTACT,
} from '../../lib/trust';
import './Trust.css';

const UPDATED = '27 June 2026';

export default function TrustCenterPage() {
  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="trust">
          <header className="trust-hero">
            <div className="page-hero-art"><HeroIllustration kind="lock" /></div>
            <span className="trust-eyebrow">Trust &amp; Security</span>
            <h1>Security and data protection at MobiCova</h1>
            <p>
              MobiCova Health handles sensitive health information for insurers, employers and their members.
              This page sets out how we protect it — our security measures, who processes data on our behalf,
              and where we stand on compliance. Written plainly, and kept current.
            </p>
            <p className="trust-updated">Last updated: {UPDATED}</p>
          </header>

          {/* Compliance posture */}
          <section>
            <h2>Compliance posture</h2>
            <p className="trust-lead">We’re clear about what’s in place today and what’s still ahead — we don’t claim certifications we don’t hold.</p>
            <div className="trust-compliance">
              {COMPLIANCE.map((c) => {
                const badge = COMPLIANCE_BADGE[c.status];
                return (
                  <div key={c.title} className="trust-comp-card">
                    <div className="trust-comp-head">
                      <h3>{c.title}</h3>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p>{c.detail}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Security measures */}
          <section>
            <h2>How we protect your data</h2>
            <div className="trust-measures">
              {SECURITY_MEASURES.map((m) => (
                <div key={m.title} className="trust-measure">
                  <span className="trust-measure-icon" aria-hidden>{m.icon}</span>
                  <div>
                    <h3>{m.title}</h3>
                    <p>{m.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Data protection & privacy */}
          <section>
            <h2>Data protection &amp; privacy</h2>
            <p>
              We process personal and health data under the Nigeria Data Protection Act / NDPR, with GDPR-equivalent
              practices. We rely on a lawful basis for every use, take <strong>explicit consent</strong> for sensitive
              health data, and honour data-subject rights — access, correction, deletion and withdrawal of consent.
            </p>
            <p>
              Full detail is in our{' '}
              <a href="/privacy">Privacy Policy</a>, <a href="/cookies">Cookie Policy</a> and{' '}
              <a href="/ai">AI Policy</a>. We do not sell personal data, and we use no advertising or tracking cookies.
            </p>
          </section>

          {/* Data residency & transfers */}
          <section>
            <h2>Data residency &amp; transfers</h2>
            <p>
              Your core data — the database and uploaded documents — is hosted in the <strong>EU (London)</strong>.
              Some sub-processors (for example our AI, video and email providers) operate in the US or globally;
              where data leaves Nigeria we rely on contractual safeguards to maintain an adequate level of protection
              as required by the NDPA/NDPR.
            </p>
          </section>

          {/* Sub-processors */}
          <section>
            <h2>Sub-processors</h2>
            <p className="trust-lead">The third parties that help us run the service, what they do, and where they operate.</p>
            <div className="trust-table-wrap">
              <table className="trust-table">
                <thead>
                  <tr><th>Provider</th><th>Purpose</th><th>Region</th></tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((s) => (
                    <tr key={s.name}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.purpose}</td>
                      <td className="trust-region">{s.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* For B2B clients */}
          <section className="trust-cta">
            <h2>For insurers &amp; employers</h2>
            <p>
              We sign a <strong>Data Processing Agreement</strong> with every B2B client, and our team can walk your
              security and procurement reviewers through these controls. Signed-in administrators can review and
              accept the DPA, and request a data export, from <strong>Settings → Compliance</strong>.
            </p>
            <div className="trust-cta-actions">
              <a className="btn btn-primary" href="/contact">Request the DPA &amp; security pack</a>
              <a className="btn btn-secondary" href="/login">Admin sign in</a>
            </div>
          </section>

          {/* Responsible disclosure */}
          <section>
            <h2>Reporting a vulnerability</h2>
            <p>
              Found a security issue? We welcome responsible disclosure. Email{' '}
              <strong>{SECURITY_CONTACT}</strong> with the details and steps to reproduce, and please give us a
              reasonable window to investigate and fix before any public disclosure. We won’t pursue good-faith research.
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
