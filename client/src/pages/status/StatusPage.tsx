import { useQuery } from '@tanstack/react-query';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { getPlatformStatus } from '../../api/status';
import './Status.css';

const SERVICE_LABELS: { key: string; label: string }[] = [
  { key: 'telemedicine', label: 'Telemedicine video' },
  { key: 'sms', label: 'SMS & USSD' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email delivery' },
  { key: 'payments', label: 'Payments' },
  { key: 'ai', label: 'AI Health Buddy' },
];

export default function StatusPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-status'],
    queryFn: getPlatformStatus,
    refetchInterval: 60000,
    retry: 1,
  });

  // If the request itself fails, the platform is unreachable from here.
  const operational = !isError && data?.status === 'operational';
  const overall = isLoading ? 'checking' : operational ? 'operational' : 'degraded';

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="status">
          <header className={`status-hero ${overall}`}>
            <span className="status-dot" />
            <h1>
              {overall === 'checking' && 'Checking platform status…'}
              {overall === 'operational' && 'All systems operational'}
              {overall === 'degraded' && 'We’re investigating an issue'}
            </h1>
            <p>Live availability of MobiCova Health. This page refreshes automatically.</p>
          </header>

          <section>
            <h2>Core platform</h2>
            <div className="status-rows">
              <StatusRow label="Web application" up={!isError} />
              <StatusRow label="API" up={!isError && !!data?.components.api} />
              <StatusRow label="Database" up={!isError && !!data?.components.database} />
            </div>
          </section>

          {data && (
            <section>
              <h2>Enabled services</h2>
              <p className="status-note">Which capabilities are switched on for the platform. “Off” means not enabled — not an outage.</p>
              <div className="status-rows">
                {SERVICE_LABELS.map((s) => (
                  <div key={s.key} className="status-row">
                    <span>{s.label}</span>
                    <span className={`status-pill ${(data.services as Record<string, boolean>)[s.key] ? 'on' : 'off'}`}>
                      {(data.services as Record<string, boolean>)[s.key] ? 'Enabled' : 'Off'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2>Incident history</h2>
            <p className="status-note">No incidents reported. We post any service disruptions here.</p>
          </section>

          <p className="status-foot">
            Last checked {data ? new Date(data.time).toLocaleString('en-GB') : '—'}. See our{' '}
            <a href="/trust">Trust &amp; Security Centre</a> for how we protect your data.
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function StatusRow({ label, up }: { label: string; up: boolean }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <span className={`status-pill ${up ? 'op' : 'down'}`}>{up ? 'Operational' : 'Degraded'}</span>
    </div>
  );
}
