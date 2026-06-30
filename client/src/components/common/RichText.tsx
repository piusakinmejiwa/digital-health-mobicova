import React from 'react';

// Minimal inline renderer for assistant replies: turns markdown links
// [label](/path) into clickable links, **bold** into <strong>, and newlines into
// breaks. Internal links (starting with "/") navigate within the SPA via
// onNavigate; external links open in a new tab. Keeps chat bubbles inline (no
// block margins) unlike a full markdown renderer.
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

function renderLine(text: string, onNavigate?: (path: string) => void): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      const url = m[2];
      const internal = url.startsWith('/');
      out.push(
        <a
          key={key++}
          href={url}
          target={internal ? undefined : '_blank'}
          rel={internal ? undefined : 'noopener noreferrer'}
          onClick={internal && onNavigate ? (e) => { e.preventDefault(); onNavigate(url); } : undefined}
          style={{ color: '#0A7B7B', fontWeight: 600, textDecoration: 'underline' }}
        >
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined) {
      out.push(<strong key={key++}>{m[3]}</strong>);
    }
    last = TOKEN.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text, onNavigate }: { text: string; onNavigate?: (path: string) => void }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {renderLine(line, onNavigate)}
        </React.Fragment>
      ))}
    </>
  );
}
