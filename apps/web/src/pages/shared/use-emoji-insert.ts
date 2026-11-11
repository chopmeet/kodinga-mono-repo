import { useRef } from 'react';

import { insertAtCursor } from '@/utils/Utils';

/**
 * An emoji put at the caret of a text field (its ref), then the caret right after it, the field
 * keeping the focus. `value` / `setValue`: the state of the field.
 */
export function useEmojiInsert<T extends HTMLTextAreaElement | HTMLInputElement = HTMLTextAreaElement>(value: string, setValue: (next: string) => void) {
  const ref = useRef<T>(null);
  const insert = (emoji: string) => {
    const el = ref.current;
    const next = insertAtCursor(el, value, emoji);
    setValue(next.value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };
  return { ref, insert };
}
