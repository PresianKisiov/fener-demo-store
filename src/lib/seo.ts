/**
 * Should search engines index the site? Off by default: a demo with invented products
 * must not appear in Google. The real store sets SITE_INDEXABLE=true.
 */
export const siteIndexable = () => process.env.SITE_INDEXABLE === "true";
