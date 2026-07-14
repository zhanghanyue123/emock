"use client";

import type { VocabularyFilterState, VocabularyFilter, VocabularySort } from "@/lib/vocabulary/vocabulary-filters";
import { SECTION_KEYS } from "@/lib/constants";

export function VocabularyFilters({ state, tags, testIds, onChange }: {
  state: VocabularyFilterState;
  tags: string[];
  testIds: string[];
  onChange: (state: VocabularyFilterState) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-3 lg:grid-cols-6">
      <input className="h-10 rounded-md border border-line px-3 dark:bg-slate-950 md:col-span-2" placeholder="Search vocabulary" value={state.query} onChange={(event) => onChange({ ...state, query: event.target.value })} />
      <select className="h-10 rounded-md border border-line px-3 dark:bg-slate-950" value={state.filter} onChange={(event) => onChange({ ...state, filter: event.target.value as VocabularyFilter })}>
        <option value="all">All</option><option value="new">New</option><option value="learning">Learning</option><option value="mastered">Mastered</option><option value="starred">Starred</option><option value="incorrect">From incorrect answers</option><option value="archived">Archived</option>
      </select>
      <select className="h-10 rounded-md border border-line px-3 dark:bg-slate-950" value={state.section} onChange={(event) => onChange({ ...state, section: event.target.value as VocabularyFilterState["section"] })}>
        <option value="all">All sections</option>{SECTION_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
      </select>
      <select className="h-10 rounded-md border border-line px-3 dark:bg-slate-950" value={state.testId} onChange={(event) => onChange({ ...state, testId: event.target.value })}>
        <option value="">All tests</option>{testIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
      <select className="h-10 rounded-md border border-line px-3 dark:bg-slate-950" value={state.tag} onChange={(event) => onChange({ ...state, tag: event.target.value })}>
        <option value="">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
      </select>
      <select className="h-10 rounded-md border border-line px-3 dark:bg-slate-950" value={state.sort} onChange={(event) => onChange({ ...state, sort: event.target.value as VocabularySort })}>
        <option value="recent">Recent</option><option value="oldest">Oldest</option><option value="alphabetical">Alphabetical</option><option value="mistakes">Mistake count</option><option value="reviewed">Recently reviewed</option>
      </select>
    </div>
  );
}
