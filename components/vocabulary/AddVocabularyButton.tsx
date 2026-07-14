"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LocalStorageVocabularyRepository } from "@/lib/repositories/vocabulary-repository";
import { normalizeVocabularyWord } from "@/lib/vocabulary/normalize-word";
import { VocabularyEditorModal } from "./VocabularyEditorModal";
import type { CreateVocabularyInput, VocabularySource } from "@/types/practice";

const repository = new LocalStorageVocabularyRepository();

export function AddVocabularyButton({ source, sourceCandidates, prominent = false, label = "Add vocabulary", onSaved }: {
  source?: VocabularySource;
  sourceCandidates?: { label: string; text: string }[];
  prominent?: boolean;
  label?: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  async function save(input: CreateVocabularyInput) {
    const existing = await repository.findByNormalizedWord(normalizeVocabularyWord(input.word));
    if (existing) {
      setDuplicateId(existing.id);
      return;
    }
    await repository.add({ ...input, source: input.source ? { ...input.source, sourceText: input.word } : input.source });
    setOpen(false);
    setDuplicateId(null);
    onSaved?.();
  }

  async function addSource() {
    if (!duplicateId || !source) return;
    await repository.addSource(duplicateId, source);
    setOpen(false);
    setDuplicateId(null);
    onSaved?.();
  }

  return (
    <>
      <Button variant={prominent ? "primary" : "secondary"} onClick={() => setOpen(true)}>{label}</Button>
      <VocabularyEditorModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={save}
        source={source}
        sourceCandidates={sourceCandidates}
        duplicateMessage={duplicateId ? "This word is already in your vocabulary." : null}
        onAddSource={duplicateId ? addSource : undefined}
      />
    </>
  );
}
