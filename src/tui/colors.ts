// ── TUI color palette ──

export const C = {
  bg: '#1e1e1e',
  border: '#3c3c3c',
  dim: '#555555',
  text: '#aaaaaa',
  bright: '#cccccc',
  white: '#eeeeee',
  green: '#4ec9b0',
  red: '#f14c4c',
  orange: '#cca700',
  blue: '#569cd6',
  purple: '#c586c0',
  cyan: '#9cdcfe',
  accent: '#007acc',
} as const;

export const critColor = (v: number): string =>
  v >= 7 ? C.red : v >= 4.5 ? C.orange : v >= 2.5 ? C.blue : C.green;

export const critBg = (v: number, t: 'add' | 'del'): string => {
  const intensity = Math.min(1, v / 10);
  if (t === 'add') {
    const g = Math.round(30 + intensity * 25);
    return `#0a${g.toString(16).padStart(2, '0')}0a`;
  }
  const r = Math.round(30 + intensity * 25);
  return `#${r.toString(16).padStart(2, '0')}0a0a`;
};

export const FLAG_ICON: Record<string, string> = {
  ok: '\u2713',
  bug: '\u2717',
  question: '?',
};

export const FLAG_COLOR: Record<string, string> = {
  ok: C.green,
  bug: C.red,
  question: C.orange,
};

export const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  controller: { icon: 'C', color: C.green },
  service: { icon: 'S', color: C.blue },
  module: { icon: 'M', color: C.purple },
  component: { icon: 'Co', color: C.red },
  dto: { icon: 'D', color: C.cyan },
  model: { icon: 'Mo', color: C.cyan },
  guard: { icon: 'G', color: C.orange },
  interceptor: { icon: 'I', color: C.orange },
  pipe: { icon: 'P', color: C.purple },
  spec: { icon: 'T', color: C.green },
  html: { icon: 'H', color: C.orange },
  scss: { icon: 'Sc', color: C.purple },
  css: { icon: 'Cs', color: C.purple },
  folder: { icon: '\u25B8', color: C.orange },
  repo: { icon: '\u25C8', color: C.cyan },
  unknown: { icon: '?', color: C.dim },
};
