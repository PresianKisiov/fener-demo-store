import type { Metadata } from "next";
import "@fontsource/unbounded/cyrillic-500.css";
import "@fontsource/unbounded/latin-500.css";
import "@fontsource/unbounded/cyrillic-600.css";
import "@fontsource/unbounded/latin-600.css";
import "@fontsource/golos-text/cyrillic-400.css";
import "@fontsource/golos-text/latin-400.css";
import "@fontsource/golos-text/cyrillic-500.css";
import "@fontsource/golos-text/latin-500.css";
import "@fontsource/golos-text/cyrillic-600.css";
import "@fontsource/golos-text/latin-600.css";
import "./globals.css";
import { siteIndexable } from "@/lib/seo";

// Every page reads the database, so nothing is pre-rendered at build time.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: { default: "Фенер: лампи за четене и работа (демо)", template: "%s | Фенер (демо)" },
    description: "Демо онлайн магазин без Shopify: каталог, количка, поръчка, плащане и админ панел.",
    robots: siteIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
