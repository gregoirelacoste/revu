// ── Inline comment text input hook ──

import { useInput } from 'ink';

export interface InputMode {
  lineKey: string;
  draft: string;
}

export function useInputMode(
  isActive: boolean,
  inputMode: InputMode | null,
  setInputMode: (v: InputMode | null) => void,
  addLineComment: (lineKey: string, text: string) => void,
): void {
  useInput((input, key) => {
    if (!isActive || !inputMode) return;

    if (key.escape) {
      setInputMode(null);
      return;
    }

    if (key.return) {
      if (inputMode.draft.trim()) {
        addLineComment(inputMode.lineKey, inputMode.draft.trim());
      }
      setInputMode(null);
      return;
    }

    if (key.backspace || key.delete) {
      setInputMode({ ...inputMode, draft: inputMode.draft.slice(0, -1) });
      return;
    }

    // Printable char
    if (input && !key.ctrl && !key.meta) {
      setInputMode({ ...inputMode, draft: inputMode.draft + input });
    }
  });
}
