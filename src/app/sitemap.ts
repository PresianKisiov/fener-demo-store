/** /sitemap.xml: the list of pages Google should know about, built from the database. */
import type { MetadataRoute } from "next";

// Built on every request, not once at build time: products change without a deploy.
export const dynamic = "force-dynamic";
import { getPublishedProducts } from "@/server/catalog";
import { getBaseUrl } from "@/server/base-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getBaseUrl();
  const products = await getPublishedProducts();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/katalog`, changeFrequency: "daily", priority: 0.9 },
    ...products.map((p) => ({ url: `${base}/produkt/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${base}/usloviya`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
