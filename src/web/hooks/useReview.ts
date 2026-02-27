import { useState, useCallback, useMemo } from 'react';
import type { Flag } from '../types';

interface ReviewState {
  flags: Record<string, Flag | null>;
  comments: Record<string, Array<{ text: string; t: string }>>;
  actions: Record<string, Array<{ text: string; done: boolean }>>;
}

export function useReview() {
  const [state, setState] = useState<ReviewState>({
    flags: {}, comments: {}, actions: {},
  });

  const toggleFlag = useCallback((id: string, key: Flag) => {
    setState(s => ({
      ...s,
      flags: { ...s.flags, [id]: s.flags[id] === key ? null : key },
    }));
  }, []);

  const addComment = useCallback((id: string, text: string) => {
    if (!text.trim()) return;
    const t = new Date().toLocaleTimeString().slice(0, 5);
    setState(s => ({
      ...s,
      comments: { ...s.comments, [id]: [...(s.comments[id] ?? []), { text, t }] },
    }));
  }, []);

  const addAction = useCallback((id: string, text: string) => {
    if (!text.trim()) return;
    setState(s => ({
      ...s,
      actions: { ...s.actions, [id]: [...(s.actions[id] ?? []), { text, done: false }] },
    }));
  }, []);

  const toggleAction = useCallback((id: string, idx: number) => {
    setState(s => ({
      ...s,
      actions: {
        ...s.actions,
        [id]: (s.actions[id] ?? []).map((a, i) => i === idx ? { ...a, done: !a.done } : a),
      },
    }));
  }, []);

  const archivedIds = useMemo(() => {
    const set = new Set<string>();
    for (const [id, flag] of Object.entries(state.flags)) {
      if (flag != null) set.add(id);
    }
    return set;
  }, [state.flags]);

  return { ...state, archivedIds, toggleFlag, addComment, addAction, toggleAction };
}
