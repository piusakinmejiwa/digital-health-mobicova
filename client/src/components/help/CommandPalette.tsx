import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Command } from './commands';
import './Help.css';

const GROUP_CLASS: Record<string, string> = { Navigate: 'nav', Actions: 'act' };
const GROUP_META: Record<string, string> = { Navigate: 'go', Actions: 'run' };

export default function CommandPalette({
  open, onClose, commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return commands;
    return commands.filter((c) =>
      c.label.toLowerCase().includes(query) ||
      c.group.toLowerCase().includes(query) ||
      (c.keywords || '').toLowerCase().includes(query)
    );
  }, [q, commands]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    navigate(c.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[sel]); }
  };

  let lastGroup = '';

  return (
    <div className="cmdk-back open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true">
        <div className="cmdk-input">
          <span className="mag">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            aria-label="Command palette search"
          />
          <span className="esc">esc</span>
        </div>
        <div className="cmdk-results">
          {filtered.length === 0 ? (
            <div className="cmdk-empty">No results for “{q}”</div>
          ) : (
            filtered.map((c, i) => {
              const showGroup = c.group !== lastGroup;
              lastGroup = c.group;
              return (
                <div key={c.label}>
                  {showGroup && <div className="cmdk-group">{c.group}</div>}
                  <div
                    className={`cmdk-item ${GROUP_CLASS[c.group]} ${i === sel ? 'sel' : ''}`}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => run(c)}
                  >
                    <span className="ic">{c.icon}</span>
                    {c.label}
                    <span className="meta">{GROUP_META[c.group]}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> select</span>
          <span><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
