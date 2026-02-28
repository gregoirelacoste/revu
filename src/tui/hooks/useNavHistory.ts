// ── Navigation history: back/forward between file positions ──

import { useState, useCallback } from 'react';

export interface NavPos { fileId: string; cursor: number; }

export function useNavHistory() {
  const [back, setBack] = useState<NavPos[]>([]);
  const [fwd, setFwd] = useState<NavPos[]>([]);

  const push = useCallback((pos: NavPos) => {
    setBack(s => [...s, pos]);
    setFwd([]);
  }, []);

  const goBack = useCallback((current: NavPos): NavPos | null => {
    if (back.length === 0) return null;
    const prev = back[back.length - 1]!;
    setBack(s => s.slice(0, -1));
    setFwd(s => [...s, current]);
    return prev;
  }, [back]);

  const goForward = useCallback((current: NavPos): NavPos | null => {
    if (fwd.length === 0) return null;
    const next = fwd[fwd.length - 1]!;
    setFwd(s => s.slice(0, -1));
    setBack(s => [...s, current]);
    return next;
  }, [fwd]);

  return { push, goBack, goForward, canGoBack: back.length > 0, canGoForward: fwd.length > 0 };
}
