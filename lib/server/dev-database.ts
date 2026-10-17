import "server-only";
import path from "node:path";
import crypto from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import postgres, { type Sql } from "postgres";
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
const DATABASE_ROW_ID = "primary";

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

function normalizeDatabase(db: Partial<DevDatabase> | null | undefined): DevDatabase {
  return {
    users: db?.users || [],
    sessions: db?.sessions || [],
    entitlements: db?.entitlements || [],
    orders: db?.orders || [],
    paymentEvents: db?.paymentEvents || [],
    refunds: db?.refunds || [],
    reconciliations: db?.reconciliations || [],
    accountData: db?.accountData || []
  };
}

let sqlClient: Sql | null = null;
let databaseReady: Promise<void> | null = null;

function getSql() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  if (!sqlClient) {
    sqlClient = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }
  return sqlClient;
}

async function ensurePostgresDatabase(sql: Sql) {
  databaseReady ||= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS emock_app_state (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO emock_app_state (id, data)
      VALUES (${DATABASE_ROW_ID}, ${sql.json(initialDb as unknown as postgres.JSONValue)})
      ON CONFLICT (id) DO NOTHING
    `;
  })().catch((error) => {
    databaseReady = null;
    throw error;
  });
  await databaseReady;
}

function requireDurableProductionStorage() {
  if (process.env.VERCEL && process.env.NODE_ENV === "production" && !process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for persistent account and payment storage on Vercel.");
  }
}

export async function readDevDatabase(): Promise<DevDatabase> {
  requireDurableProductionStorage();
  const sql = getSql();
  if (sql) {
    await ensurePostgresDatabase(sql);
    const rows = await sql<{ data: Partial<DevDatabase> }[]>`
      SELECT data FROM emock_app_state WHERE id = ${DATABASE_ROW_ID}
    `;
    return normalizeDatabase(rows[0]?.data);
  }
  try {
    const db = JSON.parse(await readFile(DB_PATH, "utf8")) as Partial<DevDatabase>;
    return normalizeDatabase(db);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return structuredClone(initialDb);
  }
}

export async function writeDevDatabase(db: DevDatabase) {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  const temp = `${DB_PATH}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, DB_PATH);
}

let updateQueue: Promise<unknown> = Promise.resolve();
export function updateDevDatabase<T>(update: (db: DevDatabase) => T | Promise<T>): Promise<T> {
  const run = updateQueue.then(async () => {
    requireDurableProductionStorage();
    const sql = getSql();
    if (sql) {
      await ensurePostgresDatabase(sql);
      const committed = await sql.begin(async (transaction) => {
        const rows = await transaction<{ data: Partial<DevDatabase> }[]>`
          SELECT data
          FROM emock_app_state
          WHERE id = ${DATABASE_ROW_ID}
          FOR UPDATE
        `;
        const db = normalizeDatabase(rows[0]?.data);
        const result = await update(db);
        await transaction`
          UPDATE emock_app_state
          SET data = ${transaction.json(db as unknown as postgres.JSONValue)}, updated_at = NOW()
          WHERE id = ${DATABASE_ROW_ID}
        `;
        return { value: result };
      });
      return committed.value;
    }
    const db = await readDevDatabase();
    const result = await update(db);
    await writeDevDatabase(db);
    return result;
  });
  updateQueue = run.catch(() => undefined);
  return run;
}
