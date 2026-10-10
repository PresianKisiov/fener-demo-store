/**
 * Does the email's domain accept email at all? We ask DNS for the domain's mail
 * servers (MX records). "ivan@gmial.com" fails here, because gmial.com has none.
 *
 * Why not more: whether the mailbox "ivan" exists can only be learned by sending a
 * message. Servers that answer that question are abused by spammers, so Gmail and
 * most others refuse to answer. The confirmation email is the real check.
 *
 * Safety: an order must never be lost because of a DNS problem on our side. So we
 * first check a domain that certainly works (gmail.com). If even that fails, DNS
 * is broken here and we skip the check instead of blocking every customer.
 */
import "server-only";
import { promises as dns } from "node:dns";

const TIMEOUT_MS = 2500;
const NO_DOMAIN = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

type Resolver = {
  resolveMx(host: string): Promise<{ exchange: string }[]>;
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
};

/** The whole check never takes longer than this: the customer is waiting. */
const TOTAL_MS = 3000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), TIMEOUT_MS)),
  ]);
}

let dnsWorks: { ok: boolean; at: number } | null = null;

async function resolverWorks(resolver: Resolver): Promise<boolean> {
  if (dnsWorks && Date.now() - dnsWorks.at < 10 * 60 * 1000) return dnsWorks.ok;
  const ok = await withTimeout(resolver.resolveMx("gmail.com")).then((r) => r.length > 0, () => false);
  dnsWorks = { ok, at: Date.now() };
  return ok;
}

type Status = "accepts" | "rejects" | "unknown";

/** "accepts" | "rejects" | "unknown" (DNS slow or broken: do not block the customer). */
export function emailDomainStatus(email: string, resolver: Resolver = dns): Promise<Status> {
  return Promise.race([check(email, resolver), new Promise<Status>((resolve) => setTimeout(() => resolve("unknown"), TOTAL_MS))]);
}

async function check(email: string, resolver: Resolver): Promise<Status> {
  const domain = email.split("@").pop()?.trim().toLowerCase();
  if (!domain || process.env.EMAIL_DNS_CHECK === "off") return "unknown";
  if (!(await resolverWorks(resolver))) return "unknown";
  try {
    const mx = await withTimeout(resolver.resolveMx(domain));
    // A "null MX" (one record pointing to ".") means: this domain never receives email.
    if (mx.length === 1 && (mx[0].exchange === "" || mx[0].exchange === ".")) return "rejects";
    if (mx.length > 0) return "accepts";
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (!NO_DOMAIN.has(code)) return "unknown";
  }
  // No MX record: the standard allows delivery to the domain's own address (IPv4 or IPv6).
  let unsure = false;
  for (const lookup of [resolver.resolve4.bind(resolver), resolver.resolve6.bind(resolver)]) {
    try {
      if ((await withTimeout(lookup(domain))).length > 0) return "accepts";
    } catch (error) {
      if (!NO_DOMAIN.has((error as { code?: string }).code ?? "")) unsure = true;
    }
  }
  return unsure ? "unknown" : "rejects";
}

/** For tests: forget the cached "does DNS work here" answer. */
export function resetEmailCheckCache() {
  dnsWorks = null;
}
