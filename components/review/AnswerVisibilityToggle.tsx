"use client";

import { Button } from "@/components/ui/Button";

export function AnswerVisibilityToggle({ show, onChange }: { show: boolean; onChange: (show: boolean) => void }) {
  return (
    <Button variant={show ? "primary" : "secondary"} onClick={() => onChange(!show)}>
      {show ? "Hide correct answers" : "Show correct answers"}
    </Button>
  );
}
