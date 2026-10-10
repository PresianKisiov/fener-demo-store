/** /robots.txt: which pages search engines may visit. */
import type { MetadataRoute } from "next";

// Built on every request, not once at build time: settings change without a deploy.
export const dynamic = "force-dynamic";
import { siteIndexable } from "@/lib/seo";
import { getBaseUrl } from "@/server/base-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getBaseUrl();
  if (!siteIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Cart, checkout, admin and APIs are private or useless in search results.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/kolichka", "/poruchka", "/test-plashtane"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
