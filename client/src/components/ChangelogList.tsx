import { CHANGELOG, type ChangeTag } from '../lib/changelog';
import './ChangelogList.css';

const TAG_CLASS: Record<ChangeTag, string> = {
  New: 'cl-tag-new', Improved: 'cl-tag-improved', Fixed: 'cl-tag-fixed',
};

function fmt(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// Shared changelog renderer used by both the public /changelog page and the
// in-app "What's new" page.
export default function ChangelogList() {
  return (
    <div className="cl-list">
      {CHANGELOG.map((e, i) => (
        <div key={`${e.date}-${i}`} className="cl-entry">
          <div className="cl-entry-meta">
            <span className={`cl-tag ${TAG_CLASS[e.tag]}`}>{e.tag}</span>
            <time className="cl-date">{fmt(e.date)}</time>
          </div>
          <div className="cl-entry-body">
            <h3>{e.title}</h3>
            <ul>
              {e.items.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
