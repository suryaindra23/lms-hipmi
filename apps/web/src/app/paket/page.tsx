import type { Metadata } from "next";
import Link from "next/link";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Paket Belajar | Sunrise Academy",
  description: "Bandingkan paket Gratis, Medium, dan Advanced beserta batas modul dan fitur yang tersedia.",
};

type PublicPlan = {
  code: "FREE" | "MEDIUM" | "ADVANCED";
  name: string;
  rank: number;
  moduleLimit: number;
  entitlements: Record<string, boolean | number | string>;
  offers: Array<{
    code: string;
    slug: string;
    name: string;
    billingModel: string;
    accessDurationDays: number | null;
    prices: Array<{
      currency: string;
      amount: string;
      compareAtAmount: string | null;
    }>;
  }>;
};

const featureLabels: Array<[string, string]> = [
  ["learning.materials.read", "Materi belajar digital"],
  ["assignments.standard.submit", "Tugas, penilaian, dan feedback"],
  ["student_store.submit", "Praktik pembuatan toko"],
  ["affiliate.content.submit", "Submission konten affiliate"],
  ["affiliate.metrics.manage", "Snapshot performa historis"],
  ["dashboards.advanced.read", "Dashboard lanjutan semua peran"],
  ["early_warnings.read", "Early warning dan pendampingan"],
  ["reports.export", "Reporting dan export"],
];

async function getPlans(): Promise<PublicPlan[]> {
  const apiUrl = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiUrl}/access/plans`, { cache: "no-store" });
    if (!response.ok) return [];
    return await response.json() as PublicPlan[];
  } catch {
    return [];
  }
}

const promotionalPriceFallbacks: Partial<Record<PublicPlan["code"], { amount: number; compareAtAmount: number }>> = {
  MEDIUM: { amount: 25_000, compareAtAmount: 499_000 },
  ADVANCED: { amount: 50_000, compareAtAmount: 899_000 },
};

function formatCurrency(amount: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPricing(plan: PublicPlan) {
  const price = plan.offers[0]?.prices[0];
  const fallback = promotionalPriceFallbacks[plan.code];
  const hasConfiguredComparison = Boolean(price?.compareAtAmount);
  const amount = hasConfiguredComparison ? Number(price?.amount ?? 0) : (fallback?.amount ?? Number(price?.amount ?? 0));
  if (!price || amount === 0) return { current: "Gratis", previous: null, saving: null };

  const compareAtAmount = hasConfiguredComparison ? Number(price.compareAtAmount) : (fallback?.compareAtAmount ?? amount);
  const saving = Math.max(compareAtAmount - amount, 0);

  return {
    current: formatCurrency(amount, price.currency),
    previous: saving > 0 ? formatCurrency(compareAtAmount, price.currency) : null,
    saving: saving > 0 ? formatCurrency(saving, price.currency) : null,
  };
}

export default async function PackagePage() {
  const plans = await getPlans();

  return (
    <div className="public-site min-h-screen bg-white">
      <Header />
      <main id="main-content">
        <section className="px-5 pb-14 pt-20 sm:px-8 sm:pb-20 sm:pt-28 lg:px-12">
          <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[1.16fr_.84fr] lg:items-end lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">
                <ShieldCheck size={18} aria-hidden="true" /> Pilihan akses program
              </span>
              <h1 className="mt-6 max-w-4xl text-[clamp(2.8rem,5vw,5.7rem)] font-extrabold leading-[1.02] tracking-[-0.06em] text-slate-950">
                Pilih akses belajar sesuai kebutuhan.
              </h1>
            </div>
            <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Paket berbayar dihitung untuk satu siswa. Paket Gratis otomatis menjadi akses dasar sekolah dan seluruh siswanya.
            </p>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6" aria-labelledby="package-list-title">
          <div className="mx-auto max-w-[1440px] border-t border-slate-200 pt-12">
            <h2 id="package-list-title" className="sr-only">Daftar paket belajar</h2>
            {plans.length === 0 ? (
              <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
                <LockKeyhole className="mx-auto text-orange-600" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-extrabold text-slate-900">Informasi paket sedang diperbarui</h2>
                <p className="mt-2 leading-7 text-slate-600">Harga dan ketersediaan tidak ditampilkan sampai data terverifikasi tersedia dari sistem.</p>
                <Link href="/kontak" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 font-bold text-white">Hubungi tim program</Link>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                {plans.map((plan) => {
                  const offer = plan.offers[0];
                  const highlighted = plan.code === "MEDIUM";
                  const pricing = getPricing(plan);
                  return (
                    <article key={plan.code} className={`relative flex flex-col rounded-[1.75rem] border bg-white p-7 ${highlighted ? "border-orange-400 ring-4 ring-orange-100" : "border-slate-200"}`}>
                      {highlighted && <span className="absolute -top-3 left-6 rounded-full bg-orange-600 px-3 py-1 text-xs font-extrabold text-white">Pilihan populer</span>}
                      <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-orange-700">{plan.name}</p>
                      <div className="mt-4 min-h-[76px]">
                        {pricing.previous && (
                          <div className="flex flex-wrap items-center gap-2">
                            <del className="text-sm font-bold text-slate-400 decoration-slate-500">{pricing.previous}</del>
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold text-orange-700">Hemat {pricing.saving}</span>
                          </div>
                        )}
                        <p className={`${pricing.previous ? "mt-2" : "mt-6"} text-3xl font-black text-slate-900`}>{pricing.current}</p>
                      </div>
                      <p className="mt-2 min-h-6 text-sm text-slate-500">
                        {offer?.accessDurationDays ? `1 siswa · akses ${offer.accessDurationDays} hari` : plan.code === "FREE" ? "Otomatis untuk sekolah & seluruh siswa" : "Durasi mengikuti penawaran"}
                      </p>
                      <div className="mt-6 rounded-2xl bg-amber-50 p-4">
                        <p className="text-sm font-bold text-slate-900">Maksimal {plan.moduleLimit} modul terbit</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{plan.code === "FREE" ? "Langsung aktif tanpa pembayaran atau approval." : "Aktif setelah pembayaran disetujui untuk satu siswa."}</p>
                      </div>
                      <ul className="mt-6 flex-1 space-y-3">
                        {featureLabels.map(([key, label]) => {
                          const included = Boolean(plan.entitlements[key]);
                          return (
                            <li key={key} className={`flex gap-3 text-sm ${included ? "text-slate-700" : "text-slate-400"}`}>
                              {included ? <Check size={18} className="shrink-0 text-emerald-600" aria-hidden="true" /> : <LockKeyhole size={17} className="shrink-0" aria-hidden="true" />}
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <Link href={plan.code === "FREE" ? "/login" : offer ? `/checkout/${encodeURIComponent(offer.slug)}` : "/kontak"} className={`mt-7 inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-extrabold ${highlighted ? "bg-sunrise text-white" : "border border-amber-200 bg-white text-slate-900 hover:bg-amber-50"}`}>
                        {plan.code === "FREE" ? "Mulai dengan Gratis" : offer ? `Pilih ${plan.name}` : "Minta informasi"}
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
            <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-7 text-slate-500">
              Harga Medium dan Advanced berlaku per siswa, bukan per sekolah. Paket Advanced tetap mengikuti pembatasan peran, tenant, consent, dan keamanan data.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
