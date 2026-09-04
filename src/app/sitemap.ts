import type { MetadataRoute } from "next";
import { siteUrl as site } from '@/lib/site';
const languages = ["ar", "ku", "de", "en"];
const pages = ["", "/search", "/about", "/how-to", "/safety", "/community-rules", "/contact", "/privacy", "/terms", "/imprint", "/account-deletion"];
export default function sitemap(): MetadataRoute.Sitemap { return languages.flatMap(lang => pages.map(path => ({ url: `${site}/${lang}${path}`, lastModified: new Date(), changeFrequency: path === "" || path === "/search" ? "daily" as const : "monthly" as const, priority: path === "" ? 1 : path === "/search" ? 0.9 : 0.6 }))); }
