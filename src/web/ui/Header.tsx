import { useState, useCallback } from 'react';
import type { Palette, FocusTarget } from '../types';
import { MONO } from '../theme/colors';

interface HeaderProps {
  P: Palette;
  dark: boolean;
  setDark: (v: boolean) => void;
  focus: FocusTarget | null;
  zoomOut: () => void;
  reviewed: number;
  total: number;
  baseBranch: string;
  setBaseBranch: (v: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

export function Header({ P, dark, setDark, focus, zoomOut, reviewed, total, baseBranch, setBaseBranch, canGoBack, canGoForward, onBack, onForward }: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(baseBranch);

  const startEdit = useCallback(() => {
    setDraft(baseBranch);
    setEditing(true);
  }, [baseBranch]);

  const confirm = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== baseBranch) setBaseBranch(trimmed);
    setEditing(false);
  }, [draft, baseBranch, setBaseBranch]);

  const cancel = useCallback(() => setEditing(false), []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '5px 14px',
      borderBottom: `1px solid ${P.border}`, background: P.surface,
      zIndex: 30, gap: 8,
    }}>
      <span style={{ fontWeight: 900, fontSize: 12, letterSpacing: 2, fontFamily: MONO, color: P.cyan }}>
        ◈ REVU
      </span>

      <span style={{ fontSize: 9, color: P.dim, fontFamily: MONO }}>base:</span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={cancel}
          style={{
            width: 100, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontFamily: MONO,
            background: P.bg, border: `1px solid ${P.cyan}40`, color: P.bright, outline: 'none',
          }}
        />
      ) : (
        <button onClick={startEdit} style={{
          padding: '1px 6px', borderRadius: 3, fontSize: 9, fontFamily: MONO,
          background: `${P.cyan}08`, border: `1px solid ${P.cyan}20`,
          color: P.cyan, cursor: 'pointer',
        }}>{baseBranch}</button>
      )}

      <div style={{ flex: 1 }} />
      {canGoBack && (
        <button onClick={onBack} title="Alt+←" style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO,
          background: 'transparent', border: `1px solid ${P.border}`,
          color: P.dim, cursor: 'pointer',
        }}>◀</button>
      )}
      {canGoForward && (
        <button onClick={onForward} title="Alt+→" style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO,
          background: 'transparent', border: `1px solid ${P.border}`,
          color: P.dim, cursor: 'pointer',
        }}>▶</button>
      )}
      {focus && (
        <button onClick={zoomOut} style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO,
          background: `${P.cyan}10`, border: `1px solid ${P.cyan}25`,
          color: P.cyan, cursor: 'pointer',
        }}>← univers</button>
      )}
      <span style={{ fontSize: 10, fontFamily: MONO, color: P.dim }}>
        {reviewed}/{total}
      </span>
      <button onClick={() => setDark(!dark)} style={{
        padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO,
        background: 'transparent', border: `1px solid ${P.border}`,
        color: P.dim, cursor: 'pointer',
      }}>{dark ? '☀' : '●'}</button>
    </div>
  );
}
