import { useState } from 'react';
import type { Flag, Palette } from '../types';
import { MONO, SANS, FLAGS } from '../theme/colors';

interface Props {
  mKey: string;
  mFlag: Flag | null;
  mComments: Array<{ text: string; t: string }>;
  mActions: Array<{ text: string; done: boolean }>;
  P: Palette;
  toggleFlag: (id: string, key: Flag) => void;
  addComment: (id: string, text: string) => void;
  addAction: (id: string, text: string) => void;
  toggleAction: (id: string, idx: number) => void;
}

export function ReviewTools({
  mKey, mFlag, mComments, mActions, P,
  toggleFlag, addComment, addAction, toggleAction,
}: Props) {
  const [cIn, setCIn] = useState('');
  const [actIn, setActIn] = useState('');

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Flags */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
        {FLAGS.map(ft => (
          <button key={ft.key} onClick={() => toggleFlag(mKey, ft.key)} data-ui="true"
            style={{
              padding: '2px 5px', borderRadius: 3, fontSize: 9, fontFamily: SANS,
              background: mFlag === ft.key ? `${P[ft.c as keyof Palette]}12` : 'transparent',
              border: `1px solid ${mFlag === ft.key ? `${P[ft.c as keyof Palette]}40` : P.border}`,
              color: mFlag === ft.key ? P[ft.c as keyof Palette] as string : P.dim,
              cursor: 'pointer',
            }}>
            {ft.icon} {ft.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      {mActions.length > 0 && (
        <div style={{ marginBottom: 3 }}>
          {mActions.map((a, ai) => (
            <div key={ai} onClick={() => toggleAction(mKey, ai)} data-ui="true"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 0', cursor: 'pointer', fontSize: 10,
                fontFamily: SANS, color: a.done ? P.dim : P.text,
              }}>
              <span style={{ fontSize: 10.5, color: a.done ? P.green : P.dim }}>
                {a.done ? '☑' : '☐'}
              </span>
              <span style={{ textDecoration: a.done ? 'line-through' : 'none' }}>
                {a.text}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
        <input value={actIn} onChange={(e) => setActIn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { addAction(mKey, actIn); setActIn(''); } }}
          placeholder="+ action à faire..." data-ui="true"
          style={{
            flex: 1, padding: '3px 5px', borderRadius: 3, fontSize: 10, fontFamily: SANS,
            background: P.bg, border: `1px solid ${P.border}`, color: P.bright, outline: 'none',
          }} />
        <button onClick={() => { addAction(mKey, actIn); setActIn(''); }} data-ui="true"
          style={{
            padding: '3px 6px', borderRadius: 3, fontSize: 8.5,
            background: `${P.orange}15`, border: `1px solid ${P.orange}30`,
            color: P.orange, cursor: 'pointer',
          }}>+</button>
      </div>

      {/* Comments */}
      {mComments.map((c, ci) => (
        <div key={ci} style={{
          fontSize: 10, color: P.text, fontFamily: SANS, padding: '2px 5px',
          background: `${P.cyan}04`, borderRadius: 3, marginBottom: 2,
          borderLeft: `2px solid ${P.cyan}25`,
        }}>
          <span style={{ color: P.dim, fontSize: 8.5, fontFamily: MONO }}>{c.t}</span> {c.text}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 2 }}>
        <input value={cIn} onChange={(e) => setCIn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { addComment(mKey, cIn); setCIn(''); } }}
          placeholder="commentaire..." data-ui="true"
          style={{
            flex: 1, padding: '3px 5px', borderRadius: 3, fontSize: 10, fontFamily: SANS,
            background: P.bg, border: `1px solid ${P.border}`, color: P.bright, outline: 'none',
          }} />
        <button onClick={() => { addComment(mKey, cIn); setCIn(''); }} data-ui="true"
          style={{
            padding: '3px 6px', borderRadius: 3, fontSize: 8.5,
            background: P.cyan, border: 'none', color: '#000',
            cursor: 'pointer', fontWeight: 700,
          }}>↵</button>
      </div>
    </div>
  );
}
