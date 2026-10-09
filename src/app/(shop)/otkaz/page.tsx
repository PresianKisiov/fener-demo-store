import type { Metadata } from "next";
import { WithdrawalForm } from "@/components/WithdrawalForm";
import { SHOP } from "@/lib/settings";

export const metadata: Metadata = { title: "Отказ от договора" };

export default function WithdrawalPage() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="font-display text-3xl font-medium">Отказ от договора</h1>
      <p className="mt-3 text-ink-soft">
        Можеш да се откажеш от поръчка в срок от {SHOP.withdrawalDays} дни от получаването ѝ, без да посочваш причина. Ще получиш
        потвърждение с датата и часа на отказа на имейла си.
      </p>
      <div className="mt-8">
        <WithdrawalForm />
      </div>
      <p className="mt-10 text-sm text-ink-soft">
        Можеш да се откажеш и с имейл до {SHOP.trader.email} или със стандартния формуляр за отказ от Закона за защита на потребителите.
      </p>
    </div>
  );
}
