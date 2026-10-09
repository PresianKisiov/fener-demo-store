import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly files from node_modules at runtime,
  // so it must not be bundled by Next.js.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
