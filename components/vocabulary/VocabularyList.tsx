"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { VocabularyCard } from "./VocabularyCard";
import type { VocabularyItem } from "@/types/practice";

export function VocabularyList({ items, onUpdate, onRemove }: {
  items: VocabularyItem[];
  onUpdate: (id: string, patch: Partial<VocabularyItem>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  if (!items.length) return <EmptyState title="No vocabulary found" body="Add words manually or from review and mistake cards." />;
  return <div className="grid gap-3">{items.map((item) => <VocabularyCard key={item.id} item={item} onUpdate={onUpdate} onRemove={onRemove} />)}</div>;
}
