import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/api/", "/login", "/lupa-password", "/reset-password", "/aktivasi"] }], sitemap: `${baseUrl}/sitemap.xml` };
}
