export function publicAssetPath(testId: string, file?: string | null) {
  if (!file) return null;
  const normalized = file
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
  if (normalized.includes("..")) return null;
  return `/content/${testId}/${normalized}`;
}
