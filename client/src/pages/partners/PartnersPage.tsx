import { useQuery } from '@tanstack/react-query';
import { listPartners } from '../../api/resources';
import type { Partner } from '../../types';
import './Partners.css';

const CATEGORY_META: Record<string, { label: string; blurb: string }> = {
  telemedicine: { label: 'Telemedicine providers', blurb: 'MDCN-licensed doctors delivering video and voice consultations.' },
  insurer: { label: 'Insurance underwriters', blurb: 'NAICOM-licensed HMOs and insurers underwriting health cover.' },
  pharmacy: { label: 'Pharmacy network', blurb: 'Licensed pharmacies fulfilling e-prescriptions and deliveries.' },
  diagnostics: { label: 'Diagnostics & labs', blurb: 'Accredited laboratories for tests and sample collection.' },
  ehr: { label: 'EHR & infrastructure', blurb: 'Electronic health record and clinical data infrastructure.' },
  distribution: { label: 'Distribution partners', blurb: 'Telcos and fintechs that extend reach to members at scale.' },
};

const CATEGORY_ORDER = ['telemedicine', 'insurer', 'pharmacy', 'diagnostics', 'ehr', 'distribution'];

export default function PartnersPage() {
  const { data: partners, isLoading } = useQuery({ queryKey: ['partners'], queryFn: () => listPartners() });

  const grouped = (partners || []).reduce<Record<string, Partner[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Partner ecosystem</h1>
          <p>MobiCova is a health platform and distributor — care is delivered by our licensed provider partners.</p>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state">Loading partners…</p>
      ) : (
        categories.map((cat) => {
          const meta = CATEGORY_META[cat] || { label: cat, blurb: '' };
          return (
            <section key={cat} className="partner-section">
              <div className="partner-section-head">
                <h2>{meta.label}</h2>
                <p className="muted small">{meta.blurb}</p>
              </div>
              <div className="partners-grid">
                {grouped[cat].map((p) => (
                  <div key={p.id} className="partner-card card">
                    <div className="partner-card-head">
                      <h3>{p.name}</h3>
                      <span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span>
                    </div>
                    <p className="partner-desc">{p.description}</p>
                    <div className="partner-meta">
                      {p.coverage && <span className="muted small">Coverage: {p.coverage}</span>}
                      {p.licence && <span className="muted small">Licence: {p.licence}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
