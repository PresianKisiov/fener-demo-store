import type { Metadata } from "next";
import Link from "next/link";
import { formatEur } from "@/lib/money";
import { SHOP } from "@/lib/settings";

export const metadata: Metadata = { title: "Общи условия и доставка" };

export default function TermsPage() {
  return (
    <article className="prose-shop mx-auto max-w-[68ch] py-6">
      <h1 className="font-display text-3xl font-medium">Общи условия и доставка</h1>
      <p className="mt-4 rounded-2xl bg-white p-4 text-sm">
        Демо текст. Истинският магазин има пълни общи условия, политика за поверителност и бисквитки, прегледани от юрист.
      </p>

      <h2 className="mt-8 font-display text-xl">Търговец</h2>
      <p>{SHOP.trader.company}, ЕИК {SHOP.trader.eik}, {SHOP.trader.address}, {SHOP.trader.email}, {SHOP.trader.phone}.</p>

      <h2 className="mt-8 font-display text-xl">Цени и плащане</h2>
      <p>Цените са в евро с включен ДДС. Плащането е с наложен платеж (такса {formatEur(SHOP.codFeeCents)}) или с карта. Договорът се сключва с натискане на бутона „Поръчка със задължение за плащане“.</p>

      <h2 className="mt-8 font-display text-xl">Доставка</h2>
      <p>С Еконт или Спиди. До офис или автомат: {formatEur(SHOP.shipping.officeCents)}. До адрес: {formatEur(SHOP.shipping.addressCents)}. Над {formatEur(SHOP.shipping.freeFromCents)} доставката е безплатна. Срок: {SHOP.deliveryWorkingDays.min} до {SHOP.deliveryWorkingDays.max} работни дни.</p>

      <h2 className="mt-8 font-display text-xl">Право на отказ</h2>
      <p>Имаш право да се откажеш от договора в срок от {SHOP.withdrawalDays} дни от получаването на стоката, без да посочваш причина. Използвай <Link href="/otkaz" className="underline">функцията за отказ</Link>, пиши ни на {SHOP.trader.email} или изпрати стандартния формуляр. Връщаме платената сума, включително стандартната доставка, до 14 дни от получаването на отказа. Можем да изчакаме, докато получим стоката или доказателство, че е изпратена. Разходите за връщане са за твоя сметка.</p>

      <h2 className="mt-8 font-display text-xl">Гаранция</h2>
      <p>За несъответствие на стоката с договора отговаряме 2 години от доставката по Закона за предоставянето на цифрово съдържание и цифрови услуги и за продажбата на стоки.</p>

      <h2 className="mt-8 font-display text-xl">Спорове</h2>
      <p>Можеш да се обърнеш към Комисията за защита на потребителите и нейните помирителни комисии.</p>

      <h2 id="biskvitki" className="mt-8 scroll-mt-6 font-display text-xl">Бисквитки</h2>
      <p>
        Нужни (винаги): количката (cart_id) и изборът ти за бисквитките (fener_consent, 180 дни). Рекламни (само с твое съгласие): Meta Pixel
        (_fbp, _fbc). Те казват на Meta кои реклами са довели до покупка; при покупка Meta получава и криптиран (SHA-256) отпечатък на имейла и
        телефона ти, не самите тях. Можеш да промениш избора си от „Настройки на бисквитките“ долу на всяка страница.
      </p>
    </article>
  );
}
