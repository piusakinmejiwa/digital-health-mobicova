import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { COMMANDS } from './commands';
import CommandPalette from './CommandPalette';
import HelpWidget from './HelpWidget';

// Owns the palette open-state and the global ⌘K / Ctrl+K shortcut, filters the
// command list by the signed-in user's role, and renders both global helpers.
// Mounted once in AppShell.
export default function HelpLayer() {
  const { user } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commands = useMemo(
    () => COMMANDS.filter((c) => {
      if (c.platformAdminOnly && !user?.isPlatformAdmin) return false;
      if (c.adminOnly && user?.role !== 'admin') return false;
      return true;
    }),
    [user]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <HelpWidget onOpenPalette={() => setPaletteOpen(true)} />
    </>
  );
}
