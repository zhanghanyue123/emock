"use client";

import { useEffect, useState } from "react";
import { LocalStorageVocabularyRepository } from "@/lib/repositories/vocabulary-repository";
import { cleanVocabularyDisplayText, normalizeVocabularyWord } from "@/lib/vocabulary/normalize-word";
import { VocabularyEditorModal } from "./VocabularyEditorModal";
import type { CreateVocabularyInput, VocabularySource } from "@/types/practice";

const repository = new LocalStorageVocabularyRepository();

export function TextSelectionVocabularyAction({ source }: { source: VocabularySource }) {
  const [selection, setSelection] = useState("");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    function handleSelection() {
      const selected = cleanVocabularyDisplayText(window.getSelection()?.toString() || "");
      if (!selected) {
        setPosition(null);
        return;
      }
      if (selected.length > 100) {
        setMessage("Please shorten the selected text to 100 characters or fewer.");
        setPosition({ x: window.innerWidth / 2, y: 96 });
        setSelection("");
        return;
      }
      setMessage(null);
      setSelection(selected);
      const range = window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect();
      setPosition(rect ? { x: rect.left + rect.width / 2, y: Math.max(16, rect.top - 44) } : { x: window.innerWidth / 2, y: 96 });
    }
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, []);

  async function save(input: CreateVocabularyInput) {
    const normalized = normalizeVocabularyWord(input.word);
    const existing = await repository.findByNormalizedWord(normalized);
    if (existing) {
      setDuplicateId(existing.id);
      return;
    }
    await repository.add({ ...input, source: { ...source, sourceText: selection } });
    setOpen(false);
    setPosition(null);
    setDuplicateId(null);
  }

  async function addSource() {
    if (!duplicateId) return;
    await repository.addSource(duplicateId, { ...source, sourceText: selection });
    setOpen(false);
    setPosition(null);
    setDuplicateId(null);
  }

  return (
    <>
      {position ? (
        <button
          type="button"
          className="fixed z-40 rounded-md border border-action bg-action px-3 py-2 text-xs font-medium text-white shadow"
          style={{ left: position.x, top: position.y, transform: "translateX(-50%)" }}
          onClick={() => selection && setOpen(true)}
        >
          {message || "Add to vocabulary"}
        </button>
      ) : null}
      <VocabularyEditorModal
        open={open}
        initialWord={selection}
        source={{ ...source, sourceText: selection }}
        duplicateMessage={duplicateId ? "This word is already in your vocabulary." : null}
        onAddSource={duplicateId ? addSource : undefined}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </>
  );
}
