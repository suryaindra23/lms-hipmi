"use client";

import { Building2, CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type PublicStatistic = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  cohortSize: number;
  metrics: {
    participatingStudents?: number;
    averageLearningProgress?: number;
    approvedStores?: number;
    approvedAffiliateContent?: number;
  };
  publishedAt: string;
  school?: { name?: string; city?: string | null; province?: string | null } | null;
};

const number = new Intl.NumberFormat("id-ID");

function formatPeriod(start: string, end: string) {
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return `${date.format(new Date(start))}–${date.format(new Date(end))}`;
}

export default function PublicStatistics() {
  const [statistics, setStatistics] = useState<PublicStatistic[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/public/statistics", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Statistik belum dapat dimuat");
        return response.json() as Promise<PublicStatistic[]>;
      })
      .then((data) => {
        setStatistics(data);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="public-statistics-title" className="border-b border-slate-900/10 bg-[#FFFFFF] py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-start lg:gap-20">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Dampak terverifikasi</p>
            <h2 id="public-statistics-title" className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">Angka yang boleh dilihat publik, tanpa mengorbankan privasi.</h2>
            <p className="mt-5 leading-7 text-slate-600">Hanya ringkasan yang sudah ditinjau dan memenuhi ambang minimum peserta yang dapat tampil di halaman ini.</p>
            <div className="mt-8 flex items-start gap-3 border-l-2 border-emerald-700 pl-4 text-sm leading-6 text-slate-700">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" size={19} />
              Nama siswa, nilai individual, dokumen identitas, dan kredensial toko tidak pernah menjadi statistik publik.
            </div>
          </div>

          <div aria-live="polite">
            {state === "loading" && <div className="grid min-h-56 place-items-center border-y border-slate-900/15 text-sm font-semibold text-slate-500">Memuat statistik terverifikasi…</div>}
            {state === "error" && <div role="status" className="grid min-h-56 place-items-center border-y border-slate-900/15 p-8 text-center text-sm text-slate-600">Statistik publik sedang tidak tersedia. Data internal sekolah tetap terlindungi.</div>}
            {state === "ready" && statistics.length === 0 && (
              <div className="grid min-h-56 place-items-center border-y border-slate-900/15 p-8 text-center">
                <div><CheckCircle2 aria-hidden="true" className="mx-auto text-orange-700" size={28} /><h3 className="mt-4 font-extrabold text-slate-900">Belum ada data yang dipublikasikan</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Ringkasan baru akan tampil setelah memenuhi ambang privasi dan selesai ditinjau.</p></div>
              </div>
            )}
            {state === "ready" && statistics.length > 0 && (
              <div className="grid border-t border-slate-900/15 md:grid-cols-2">
                {statistics.slice(0, 4).map((statistic) => {
                  const metrics = statistic.metrics ?? {};
                  return (
                    <article key={statistic.id} className="border-b border-slate-900/15 bg-white/50 p-6 md:odd:border-r">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-700">{formatPeriod(statistic.periodStart, statistic.periodEnd)}</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">{statistic.title}</h3></div><CheckCircle2 aria-label="Sudah disetujui" className="shrink-0 text-emerald-600" size={20} /></div>
                      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Building2 aria-hidden="true" size={15} />{statistic.school?.name || "Program Sunrise Academy"}{statistic.school?.city ? ` · ${statistic.school.city}` : ""}</p>
                      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
                        <div><dt className="text-[11px] text-slate-500">Peserta agregat</dt><dd className="mt-1 text-xl font-black text-slate-900">{number.format(metrics.participatingStudents ?? statistic.cohortSize)}</dd></div>
                        <div><dt className="text-[11px] text-slate-500">Progres rata-rata</dt><dd className="mt-1 text-xl font-black text-slate-900">{number.format(metrics.averageLearningProgress ?? 0)}%</dd></div>
                        <div><dt className="text-[11px] text-slate-500">Toko disetujui</dt><dd className="mt-1 text-xl font-black text-slate-900">{number.format(metrics.approvedStores ?? 0)}</dd></div>
                        <div><dt className="text-[11px] text-slate-500">Konten terverifikasi</dt><dd className="mt-1 text-xl font-black text-slate-900">{number.format(metrics.approvedAffiliateContent ?? 0)}</dd></div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
