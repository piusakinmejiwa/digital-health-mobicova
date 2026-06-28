import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listMembers, deleteMember } from '../../api/resources';
import type { MemberListItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import MemberImportModal from './MemberImportModal';
import MembersTable from './MembersTable';
import './Members.css';

export default function MembersListPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const [importing, setImporting] = useState(false);
  const { data: members, isLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const remove = async (m: MemberListItem) => {
    if (!confirm(`Remove ${m.full_name} from this organisation? This cannot be undone.`)) return;
    try {
      await deleteMember(m.id);
      queryClient.invalidateQueries({ queryKey: ['members'] });
    } catch {
      alert('Could not remove the member. Please try again.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Members</h1>
          <p>The individuals your organisation has enrolled on the platform.</p>
        </div>
        {canWrite && (
          <div className="page-header-actions">
            <button className="btn btn-secondary" onClick={() => setImporting(true)}>Import CSV</button>
            <Link to="/members/new" className="btn btn-primary">+ Add member</Link>
          </div>
        )}
      </div>

      <div className="card card-pad">
        {isLoading ? (
          <p className="empty-state">Loading members…</p>
        ) : !members || members.length === 0 ? (
          <div className="empty-state">
            <p>No members yet.</p>
            {canWrite && <Link to="/members/new" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Add your first member</Link>}
          </div>
        ) : (
          <MembersTable members={members} canWrite={canWrite} onRemove={remove} />
        )}
      </div>

      {importing && (
        <MemberImportModal
          onClose={() => setImporting(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ['members'] })}
        />
      )}
    </div>
  );
}
