import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emails } from "@/db/schema";
import { Icon } from "@/components/admin/Icon";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/auth";

export default async function EmailsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(emails).orderBy(desc(emails.createdAt), desc(emails.id)).limit(100);
  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Изпратени имейли</h1>
      <p className="mt-2 max-w-[75ch] text-sm text-adm-muted">
        В демото имейлите не излизат навън, а се записват тук. В истински магазин функцията sendEmail() в src/server/email.ts ги праща през Resend или Postmark.
      </p>
      {rows.length === 0 ? (
        <p className="adm-card mt-6 p-8 text-center text-adm-muted">Още няма имейли. Появяват се след първата поръчка от магазина.</p>
      ) : (
        <ul className="adm-card mt-6 divide-y divide-adm-line">
          {rows.map((m) => (
            <li key={m.id} className="px-5 py-4 text-sm">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                  <Icon name="mail" className="size-5 text-adm-blue" />
                  <span className="font-bold">{m.subject}</span>
                  <span className="text-adm-muted">{m.toAddress}</span>
                  <span className="ml-auto text-adm-muted tabular">{formatDateTime(m.createdAt)}</span>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-adm-bg p-4 font-[inherit]">{m.body}</pre>
                {m.orderId && <Link href={`/admin/poruchki/${m.orderId}`} className="mt-2 inline-block font-semibold text-adm-blue hover:underline">Към поръчката</Link>}
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
