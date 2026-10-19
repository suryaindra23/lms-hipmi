"use client";

import { useEffect, useState } from "react";

type Content = { slug: string; type: string; title: string; excerpt?: string; body?: { text?: string }; imageUrl?: string };

export default function DynamicPublicContent() {
  const [items, setItems] = useState<Content[]>([]);
  useEffect(() => { fetch("/api/backend/public/content").then((response) => response.ok ? response.json() : []).then(setItems).catch(() => undefined); }, []);
  if (items.length === 0) return null;
  const labels: Record<string, string> = { TESTIMONIAL: "Cerita pengguna", CASE_STUDY: "Studi kasus", PARTNER: "Mitra", PAGE: "Informasi", FAQ: "Pertanyaan umum" };
  return <section className="border-b border-slate-900/10 bg-white py-20 sm:py-28" aria-labelledby="content-heading"><div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Catatan dari program</p><h2 id="content-heading" className="mt-5 max-w-2xl text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl">Cerita, pembelajaran, dan kabar terbaru.</h2><div className="mt-12 grid border-t border-slate-900/15 md:grid-cols-2 lg:grid-cols-3">{items.map((item, index) => <article key={`${item.type}-${item.slug}`} className={`border-b border-slate-900/15 py-7 md:p-7 ${index % 2 === 1 ? "md:border-l" : ""} ${index % 3 !== 0 ? "lg:border-l" : ""}`}><p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">{labels[item.type] || item.type}</p><h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.excerpt || item.body?.text}</p></article>)}</div></div></section>;
}
