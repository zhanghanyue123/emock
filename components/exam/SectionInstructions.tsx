export function SectionInstructions({ instructions }: { instructions?: string }) {
  if (!instructions) return null;
  return <div className="border-b border-line bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">{instructions}</div>;
}
