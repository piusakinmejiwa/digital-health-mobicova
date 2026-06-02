import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listMembers } from '../../api/resources';
import { age, formatDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import './Members.css';

const channelBadge: Record<string, string> = {
  app: 'badge-teal', whatsapp: 'badge-green', ussd: 'badge-amber', web: 'badge-blue',
};

export default function MembersListPage() {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const { data: members, isLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Members</h1>
          <p>The individuals your organisation has enrolled on the platform.</p>
        </div>
        {canWrite && <Link to="/members/new" className="btn btn-primary">+ Add member</Link>}
      </div>

      <div className="card">
        {isLoading ? (
          <p className="empty-state">Loading members…</p>
        ) : !members || members.length === 0 ? (
          <div className="empty-state">
            <p>No members yet.</p>
            {canWrite && <Link to="/members/new" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Add your first member</Link>}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th><th>Age</th><th>Channel</th><th>Conditions</th>
                <th>Consults</th><th>Plans</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="row-link" onClick={() => navigate(`/members/${m.id}`)}>
                  <td><strong>{m.full_name}</strong><div className="muted small">{m.email || m.phone}</div></td>
                  <td>{age(m.date_of_birth)}</td>
                  <td><span className={`badge ${channelBadge[m.channel] || 'badge-gray'}`}>{m.channel}</span></td>
                  <td>
                    {m.chronic_conditions.length === 0
                      ? <span className="muted small">—</span>
                      : <span className="tag">{m.chronic_conditions[0]}{m.chronic_conditions.length > 1 ? ` +${m.chronic_conditions.length - 1}` : ''}</span>}
                  </td>
                  <td>{m.consultation_count ?? 0}</td>
                  <td>{m.enrolment_count ?? 0}</td>
                  <td className="muted small">{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
