import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { helpForPath } from './commands';
import './Help.css';

// Floating contextual help. Suggestions change with the current route; a search
// row opens the command palette, and a support row mails support.
export default function HelpWidget({ onOpenPalette }: { onOpenPalette: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const help = helpForPath(location.pathname);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        fabRef.current && !fabRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Close when navigating.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      {open && (
        <div className="help-panel open" ref={panelRef}>
          <div className="help-head">
            <h4>{help.title}</h4>
            <p>{help.sub}</p>
          </div>
          <div
            className="help-search"
            onClick={() => { setOpen(false); onOpenPalette(); }}
          >
            <span>⌕ Search all commands</span>
            <span className="kbd">⌘K</span>
          </div>
          <div className="help-body">
            <div className="help-sec">Suggested for this page</div>
            {help.items.map((it) => (
              <div key={it.label} className="help-item" onClick={() => { setOpen(false); navigate(it.href); }}>
                <span className="ic">→</span>{it.label}
              </div>
            ))}
          </div>
          <div className="help-foot">
            <a className="help-item" href="mailto:support@mobicova.com">
              <span className="ic">✉</span>Message support
            </a>
          </div>
        </div>
      )}
      <button
        ref={fabRef}
        className="help-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Help"
        title="Help"
      >
        ?
      </button>
    </>
  );
}
