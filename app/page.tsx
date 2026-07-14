import { LocalContentRepository } from "@/lib/repositories/content-repository";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const tests = await new LocalContentRepository().getAllTests();
  return <DashboardClient tests={tests} />;
}
