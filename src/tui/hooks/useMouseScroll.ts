// ── Mouse scroll support (SGR 1006) ──
// Intercepts stdin to strip mouse sequences before Ink's readline parser sees them,
// then routes scroll events to the correct panel setter.

import { useEffect, useRef } from 'react';

// ── Mouse tracking escape sequences ──

export function enableMouseTracking(): void {
  process.stdout.write('\x1B[?1000h'); // enable basic mouse tracking
  process.stdout.write('\x1B[?1006h'); // enable SGR 1006 extended mode
}

export function disableMouseTracking(): void {
  process.stdout.write('\x1B[?1006l');
  process.stdout.write('\x1B[?1000l');
}

// ── SGR 1006 protocol ──
// Format: \x1B[<btn;col;rowM (press) or \x1B[<btn;col;rowm (release)
// Scroll up = button 64, scroll down = button 65
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)[Mm]/g;

const TREE_STEP = 3;
const DIFF_STEP = 3;
const CTX_STEP = 1;

function detectPanel(col: number, treeW: number, diffW: number): 0 | 1 | 2 {
  if (col <= treeW) return 0;
  if (col <= treeW + 2 + diffW) return 1;
  return 2;
}

// ── Hook interface ──

interface MouseScrollOpts {
  panelWidths: [number, number, number]; // treeW, diffW, ctxW
  disabled: boolean;
  treeMax: number;
  diffRowCount: number;
  diffViewportH: number;
  ctxMax: number;
  setTreeIdx: (fn: (v: number) => number) => void;
  setDiffScroll: (fn: (v: number) => number) => void;
  setCtxIdx: (fn: (v: number) => number) => void;
}

export function useMouseScroll(opts: MouseScrollOpts): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    enableMouseTracking();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalEmit = process.stdin.emit.bind(process.stdin);

    const patchedEmit = (event: string | symbol, ...args: unknown[]): boolean => {
      if (event !== 'data') return originalEmit(event, ...args);

      const chunk = args[0];
      const raw = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : typeof chunk === 'string' ? chunk : String(chunk);

      const o = optsRef.current;
      SGR_MOUSE_RE.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = SGR_MOUSE_RE.exec(raw)) !== null) {
        const btn = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);

        if ((btn === 64 || btn === 65) && !o.disabled) {
          const direction = btn === 64 ? -1 : 1; // 64 = up (negative), 65 = down (positive)
          const [treeW, diffW] = o.panelWidths;
          const panel = detectPanel(col, treeW, diffW);

          if (panel === 0) {
            o.setTreeIdx(i => Math.max(0, Math.min(o.treeMax, i + direction * TREE_STEP)));
          } else if (panel === 1) {
            const maxScroll = Math.max(0, o.diffRowCount - o.diffViewportH);
            o.setDiffScroll(s => Math.max(0, Math.min(maxScroll, s + direction * DIFF_STEP)));
          } else {
            o.setCtxIdx(i => Math.max(0, Math.min(o.ctxMax, i + direction * CTX_STEP)));
          }
        }
      }

      // Strip all SGR mouse sequences from the buffer before forwarding to Ink
      SGR_MOUSE_RE.lastIndex = 0;
      const cleaned = raw.replace(SGR_MOUSE_RE, '');
      if (cleaned.length === 0) return false;

      const out = Buffer.isBuffer(chunk) ? Buffer.from(cleaned, 'utf8') : cleaned;
      return originalEmit('data', out);
    };

    (process.stdin as NodeJS.EventEmitter).emit = patchedEmit as typeof process.stdin.emit;

    return () => {
      (process.stdin as NodeJS.EventEmitter).emit = originalEmit as typeof process.stdin.emit;
      disableMouseTracking();
    };
  }, []);
}
