"use client";

import { useMemo, useRef } from "react";
import { CharacterCell } from "./CharacterCell";

export interface ToeflWordBlankInputData {
  id: string;
  prefix: string;
  suffix?: string;
  missingLength?: number;
}

function lettersOnly(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").toLowerCase();
}

export function WordBlankInput({ blank, value, onChange, onComplete }: {
  blank: ToeflWordBlankInputData;
  value?: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
}) {
  const length = Math.max(1, blank.missingLength || value?.length || 1);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = useMemo(() => {
    const normalized = lettersOnly(value || "").slice(0, length);
    return Array.from({ length }, (_, index) => normalized[index] || "");
  }, [length, value]);

  function focusCell(index: number) {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  }

  function commit(nextChars: string[]) {
    onChange(nextChars.join(""));
  }

  function setChar(index: number, raw: string) {
    const nextLetter = lettersOnly(raw).slice(-1);
    const next = [...chars];
    next[index] = nextLetter;
    commit(next);
    if (nextLetter) {
      if (index < length - 1) window.requestAnimationFrame(() => focusCell(index + 1));
      else window.requestAnimationFrame(() => onComplete?.());
    }
  }

  function pasteAt(index: number, raw: string) {
    const pasted = lettersOnly(raw).slice(0, length - index);
    if (!pasted) return;
    const next = [...chars];
    for (let offset = 0; offset < pasted.length; offset += 1) next[index + offset] = pasted[offset];
    commit(next);
    const target = index + pasted.length;
    window.requestAnimationFrame(() => {
      if (target < length) focusCell(target);
      else onComplete?.();
    });
  }

  function focusFirstUsefulCell() {
    const emptyIndex = chars.findIndex((char) => !char);
    focusCell(emptyIndex >= 0 ? emptyIndex : length - 1);
  }

  return (
    <span
      aria-label={`Complete the missing letters after ${blank.prefix}`}
      className="mx-1 inline-flex items-baseline gap-1 align-baseline"
      role="group"
      onClick={(event) => {
        if (event.target === event.currentTarget) focusFirstUsefulCell();
      }}
    >
      <span>{blank.prefix}</span>
      <span className="inline-flex flex-nowrap gap-1 whitespace-nowrap align-middle">
        {chars.map((char, index) => (
          <CharacterCell
            key={`${blank.id}-${index}`}
            blankId={blank.id}
            index={index}
            inputRef={(node) => {
              refs.current[index] = node;
            }}
            total={length}
            value={char}
            onChange={(next) => setChar(index, next)}
            onFocus={() => undefined}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                const next = [...chars];
                if (next[index]) {
                  next[index] = "";
                  commit(next);
                } else if (index > 0) {
                  next[index - 1] = "";
                  commit(next);
                  window.requestAnimationFrame(() => focusCell(index - 1));
                }
                return;
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusCell(index - 1);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                focusCell(index + 1);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              pasteAt(index, event.clipboardData.getData("text"));
            }}
          />
        ))}
      </span>
      {blank.suffix ? <span>{blank.suffix}</span> : null}
    </span>
  );
}
