import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("Лампа-2026!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Лампа");
    expect(await verifyPassword("Лампа-2026!", hash)).toBe(true);
    expect(await verifyPassword("лампа-2026!", hash)).toBe(false);
  });

  it("gives different hashes for the same password", async () => {
    expect(await hashPassword("demo1234")).not.toBe(await hashPassword("demo1234"));
  });

  it("never matches the dummy hash by accident", async () => {
    expect(await verifyPassword("", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("demo1234", DUMMY_HASH)).toBe(false);
  });
});
