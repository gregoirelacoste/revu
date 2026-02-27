import { useState, useCallback, useEffect, useRef } from 'react';
import type { FocusTarget } from '../types';

const MAX_HISTORY = 20;

export function useFocusHistory() {
  const [stack, setStack] = useState<(FocusTarget | null)[]>([null]);
  const [cursor, setCursor] = useState(0);
  const navigatingRef = useRef(false);

  const focus = stack[cursor] ?? null;

  const setFocus = useCallback((target: FocusTarget | null) => {
    if (navigatingRef.current) {
      navigatingRef.current = false;
      return;
    }
    setStack(prev => {
      const truncated = prev.slice(0, cursor + 1);
      const next = [...truncated, target];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setCursor(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [cursor]);

  const canGoBack = cursor > 0;
  const canGoForward = cursor < stack.length - 1;

  const back = useCallback(() => {
    if (!canGoBack) return;
    navigatingRef.current = true;
    setCursor(c => c - 1);
  }, [canGoBack]);

  const forward = useCallback(() => {
    if (!canGoForward) return;
    navigatingRef.current = true;
    setCursor(c => c + 1);
  }, [canGoForward]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') { setFocus(null); return; }
      if (!e.altKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [back, forward, setFocus]);

  return { focus, setFocus, back, forward, canGoBack, canGoForward };
}
