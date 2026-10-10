"use server";
/**
 * Admin Server Actions. Every one of them starts with requireAdmin():
 * a Server Action is a public endpoint, and the layout check alone does not protect it.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { asc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { priceHistory, products } from "@/db/schema";
import { formatEur, parseEurToCents } from "@/lib/money";
import { lowestPriceBefore } from "@/lib/omnibus";
import { adminTransitions, isOrderStatus } from "@/lib/order-status";
import { missingSafetyFields } from "@/lib/gpsr";
import { slugify } from "@/lib/slug";
import { audit } from "@/server/audit";
import { checkCredentials, endAdminSession, requireAdmin, startAdminSession } from "@/server/auth";
import { retryFailedEmails } from "@/server/email";
import { OrderError, shipOrder, transitionOrder } from "@/server/orders";

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Въведи имейл и парола.", email };
  const admin = await checkCredentials(email, password);
  // Same message for a wrong email and a wrong password: do not reveal which one exists.
  if (!admin) return { error: "Грешен имейл или парола.", email };
  await startAdminSession(admin.id);
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/vhod");
}

export type OrderActionState = { error?: string };

export async function changeOrderStatusAction(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const orderId = Number(formData.get("orderId"));
  const to = String(formData.get("to") ?? "");
  const from = String(formData.get("from") ?? "");
  if (!isOrderStatus(to) || !isOrderStatus(from) || !adminTransitions(from).includes(to)) {
    return { error: "Тази промяна не е позволена от админ панела." };
  }
  try {
    if (to === "shipped") await shipOrder(orderId, "admin");
    else await transitionOrder(orderId, to, "admin");
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin", "layout");
  return {};
}

const productSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(3, "Името е твърде кратко."),
  shortDescription: z.string().trim().min(10, "Кратко описание: поне 10 знака."),
  description: z.string().trim().min(20, "Описание: поне 20 знака."),
  price: z.string(),
  stock: z.coerce.number().int().min(0, "Наличността не може да е отрицателна."),
  weightGrams: z.coerce.number().int().min(1, "Теглото е в грамове, поне 1.").max(50000, "Над 50 кг е палет, не колет."),
  modelNumber: z.string().trim(),
  manufacturerName: z.string().trim(),
  manufacturerAddress: z.string().trim(),
  manufacturerEmail: z.string().trim(),
  manufacturerInEu: z.enum(["yes", "no"]),
  euResponsibleName: z.string().trim(),
  euResponsibleAddress: z.string().trim(),
  euResponsibleEmail: z.string().trim(),
  safetyWarnings: z.string().trim(),
  isPublished: z.literal("on").optional(),
  announceReduction: z.literal("on").optional(),
});

// On error the submitted values are sent back, so the form can show them again
// (React resets a form after its action finishes).
export type ProductFormState = { error?: string; saved?: boolean; values?: Record<string, string> };

export async function updateProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const fail = (error: string): ProductFormState => ({ error, values });
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const priceCents = parseEurToCents(d.price);
  if (priceCents === null || priceCents < 1) return fail("Цената трябва да е число, например 24,90.");

  const safety = { ...d, manufacturerInEu: d.manufacturerInEu === "yes" };
  const missing = missingSafetyFields(safety);
  if (d.isPublished === "on" && missing.length > 0) {
    return fail(`Не може да се публикува без данни за безопасност (GPSR). Липсва: ${missing.join(", ")}.`);
  }

  const db = await getDb();
  const [current] = await db.select().from(products).where(eq(products.id, d.id));
  if (!current) return fail("Продуктът не съществува.");

  const now = new Date();
  const priceChanged = priceCents !== current.priceCents;
  let reduction: { priorPriceCents: number | null; reductionStartedAt: Date | null } = {
    priorPriceCents: null,
    reductionStartedAt: null,
  };

  if (d.announceReduction === "on") {
    if (!priceChanged) {
      if (!current.priorPriceCents) return fail("За да обявиш намаление, въведи новата, по-ниска цена.");
      reduction = { priorPriceCents: current.priorPriceCents, reductionStartedAt: current.reductionStartedAt };
    } else {
      // Omnibus: the reference is the lowest price of the last 30 days, from the history table.
      const history = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.productId, d.id))
        .orderBy(asc(priceHistory.validFrom));
      const prior = lowestPriceBefore(history, now);
      if (prior === null || priceCents >= prior) {
        return fail(
          `Това не е намаление по закона: новата цена трябва да е под най-ниската цена от последните 30 дни${prior ? ` (${formatEur(prior)})` : ""}.`,
        );
      }
      reduction = { priorPriceCents: prior, reductionStartedAt: now };
    }
  }

  await db.transaction(async (tx) => {
    if (priceChanged) {
      await tx.insert(priceHistory).values({ productId: d.id, priceCents, validFrom: now, changedBy: "admin" });
    }
    await tx
      .update(products)
      .set({
        name: d.name,
        shortDescription: d.shortDescription,
        description: d.description,
        priceCents,
        stock: d.stock,
        weightGrams: d.weightGrams,
        modelNumber: d.modelNumber,
        manufacturerName: d.manufacturerName,
        manufacturerAddress: d.manufacturerAddress,
        manufacturerEmail: d.manufacturerEmail,
        manufacturerInEu: safety.manufacturerInEu,
        euResponsibleName: d.euResponsibleName,
        euResponsibleAddress: d.euResponsibleAddress,
        euResponsibleEmail: d.euResponsibleEmail,
        safetyWarnings: d.safetyWarnings,
        isPublished: d.isPublished === "on",
        ...reduction,
        updatedAt: now,
      })
      .where(eq(products.id, d.id));
    await audit(tx, { entity: "product", entityId: d.id, action: priceChanged ? `price ${current.priceCents} -> ${priceCents}` : "updated", actor: "admin" });
  });

  revalidatePath("/", "layout");
  return { saved: true };
}

export type CreateProductState = { error?: string };

const ILLUSTRATIONS = ["clip", "booklight", "neck", "desk", "minidesk", "bedside", "strip", "floor"];

/** Creates a hidden draft product and opens it for editing. It stays hidden until the safety data is filled in. */
export async function createProductAction(_prev: CreateProductState, formData: FormData): Promise<CreateProductState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const illustration = String(formData.get("illustration") ?? "clip");
  const priceCents = parseEurToCents(String(formData.get("price") ?? ""));
  if (name.length < 3) return { error: "Името е твърде кратко." };
  if (category.length < 2) return { error: "Напиши категория." };
  if (priceCents === null || priceCents < 1) return { error: "Цената трябва да е число, например 24,90." };

  const db = await getDb();
  const base = slugify(name) || "produkt";
  const taken = new Set((await db.select({ slug: products.slug }).from(products).where(like(products.slug, `${base}%`))).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        slug,
        name,
        category,
        illustration: ILLUSTRATIONS.includes(illustration) ? illustration : "clip",
        shortDescription: "",
        description: "",
        priceCents,
        stock: 0,
        isPublished: false,
      })
      .returning({ id: products.id });
    await tx.insert(priceHistory).values({ productId: row.id, priceCents, validFrom: new Date(), changedBy: "admin" });
    await audit(tx, { entity: "product", entityId: row.id, action: "created", actor: "admin" });
    return row.id;
  });
  redirect(`/admin/produkti/${id}`);
}

/** Quick stock change from the "Наличности" page. */
export async function updateStockAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("productId"));
  const stock = Number(formData.get("stock"));
  if (!Number.isInteger(id) || !Number.isInteger(stock) || stock < 0 || stock > 100000) return;
  const db = await getDb();
  await db.update(products).set({ stock, updatedAt: new Date() }).where(eq(products.id, id));
  await audit(db, { entity: "product", entityId: id, action: `stock -> ${stock}`, actor: "admin" });
  revalidatePath("/admin/nalichnosti");
}

/** Puts failed emails back in the queue and sends them. */
export async function retryEmailsAction() {
  await requireAdmin();
  await retryFailedEmails();
  revalidatePath("/admin/imeyli");
}
