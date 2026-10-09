import "@fontsource/nunito-sans/cyrillic-400.css";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/cyrillic-600.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/cyrillic-700.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/cyrillic-800.css";
import "@fontsource/nunito-sans/latin-800.css";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, withdrawals } from "@/db/schema";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/server/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const db = await getDb();
  const [waiting] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(sql`${orders.status} = 'pending_confirmation'`);
  const [open] = await db.select({ n: sql<number>`count(*)::int` }).from(withdrawals).where(sql`${withdrawals.refundedAt} is null`);

  return (
    <AdminShell admin={{ name: admin.name, email: admin.email }} notifications={waiting.n + open.n}>
      {children}
    </AdminShell>
  );
}
