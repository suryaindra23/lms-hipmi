"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type ReportOption = { value: string; label: string };
type ExportJob = {
  id: string;
  reportType: string;
  format: string;
  status: string;
  rowCount: number;
  fileName: string | null;
  failureReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
};
type Statistic = {
  id: string;
  title: string;
  cohortSize: number;
  minimumCohort: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
  school?: { name: string };
};

function formatDate(value: string | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

const statusClass: Record<string, string> = {
  QUEUED: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  EXPIRED: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function ReportsPage() {
  const [options, setOptions] = useState<{ reportTypes: ReportOption[]; formats: ReportOption[]; notes: string[] } | null>(null);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [canApproveStatistics, setCanApproveStatistics] = useState(false);
  const [reportType, setReportType] = useState("STUDENT_PROGRESS");
  const [periodDays, setPeriodDays] = useState(30);
  const [statisticTitle, setStatisticTitle] = useState("Ringkasan Dampak Program");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const sessionResponse = await fetch("/api/session", { cache: "no-store" });
      if (!sessionResponse.ok) throw new Error("Sesi tidak valid");
      const session = await sessionResponse.json();
      const canApprove = session.roles?.includes("super-admin") || session.permissions?.some((permission: { resource: string; action: string }) => permission.resource === "public-statistics" && permission.action === "approve");
      setCanApproveStatistics(Boolean(canApprove));
      const requests = [fetch("/api/backend/monitoring/reports/options", { cache: "no-store" }), fetch("/api/backend/monitoring/exports", { cache: "no-store" })];
      if (canApprove) requests.push(fetch("/api/backend/monitoring/public-statistics", { cache: "no-store" }));
      const responses = await Promise.all(requests);
      if (!responses[0].ok || !responses[1].ok) throw new Error("Data laporan belum dapat dimuat");
      setOptions(await responses[0].json());
      setJobs(await responses[1].json());
      if (canApprove && responses[2]?.ok) setStatistics(await responses[2].json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Data laporan belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hasActiveJobs = useMemo(() => jobs.some((job) => ["QUEUED", "PROCESSING"].includes(job.status)), [jobs]);
  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => void load(), 3500);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, load]);

  const createExport = async () => {
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await csrfFetch("/api/backend/monitoring/exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reportType, format: "CSV", timezone: "Asia/Jakarta", periodDays }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Export belum dapat dibuat");
      setNotice("Permintaan export masuk antrean. Halaman akan memperbarui status secara otomatis.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Export belum dapat dibuat"); }
    finally { setSubmitting(false); }
  };

  const download = async (job: ExportJob) => {
    setError("");
    try {
      const response = await fetch(`/api/backend/monitoring/exports/${job.id}/download`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "File belum dapat diunduh");
      window.location.assign(body.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "File belum dapat diunduh"); }
  };

  const createStatistic = async () => {
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await csrfFetch("/api/backend/monitoring/public-statistics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: statisticTitle, periodDays }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Snapshot statistik belum dapat dibuat");
      setNotice("Snapshot agregat dibuat dan menunggu persetujuan sebelum dapat tampil publik.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Snapshot statistik belum dapat dibuat"); }
    finally { setSubmitting(false); }
  };

  const reviewStatistic = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await csrfFetch(`/api/backend/monitoring/public-statistics/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, notes: decision === "APPROVED" ? "Agregat dan ambang privasi telah diperiksa." : "Snapshot belum layak dipublikasikan." }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Review statistik belum berhasil");
      setNotice(decision === "APPROVED" ? "Statistik disetujui dan dapat tampil di kanal publik." : "Statistik ditolak dan tidak dipublikasikan.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Review statistik belum berhasil"); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="p-5 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Reporting & export</p>
        <h2 className="mt-2 flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl"><FileSpreadsheet className="h-7 w-7 text-orange-600" /> Laporan yang aman dan terukur</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Pilih jenis laporan dan periode. File dibuat di background, tersimpan privat, tidak memuat dokumen identitas atau credential, lalu kedaluwarsa otomatis.</p>
      </header>

      {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
        <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="font-bold text-slate-900">Buat export baru</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Jenis laporan<select value={reportType} onChange={(event) => setReportType(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:ring-2 focus:ring-orange-400">{options?.reportTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Periode data<select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:ring-2 focus:ring-orange-400"><option value={30}>30 hari</option><option value={90}>90 hari</option><option value={180}>180 hari</option><option value={365}>1 tahun</option></select></label>
          </div>
          <button onClick={createExport} disabled={submitting || loading} className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Masukkan ke antrean export</button>
        </div>
        <aside className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 font-bold text-emerald-900"><ShieldCheck className="h-5 w-5" /> Perlindungan data</div>
          <ul className="mt-4 space-y-3 text-sm leading-5 text-emerald-900/80">{options?.notes.map((note) => <li key={note} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{note}</li>)}</ul>
        </aside>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-orange-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Riwayat export</h3><p className="mt-1 text-xs text-slate-500">Status diperbarui otomatis selama job diproses.</p></div><button onClick={() => void load()} className="rounded-lg p-2 text-orange-700 hover:bg-orange-50" aria-label="Perbarui riwayat export"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Laporan</th><th className="px-5 py-3">Dibuat</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Baris</th><th className="px-5 py-3">Kedaluwarsa</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{jobs.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Belum ada permintaan export.</td></tr> : jobs.map((job) => <tr key={job.id}><td className="px-5 py-4"><p className="font-semibold text-slate-900">{job.reportType.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{job.fileName || job.format}</p></td><td className="px-5 py-4 text-xs text-slate-600">{formatDate(job.createdAt)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[job.status] || "bg-slate-100"}`}>{job.status}</span></td><td className="px-5 py-4">{job.rowCount}</td><td className="px-5 py-4 text-xs text-slate-600">{formatDate(job.expiresAt)}</td><td className="px-5 py-4 text-right">{job.status === "COMPLETED" ? <button onClick={() => void download(job)} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white">Unduh</button> : ["QUEUED", "PROCESSING"].includes(job.status) ? <LoaderCircle className="ml-auto h-4 w-4 animate-spin text-blue-600" /> : <span className="text-xs text-red-600">{job.failureReason || "Tidak tersedia"}</span>}</td></tr>)}</tbody></table></div>
      </section>

      {canApproveStatistics && (
        <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Governance statistik publik</p><h3 className="mt-1 text-lg font-bold text-slate-900">Snapshot agregat dengan persetujuan</h3><p className="mt-1 text-sm text-slate-500">Publikasi hanya dapat disetujui jika cohort memenuhi ambang privasi minimum.</p></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={statisticTitle} onChange={(event) => setStatisticTitle(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400" aria-label="Judul statistik publik" /><button onClick={createStatistic} disabled={submitting || !statisticTitle.trim()} className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white disabled:opacity-60">Buat snapshot</button></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">{statistics.length === 0 ? <p className="text-sm text-slate-500">Belum ada snapshot statistik.</p> : statistics.map((statistic) => <article key={statistic.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{statistic.title}</h4><p className="mt-1 text-xs text-slate-500">{statistic.school?.name} · cohort {statistic.cohortSize}/{statistic.minimumCohort}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass[statistic.status] || "bg-slate-100"}`}>{statistic.status}</span></div>{statistic.status === "PENDING_APPROVAL" && <div className="mt-4 flex gap-2"><button onClick={() => void reviewStatistic(statistic.id, "APPROVED")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Setujui</button><button onClick={() => void reviewStatistic(statistic.id, "REJECTED")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Tolak</button></div>}</article>)}</div>
        </section>
      )}
    </main>
  );
}
