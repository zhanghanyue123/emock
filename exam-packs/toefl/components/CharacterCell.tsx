"use client";

import type { ClipboardEventHandler, KeyboardEventHandler } from "react";

export function CharacterCell({ value, index, total, blankId, inputRef, onChange, onKeyDown, onPaste, onFocus }: {
  value: string;
  index: number;
  total: number;
  blankId: string;
  inputRef: (node: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onPaste: ClipboardEventHandler<HTMLInputElement>;
  onFocus?: () => void;
}) {
  return (
    <input
      ref={inputRef}
      aria-label={`Blank ${blankId}, letter ${index + 1} of ${total}`}
      autoCapitalize="none"
      autoCorrect="off"
      className="h-8 w-7 rounded border border-slate-400 bg-white text-center text-base leading-none text-ink outline-none transition focus:border-action focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900 sm:h-9 sm:w-8"
      inputMode="text"
      maxLength={1}
      spellCheck={false}
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
}
