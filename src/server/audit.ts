import "server-only";
import type { DB, Tx } from "@/db/types";
import { auditLog } from "@/db/schema";

export async function audit(
  db: DB | Tx,
  entry: { entity: string; entityId: string | number; action: string; actor: string; fromStatus?: string; toStatus?: string },
) {
  await db.insert(auditLog).values({ ...entry, entityId: String(entry.entityId) });
}
