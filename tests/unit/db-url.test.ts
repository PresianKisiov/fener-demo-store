import { describe, expect, it } from "vitest";
import { cleanDatabaseUrl } from "@/db/url";

describe("cleanDatabaseUrl", () => {
  it("removes channel_binding from a Neon connection string and keeps the rest", () => {
    const neon =
      "postgresql://neondb_owner:p4ss@ep-cool-name-a1b2c3-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    const cleaned = cleanDatabaseUrl(neon);
    expect(cleaned).not.toContain("channel_binding");
    expect(cleaned).toContain("sslmode=require");
    expect(cleaned).toContain("neondb_owner:p4ss@ep-cool-name-a1b2c3-pooler.us-east-2.aws.neon.tech/neondb");
  });

  it("tolerates quotes and spaces pasted by accident", () => {
    expect(cleanDatabaseUrl(' "postgres://u:p@h/db?channel_binding=require" ')).toBe("postgres://u:p@h/db");
  });

  it("leaves a normal connection string unchanged", () => {
    expect(cleanDatabaseUrl("postgres://u:p@localhost:5432/db?sslmode=disable")).toBe("postgres://u:p@localhost:5432/db?sslmode=disable");
  });
});
