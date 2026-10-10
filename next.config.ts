import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly files from node_modules at runtime,
  // so it must not be bundled by Next.js.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Product photos are sent through a Server Action. The browser shrinks them first,
    // but a large PNG can still be over the default 1 MB.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
