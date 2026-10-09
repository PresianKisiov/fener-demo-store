/**
 * The "payment provider's page". In real life this page belongs to Stripe or the
 * bank and lives on their domain. It is part of the demo only so that you can see
 * the whole flow without an account.
 */
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, payments } from "@/db/schema";
import { mockProviderAction } from "@/app/actions/mock-provider";
import { SubmitButton } from "@/components/SubmitButton";
import { formatEur } from "@/lib/money";

export default async function MockProviderPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ amountCents: payments.amountCents, status: payments.status, number: orders.number })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(payments.id, paymentId));
  if (!row) notFound();

  return (
    <div className="min-h-dvh bg-white px-4 py-12 font-sans">
      <div className="mx-auto max-w-md">
        <p className="text-sm font-semibold text-ink-soft">Тестов доставчик на плащания</p>
        <h1 className="mt-2 text-2xl font-semibold">Плащане към Фенер (демо)</h1>
        <div className="mt-6 rounded-2xl border border-line p-5">
          <p className="text-ink-soft">Поръчка {row.number}</p>
          <p className="tabular mt-1 text-3xl font-semibold">{formatEur(row.amountCents)}</p>
          <div className="mt-5 rounded-xl bg-mist p-3 font-mono text-sm">4242 4242 4242 4242 &nbsp; 12/30 &nbsp; 123</div>
        </div>

        {row.status === "pending" ? (
          <div className="mt-6 grid gap-3">
            <form action={mockProviderAction}>
              <input type="hidden" name="paymentId" value={paymentId} />
              <input type="hidden" name="outcome" value="succeeded" />
              <SubmitButton className="btn-primary w-full" pendingText="Плащаме...">Плати {formatEur(row.amountCents)}</SubmitButton>
            </form>
            <form action={mockProviderAction}>
              <input type="hidden" name="paymentId" value={paymentId} />
              <input type="hidden" name="outcome" value="failed" />
              <SubmitButton className="btn-secondary w-full" pendingText="Отказваме...">Симулирай отказана карта</SubmitButton>
            </form>
          </div>
        ) : (
          <p className="mt-6">Това плащане вече е обработено.</p>
        )}

        <p className="mt-8 text-sm text-ink-soft">
          Какво става при натискане: този „доставчик“ изпраща подписано съобщение (webhook) до магазина на
          /api/payments/mock-webhook. Магазинът проверява подписа и чак тогава маркира поръчката като платена. После те връща
          обратно в магазина.
        </p>
      </div>
    </div>
  );
}
