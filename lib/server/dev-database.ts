import "server-only";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { AccountDataSnapshot, AppUser, Order, PaymentEventRecord, ReconciliationRecord, RefundRecord, UserEntitlement } from "@/types/billing";

export interface DevDatabase {
  users: AppUser[];
  sessions: { id: string; userId: string; createdAt: string }[];
  entitlements: UserEntitlement[];
  orders: Order[];
  paymentEvents: PaymentEventRecord[];
  refunds: RefundRecord[];
  reconciliations: ReconciliationRecord[];
  accountData: AccountDataSnapshot[];
}

const DB_PATH = path.join(process.cwd(), "data", "dev-commerce.json");

const initialDb: DevDatabase = {
  users: [],
  sessions: [],
  entitlements: [],
  orders: [],
  paymentEvents: [],
  refunds: [],
  reconciliations: [],
  accountData: []
};

export async function readDevDatabase(): Promise<DevDatabase> {
  try {
    const db = JSON.parse(await readFile(DB_PATH, "utf8")) as Partial<DevDatabase>;
    return {
      users: db.users || [],
      sessions: db.sessions || [],
      entitlements: db.entitlements || [],
      orders: db.orders || [],
      paymentEvents: db.paymentEvents || [],
      refunds: db.refunds || [],
      reconciliations: db.reconciliations || [],
      accountData: db.accountData || []
    };
  } catch {
    return initialDb;
  }
}

export async function writeDevDatabase(db: DevDatabase) {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

export async function updateDevDatabase<T>(update: (db: DevDatabase) => T | Promise<T>) {
  const db = await readDevDatabase();
  const result = await update(db);
  await writeDevDatabase(db);
  return result;
}
