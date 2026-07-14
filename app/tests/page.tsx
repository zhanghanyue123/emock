import { LocalContentRepository } from "@/lib/repositories/content-repository";
import { TestsClient } from "./TestsClient";

export default async function TestsPage() {
  const tests = await new LocalContentRepository().getAllTests();
  return <TestsClient tests={tests} />;
}
