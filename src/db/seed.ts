/**
 * Demo data, inserted the first time the app starts with an empty database.
 * All products, companies and offices here are invented for the demo.
 */
import { eq, sql } from "drizzle-orm";
import { lowestPriceBefore } from "../lib/omnibus";
import { hashPassword, verifyPassword } from "../lib/password";
import { priceCart } from "../lib/pricing";
import { demoOfficeRows } from "./offices";
import * as schema from "./schema";
import type { DB } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const EU_MAKER = {
  manufacturerName: "Демо Осветление ООД",
  manufacturerAddress: "ул. Индустриална 7, 5300 Габрово, България",
  manufacturerEmail: "safety@example.com",
  manufacturerInEu: true,
};

const NON_EU_MAKER = {
  manufacturerName: "Demo Lighting Co., Ltd.",
  manufacturerAddress: "No. 1 Example Road, Shenzhen, China",
  manufacturerEmail: "export@example.com",
  manufacturerInEu: false,
  euResponsibleName: "Демо Внос ЕООД",
  euResponsibleAddress: "бул. Примерен 22, 1000 София, България",
  euResponsibleEmail: "gpsr@example.com",
};

const LAMP_WARNINGS =
  "Само за употреба на закрито. Не гледай директно в светодиода от близко разстояние. Зареждай с адаптер 5 V, 1-2 A. Пази от деца под 3 години: съдържа малки части.";

type SeedProduct = {
  product: typeof schema.products.$inferInsert;
  // Price history, oldest first: [days ago, price in cents].
  history: [number, number][];
  // If set, the last price change is announced as a reduction.
  announceReduction?: boolean;
};

const PRODUCTS: SeedProduct[] = [
  {
    product: {
      slug: "lampa-s-shtipka-stranitsa",
      name: "Лампа с щипка „Страница“",
      category: "За четене",
      illustration: "clip",
      shortDescription: "Щипка за книга, рафт или табла на леглото. Три нива на топла светлина.",
      description:
        "Щипката се захваща за корица, рафт или табла до 4 см дебелина. Гъвкавото рамо насочва светлината точно към страницата, без да заслепява човека до теб. Зарежда се с USB-C и издържа около 20 часа на най-ниското ниво.",
      priceCents: 2490,
      stock: 34,
      specs: [
        ["Светлина", "3 нива, 2700-3500 K"],
        ["Батерия", "1200 mAh, до 20 часа"],
        ["Зареждане", "USB-C, кабел в комплекта"],
        ["Щипка", "до 4 см"],
        ["Тегло", "86 г"],
      ],
      modelNumber: "FN-CL-01",
      safetyWarnings: LAMP_WARNINGS,
      isPublished: true,
      ...NON_EU_MAKER,
    },
    history: [[60, 2990], [10, 2490]],
  },
  {
    product: {
      slug: "lampa-za-kniga-otmetka",
      name: "Лампа за книга „Отметка“",
      category: "За четене",
      illustration: "booklight",
      shortDescription: "Тънка като отметка. Пъха се между страниците и свети само върху тях.",
      description:
        "Плоска лампа, която се захваща за горния край на книгата. Светлината пада под ъгъл само върху двете страници. Подходяща за четене в тъмна спалня или в самолет.",
      priceCents: 1490,
      stock: 52,
      specs: [
        ["Светлина", "2 нива, 3000 K"],
        ["Батерия", "300 mAh, до 12 часа"],
        ["Зареждане", "USB-C"],
        ["Дебелина", "9 мм"],
        ["Тегло", "32 г"],
      ],
      modelNumber: "FN-BK-02",
      safetyWarnings: LAMP_WARNINGS,
      isPublished: true,
      ...NON_EU_MAKER,
    },
    history: [[45, 1490]],
  },
  {
    product: {
      slug: "lampa-za-vrat-noshtna-smyana",
      name: "Лампа за врат „Нощна смяна“",
      category: "За четене",
      illustration: "neck",
      shortDescription: "Две гъвкави рамена около врата. Ръцете остават свободни за плетене, четене или ремонт.",
      description:
        "Носи се около врата и свети напред с две независими рамена. Полезна при четене в леглото, плетене, работа по колата или разходка с кучето вечер.",
      priceCents: 1990,
      stock: 18,
      specs: [
        ["Светлина", "3 нива, 3000-6000 K"],
        ["Батерия", "1500 mAh, до 30 часа"],
        ["Зареждане", "USB-C"],
        ["Тегло", "120 г"],
      ],
      modelNumber: "FN-NK-03",
      safetyWarnings: LAMP_WARNINGS,
      isPublished: true,
      ...NON_EU_MAKER,
    },
    history: [[40, 1990]],
  },
  {
    product: {
      slug: "nastolna-lampa-arhiv",
      name: "Настолна лампа „Архив“",
      category: "Настолни",
      illustration: "desk",
      shortDescription: "Рамо с три стави и метална основа. Осветява цялото бюро равномерно.",
      description:
        "Класическа работна лампа с три стави и тежка метална основа, която не се преобръща. Светодиодният модул осветява зона от около 60 на 40 см. Яркостта се регулира с колелце на основата.",
      priceCents: 4490,
      stock: 9,
      specs: [
        ["Светлина", "плавна регулация, 4000 K"],
        ["Мощност", "8 W"],
        ["Захранване", "кабел 1,8 м, адаптер в комплекта"],
        ["Височина", "до 52 см"],
        ["Основа", "метал, 1,1 кг"],
      ],
      modelNumber: "FN-DS-04",
      safetyWarnings:
        "Само за употреба на закрито. Не покривай лампата по време на работа. Използвай само адаптера от комплекта. Изключвай от контакта преди почистване.",
      isPublished: true,
      ...EU_MAKER,
    },
    // 59,90 for a long time, 54,90 from 25 days ago, then a sale at 44,90 two days ago.
    history: [[90, 5990], [25, 5490], [2, 4490]],
    announceReduction: true,
  },
  {
    product: {
      slug: "nastolna-lampa-tetradka",
      name: "Настолна лампа „Тетрадка“",
      category: "Настолни",
      illustration: "minidesk",
      shortDescription: "Малка лампа за домашни и лаптоп. Сгъва се на плоско, когато не ти трябва.",
      description:
        "Компактна настолна лампа, която се сгъва до 3 см височина. Има вградена батерия, така че може да се мести от бюрото до масата без кабел.",
      priceCents: 3490,
      stock: 22,
      specs: [
        ["Светлина", "5 нива, 3000-5000 K"],
        ["Батерия", "2000 mAh, до 8 часа"],
        ["Зареждане", "USB-C"],
        ["Височина", "3-38 см"],
      ],
      modelNumber: "FN-MD-05",
      safetyWarnings: LAMP_WARNINGS,
      isPublished: true,
      ...EU_MAKER,
    },
    history: [[30, 3490]],
  },
  {
    product: {
      slug: "noshtna-lampa-fitil",
      name: "Нощна лампа „Фитил“",
      category: "Нощни",
      illustration: "bedside",
      shortDescription: "Мека светлина като от свещ. Изгасва сама след 30 минути.",
      description:
        "Нощна лампа с много топла светлина, която не пречи на заспиването. Таймерът я изгасва след 30 минути. Корпусът е от матово стъкло и не се нагорещява.",
      priceCents: 2990,
      stock: 15,
      specs: [
        ["Светлина", "2200 K, плавно затъмняване"],
        ["Таймер", "30 минути"],
        ["Захранване", "USB-C или батерия 1800 mAh"],
        ["Материал", "матово стъкло, дърво"],
      ],
      modelNumber: "FN-BS-06",
      safetyWarnings: LAMP_WARNINGS,
      isPublished: true,
      ...EU_MAKER,
    },
    history: [[50, 2990]],
  },
  {
    product: {
      slug: "led-lenta-nishka-2m",
      name: "LED лента „Нишка“, 2 м",
      category: "Под рафт",
      illustration: "strip",
      shortDescription: "Залепва се под рафт или шкаф. Топла светлина над плота или бюрото.",
      description:
        "Самозалепваща LED лента с дължина 2 метра. Реже се на всеки 5 см. Включва захранване и ключ на кабела.",
      priceCents: 1790,
      measureUnit: "м",
      measureQuantityMilli: 2000,
      stock: 40,
      specs: [
        ["Дължина", "2 м"],
        ["Светлина", "3000 K"],
        ["Мощност", "9 W"],
        ["Рязане", "на всеки 5 см"],
      ],
      modelNumber: "FN-ST-07",
      safetyWarnings:
        "Само за употреба на закрито и на сухо място. Не лепи върху горещи повърхности. Използвай само захранването от комплекта.",
      isPublished: true,
      ...NON_EU_MAKER,
    },
    history: [[35, 1790]],
  },
  {
    // Deliberately unpublished: the safety data is incomplete, so the admin
    // panel blocks publishing until it is filled in.
    product: {
      slug: "podova-lampa-kula",
      name: "Подова лампа „Кула“",
      category: "Подови",
      illustration: "floor",
      shortDescription: "Висока лампа до фотьойла за четене.",
      description: "Подова лампа с регулируема глава. Чака данни от доставчика.",
      priceCents: 8990,
      stock: 0,
      specs: [["Височина", "155 см"]],
      modelNumber: "FN-FL-08",
      isPublished: false,
      manufacturerName: "Demo Lighting Co., Ltd.",
      manufacturerInEu: false,
    },
    history: [[5, 8990]],
  },
];

// Packed weight in grams (product + box). Used to suggest the weight on the waybill.
const WEIGHTS: Record<string, number> = {
  "lampa-s-shtipka-stranitsa": 250,
  "lampa-za-kniga-otmetka": 150,
  "lampa-za-vrat-noshtna-smyana": 300,
  "nastolna-lampa-arhiv": 1600,
  "nastolna-lampa-tetradka": 900,
  "noshtna-lampa-fitil": 450,
  "led-lenta-nishka-2m": 200,
  "podova-lampa-kula": 4800,
};

export async function seedIfEmpty(db: DB) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.products);
  if (count > 0) return;

  await db.transaction(async (tx) => {
    for (const { product, history, announceReduction } of PRODUCTS) {
      const points = history.map(([ago, priceCents]) => ({ priceCents, validFrom: daysAgo(ago) }));
      const current = points[points.length - 1];

      let reduction = {};
      if (announceReduction) {
        const prior = lowestPriceBefore(points.slice(0, -1), current.validFrom);
        if (prior !== null && prior > current.priceCents) {
          reduction = { priorPriceCents: prior, reductionStartedAt: current.validFrom };
        }
      }

      const [row] = await tx
        .insert(schema.products)
        .values({ ...product, weightGrams: WEIGHTS[product.slug] ?? 500, priceCents: current.priceCents, ...reduction })
        .returning({ id: schema.products.id });

      await tx.insert(schema.priceHistory).values(
        points.map((p) => ({ productId: row.id, ...p, changedBy: "seed" })),
      );
    }
    await tx.insert(schema.courierOffices).values(demoOfficeRows());
  });

  if (process.env.SEED_DEMO_ORDERS !== "false") await seedDemoOrders(db);
}

/**
 * Admin login data. Locally the defaults are admin@fener.test / demo1234.
 * Online (requireExplicit) ADMIN_EMAIL and ADMIN_PASSWORD must be set.
 */
export function adminCredentials(requireExplicit: boolean) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (requireExplicit && password.length < 10) {
      throw new Error("ADMIN_PASSWORD трябва да е поне 10 знака, когато сайтът е онлайн.");
    }
    return { email, password };
  }
  if (requireExplicit) throw new Error("Задай ADMIN_EMAIL и ADMIN_PASSWORD в настройките на хостинга (Environment Variables).");
  return { email: "admin@fener.test", password: "demo1234" };
}

/** Creates the admin from the environment, or updates its password if ADMIN_PASSWORD changed. */
export async function ensureAdmin(db: DB, creds: { email: string; password: string }) {
  const [existing] = await db.select().from(schema.admins).where(eq(schema.admins.email, creds.email));
  if (!existing) {
    await db.insert(schema.admins).values({
      email: creds.email,
      name: "Администратор",
      passwordHash: await hashPassword(creds.password),
    });
  } else if (!(await verifyPassword(creds.password, existing.passwordHash))) {
    await db
      .update(schema.admins)
      .set({ passwordHash: await hashPassword(creds.password) })
      .where(eq(schema.admins.id, existing.id));
  }
}

// ---------------------------------------------------------------------------
// Demo orders for the last 75 days, so the dashboard has something to show.
// Generated with a fixed random seed: the same data on every computer.
// Turn off with SEED_DEMO_ORDERS=false.

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEN = ["Иван", "Георги", "Николай", "Димитър", "Стефан", "Александър", "Христо", "Калоян", "Мартин", "Борис"];
const WOMEN = ["Мария", "Елена", "Петя", "Десислава", "Виктория", "Гергана", "Радост", "Теодора", "Невена", "Ивета"];
const SURNAMES = ["Петров", "Иванов", "Георгиев", "Димитров", "Стоянов", "Николов", "Колев", "Тодоров", "Маринов", "Ангелов"];
const POST_CODES: Record<string, string> = {
  Габрово: "5300",
  София: "1000",
  Пловдив: "4000",
  Варна: "9000",
  "Велико Търново": "5000",
  Бургас: "8000",
  Русе: "7000",
  Севлиево: "5400",
};
const CITIES = Object.keys(POST_CODES);

async function seedDemoOrders(db: DB) {
  const r = random(20261008);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const products = (await db.select().from(schema.products)).filter((p) => p.isPublished);
  const offices = await db.select().from(schema.courierOffices);
  const now = Date.now();
  let n = 0;

  for (let age = 74; age >= 0; age--) {
    const day = new Date(now - age * DAY);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    let perDay = Math.floor(r() * 3.2) + (weekend ? 1 : 0);
    if (age === 21 || age === 22) perDay += 5; // a small ad campaign
    if (age === 0) perDay = Math.min(perDay, 2) + 1;

    for (let k = 0; k < perDay; k++) {
      n++;
      const createdAt = new Date(day.getTime() - (age === 0 ? Math.floor(r() * 3) + 1 : Math.floor(r() * 10)) * 60 * 60 * 1000);
      if (createdAt.getTime() > now) continue;

      const first = r() < 0.5 ? pick(MEN) : pick(WOMEN);
      const female = WOMEN.includes(first);
      const customerName = `${first} ${pick(SURNAMES)}${female ? "а" : ""}`;
      const courier = r() < 0.6 ? "econt" : "speedy";
      const deliveryRoll = r();
      const deliveryType = deliveryRoll < 0.55 ? "office" : deliveryRoll < 0.7 ? "locker" : "address";
      const office = deliveryType === "address" ? null : pick(offices.filter((o) => o.courier === courier && o.kind === deliveryType));
      const city = office ? office.city : pick(CITIES);
      const street = `ул. Примерна ${1 + Math.floor(r() * 90)}`;
      const paymentMethod = r() < 0.75 ? "cod" : "card";

      const chosen = new Set([pick(products)]);
      if (r() < 0.3) chosen.add(pick(products));
      const lines = [...chosen].map((p) => ({
        productId: p.id,
        name: p.name,
        unitPriceCents: p.priceCents,
        vatRate: p.vatRate,
        quantity: r() < 0.8 ? 1 : 2,
      }));
      const totals = priceCart({ lines, deliveryType, paymentMethod });

      const roll = r();
      let status: string;
      if (age >= 5) {
        if (paymentMethod === "cod" && roll < 0.06) status = age >= 8 ? "returned" : "refused";
        else if (paymentMethod === "cod" && roll < 0.09) status = "cancelled";
        else if (roll < 0.13 && age < 14) status = "withdrawal_requested";
        else status = "delivered";
      } else if (age >= 3) status = roll < 0.7 ? "shipped" : "delivered";
      else if (age >= 1) status = roll < 0.5 ? "confirmed" : "packed";
      else status = paymentMethod === "cod" ? "pending_confirmation" : "confirmed";

      const wasShipped = ["shipped", "delivered", "refused", "returned", "withdrawal_requested"].includes(status);
      const wasDelivered = status === "delivered" || status === "withdrawal_requested";
      const deliveredAt = wasDelivered ? new Date(createdAt.getTime() + 2 * DAY) : null;

      const [order] = await db
        .insert(schema.orders)
        .values({
          number: `tmp-seed-${n}`,
          status,
          customerName,
          phone: `+3598800${String(10000 + n).slice(-5)}`,
          email: `klient${n}@example.com`,
          courier,
          deliveryType,
          officeId: office?.id ?? null,
          deliveryLabel: office ? `${office.name}, ${office.address}, ${office.city}` : `${street}, ${POST_CODES[city]} ${city}`,
          city,
          postCode: office ? null : POST_CODES[city],
          addressLine: office ? null : street,
          paymentMethod,
          subtotalCents: totals.subtotalCents,
          shippingCents: totals.shippingCents,
          codFeeCents: totals.codFeeCents,
          totalCents: totals.totalCents,
          vatCents: totals.vatCents,
          marketingConsent: r() < 0.3,
          termsAcceptedAt: createdAt,
          trackingNumber: wasShipped ? `${courier === "econt" ? "EC" : "SP"}${String(4000000000 + n * 7919).slice(0, 10)}` : null,
          shippedAt: wasShipped ? new Date(createdAt.getTime() + DAY) : null,
          deliveredAt,
          createdAt,
        })
        .returning({ id: schema.orders.id });

      await db
        .update(schema.orders)
        .set({ number: `${createdAt.getFullYear()}-${String(order.id).padStart(6, "0")}` })
        .where(eq(schema.orders.id, order.id));

      await db.insert(schema.orderItems).values(
        totals.lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          productName: l.name,
          unitPriceCents: l.unitPriceCents,
          vatRate: l.vatRate,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents,
        })),
      );

      if (paymentMethod === "card") {
        await db.insert(schema.payments).values({ orderId: order.id, provider: "mock", status: "succeeded", amountCents: totals.totalCents, createdAt, updatedAt: createdAt });
      } else if (deliveredAt) {
        await db.insert(schema.payments).values({ orderId: order.id, provider: "cod", status: "succeeded", amountCents: totals.totalCents, createdAt: deliveredAt, updatedAt: deliveredAt });
      }

      if (status === "withdrawal_requested" && deliveredAt) {
        await db.insert(schema.withdrawals).values({
          orderId: order.id,
          customerName,
          contactEmail: `klient${n}@example.com`,
          reason: r() < 0.5 ? "Светлината е по-студена, отколкото очаквах." : null,
          requestedAt: new Date(deliveredAt.getTime() + 2 * DAY),
        });
      }

      await db.insert(schema.auditLog).values({
        entity: "order",
        entityId: String(order.id),
        action: "seed",
        toStatus: status,
        actor: "seed",
        createdAt,
      });
    }
  }
}
