"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cleanVocabularyDisplayText } from "@/lib/vocabulary/normalize-word";
import type { CreateVocabularyInput, VocabularyItem, VocabularySource, VocabularyStatus } from "@/types/practice";

export function VocabularyEditorModal({ open, item, initialWord, source, sourceCandidates, duplicateMessage, onClose, onSave, onAddSource }: {
  open: boolean;
  item?: VocabularyItem | null;
  initialWord?: string;
  source?: VocabularySource;
  sourceCandidates?: { label: string; text: string }[];
  duplicateMessage?: string | null;
  onClose: () => void;
  onSave: (input: CreateVocabularyInput, id?: string) => Promise<void>;
  onAddSource?: () => Promise<void>;
}) {
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [definition, setDefinition] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<VocabularyStatus>("new");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWord(item?.word || initialWord || "");
    setTranslation(item?.translation || "");
    setDefinition(item?.definition || "");
    setPartOfSpeech(item?.partOfSpeech || "");
    setExampleSentence(item?.exampleSentence || "");
    setPersonalNote(item?.personalNote || "");
    setTags(item?.tags.join(", ") || "");
    setStatus(item?.status || "new");
    setError(null);
  }, [initialWord, item, open]);

  if (!open) return null;

  async function save() {
    const cleaned = cleanVocabularyDisplayText(word);
    if (!cleaned) {
      setError("Word or phrase is required.");
      return;
    }
    if (cleaned.length > 100) {
      setError("Please shorten the selected text to 100 characters or fewer.");
      return;
    }
    setError(null);
    await onSave({
      word: cleaned,
      translation,
      definition,
      partOfSpeech,
      exampleSentence,
      personalNote,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      status,
      source
    }, item?.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{item ? "Edit vocabulary" : "Add vocabulary"}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <p className="mt-2 text-sm text-muted">PDF viewer text cannot yet be captured automatically. Copy the word and use Add vocabulary.</p>
        {sourceCandidates?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceCandidates.map((candidate) => (
              <Button key={candidate.label} onClick={() => setWord(cleanVocabularyDisplayText(candidate.text).slice(0, 100))}>{candidate.label}</Button>
            ))}
          </div>
        ) : null}
        {duplicateMessage ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <p>{duplicateMessage}</p>
            {onAddSource ? <div className="mt-2"><Button onClick={onAddSource}>Add this source</Button></div> : null}
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Word or phrase<input className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={word} onChange={(event) => setWord(event.target.value)} /></label>
          <label className="text-sm">中文释义<input className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={translation} onChange={(event) => setTranslation(event.target.value)} /></label>
          <label className="text-sm">English definition<input className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={definition} onChange={(event) => setDefinition(event.target.value)} /></label>
          <label className="text-sm">Part of speech<input className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={partOfSpeech} onChange={(event) => setPartOfSpeech(event.target.value)} /></label>
          <label className="text-sm md:col-span-2">Example sentence<textarea className="mt-1 min-h-20 w-full rounded-md border border-line p-3 dark:bg-slate-950" value={exampleSentence} onChange={(event) => setExampleSentence(event.target.value)} /></label>
          <label className="text-sm md:col-span-2">Personal note<textarea className="mt-1 min-h-20 w-full rounded-md border border-line p-3 dark:bg-slate-950" value={personalNote} onChange={(event) => setPersonalNote(event.target.value)} /></label>
          <label className="text-sm">Tags<input className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="academic, listening" /></label>
          <label className="text-sm">Status<select className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={status} onChange={(event) => setStatus(event.target.value as VocabularyStatus)}><option value="new">New</option><option value="learning">Learning</option><option value="mastered">Mastered</option><option value="archived">Archived</option></select></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void save()}>Save</Button></div>
      </div>
    </div>
  );
}
