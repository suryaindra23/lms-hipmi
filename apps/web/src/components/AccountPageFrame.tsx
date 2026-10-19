import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function AccountPageFrame({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header>
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:h-24 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Sunrise Academy — Beranda"><BrandLogo className="text-lg sm:text-xl" /></Link>
          <Link href="/login" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-slate-600 transition hover:text-orange-700 sm:text-sm"><ArrowLeft aria-hidden="true" size={16} /> Kembali ke login</Link>
        </div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] lg:grid-cols-[.92fr_1.08fr]">
        <section className="flex flex-col justify-between px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">{eyebrow}</p>
            <h1 className="mt-7 max-w-2xl text-[clamp(2.8rem,5.2vw,5.3rem)] font-extrabold leading-[1.02] tracking-[-0.06em]">{title}</h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{description}</p>
          </div>
          <p className="mt-12 flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck aria-hidden="true" size={16} className="text-orange-700" /> Akses dan data mengikuti peran pengguna.</p>
        </section>
        <section className="flex items-center bg-orange-50 px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-9">{children}</div>
        </section>
      </div>
    </main>
  );
}
