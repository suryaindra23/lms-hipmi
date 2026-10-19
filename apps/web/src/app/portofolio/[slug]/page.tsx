"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BriefcaseBusiness, Loader2 } from "lucide-react";

type Portfolio = { title: string; description?: string; sourceType: string; studentName: string; school: string; city?: string; publishedAt?: string };

export default function PublicPortfolioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<Portfolio | null | undefined>(undefined);
  useEffect(() => { fetch(`/api/backend/public/portfolio/${encodeURIComponent(slug)}`).then((response) => response.ok ? response.json() : null).then(setItem).catch(() => setItem(null)); }, [slug]);
  if (item === undefined) return <div className="flex min-h-screen items-center justify-center gap-2 text-orange-600"><Loader2 className="animate-spin" size={18} /> Memuat karya...</div>;
  return <main className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6"><article className="w-full max-w-2xl rounded-3xl border border-orange-100 bg-white p-8 shadow-sm"><BriefcaseBusiness className="text-orange-600" size={42} />{item ? <><p className="mt-5 text-sm font-bold uppercase tracking-widest text-orange-600">{item.sourceType}</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">{item.title}</h1><p className="mt-4 leading-7 text-slate-600">{item.description || "Karya terpilih dalam portofolio siswa."}</p><div className="mt-7 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600"><p className="font-bold text-slate-900">{item.studentName}</p><p>{item.school}{item.city ? ` · ${item.city}` : ""}</p></div></> : <><h1 className="mt-5 text-2xl font-extrabold text-slate-900">Karya tidak tersedia</h1><p className="mt-3 text-slate-600">Karya mungkin privat atau persetujuan publikasinya sudah tidak aktif.</p></>}<Link href="/" className="mt-7 inline-block text-sm font-bold text-orange-700">Kembali ke beranda</Link></article></main>;
}
