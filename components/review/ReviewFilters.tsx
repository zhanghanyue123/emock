"use client";

import { Button } from "@/components/ui/Button";

export type ReviewFilter = "all" | "incorrect" | "unanswered" | "flagged" | "ungraded";

const filters: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "incorrect", label: "Incorrect" },
  { key: "unanswered", label: "Unanswered" },
  { key: "flagged", label: "Flagged" },
  { key: "ungraded", label: "Ungraded" }
];

export function ReviewFilters({ value, onChange }: { value: ReviewFilter; onChange: (filter: ReviewFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button key={filter.key} variant={value === filter.key ? "primary" : "secondary"} onClick={() => onChange(filter.key)}>
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
