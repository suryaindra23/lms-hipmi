import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const routes = ["", "/tentang", "/fitur", "/paket", "/cara-kerja", "/untuk-sekolah", "/keamanan", "/faq", "/kontak", "/daftar-sekolah", "/kebijakan-privasi", "/syarat-ketentuan", "/kebijakan-data-anak"];
  return routes.map((route) => ({ url: `${baseUrl}${route}`, lastModified: new Date(), changeFrequency: route === "" ? "weekly" : "monthly", priority: route === "" ? 1 : 0.7 }));
}
