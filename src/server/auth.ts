/**
 * Admin login: email + password, checked against the `admins` table.
 *
 * After a successful login the browser gets a cookie "admin_session" with
 * "<adminId>.<expiry>.<signature>". The signature (HMAC with SESSION_SECRET)
 * means nobody can make their own cookie or change the id or the expiry.
 * On every admin request the admin is loaded again from the database, so a
 * deleted admin loses access immediately.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { admins, type Admin } from "@/db/schema";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";

const COOKIE = "admin_session";
const SESSION_HOURS = 8;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "dev-only-session-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Returns the admin if email and password match, otherwise null. */
export async function checkCredentials(email: string, password: string): Promise<Admin | null> {
  const db = await getDb();
  const [admin] = await db
    .select()
    .from(admins)
    .where(sql`lower(${admins.email}) = ${email.trim().toLowerCase()}`);
  // Check a dummy hash when the email does not exist, so the answer takes the
  // same time and does not reveal which emails have accounts.
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) return null;
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  return admin;
}

export async function startAdminSession(adminId: number) {
  const payload = `${adminId}.${Date.now() + SESSION_HOURS * 60 * 60 * 1000}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [id, expires, signature] = value.split(".");
  if (!id || !expires || !signature || !safeEqual(signature, sign(`${id}.${expires}`))) return null;
  if (Number(expires) < Date.now()) return null;
  const db = await getDb();
  const [admin] = await db.select().from(admins).where(eq(admins.id, Number(id)));
  return admin ?? null;
}

/**
 * Call at the top of EVERY admin page and admin Server Action.
 * Checking only in the layout is not enough: Server Actions can be called directly.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/vhod");
  return admin;
}
