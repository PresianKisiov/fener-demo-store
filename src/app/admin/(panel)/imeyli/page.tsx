import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emails } from "@/db/schema";
import { Icon } from "@/components/admin/Icon";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/auth";
import { emailProviderConfigured } from "@/server/email";
import { retryEmailsAction } from "@/app/actions/admin";

const STATUS: Record<string, { label: string; className: string }> = {
  demo: { label: "Само записан", className: "bg-adm-bg text-adm-muted" },
  pending: { label: "Чака изпращане", className: "bg-[#fff4e5] text-[#b25e00]" },
  sending: { label: "Изпраща се", className: "bg-[#fff4e5] text-[#b25e00]" },
  sent: { label: "Изпратен", className: "bg-[#e6f6f3] text-adm-up" },
  failed: { label: "Неуспешен", className: "bg-[#fdecef] text-adm-down" },
};

export default async function EmailsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(emails).orderBy(desc(emails.createdAt), desc(emails.id)).limit(100);
  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Изпратени имейли</h1>
      <p className="mt-2 max-w-[75ch] text-sm text-adm-muted">
        {emailProviderConfigured()
          ? "Имейлите се пращат през Resend веднага след като промяната по поръчката е записана. Неуспешните се опитват отново до 5 пъти."
          : "Имейлите още не излизат навън: няма RESEND_API_KEY и EMAIL_FROM. Записват се тук, за да виждаш какво и кога би получил клиентът."}
      </p>
      {rows.some((m) => m.status === "failed" || m.status === "pending") && (
        <form action={retryEmailsAction} className="mt-4">
          <button type="submit" className="adm-btn">Изпрати чакащите и неуспешните</button>
        </form>
      )}
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
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${(STATUS[m.status] ?? STATUS.demo).className}`} data-testid="email-status">
                    {(STATUS[m.status] ?? STATUS.demo).label}
                  </span>
                  <span className="ml-auto text-adm-muted tabular">
                    {formatDateTime(m.createdAt)}
                    {m.sentAt && `, изпратен ${formatDateTime(m.sentAt)}`}
                  </span>
                </summary>
                {m.lastError && <p className="mt-3 font-semibold text-adm-down">Грешка от Resend: {m.lastError} (опити: {m.attempts})</p>}
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
