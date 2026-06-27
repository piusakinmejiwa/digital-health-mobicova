import { useEffect } from 'react';
import ChangelogList from '../../components/ChangelogList';
import { markChangelogSeen } from '../../lib/changelog';

// In-app "What's new" — same content as the public changelog, framed inside the
// app shell. Opening it clears the unseen badge in the sidebar.
export default function WhatsNewPage() {
  useEffect(() => { markChangelogSeen(); }, []);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>What’s new</h1>
          <p>The latest updates and improvements to MobiCova.</p>
        </div>
      </div>
      <div className="card card-pad">
        <ChangelogList />
      </div>
    </div>
  );
}
