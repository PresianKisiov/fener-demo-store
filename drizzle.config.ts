import { defineConfig } from "drizzle-kit";

// Used only by `npm run db:generate`: it reads src/db/schema.ts
// and writes SQL migration files into src/db/migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
