"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock3, ExternalLink, FileUp, RefreshCw, ShieldAlert, UserRoundCheck, XCircle } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

const statusLabels: Record<string, string> = { PENDING_VERIFICATION: "Menunggu verifikasi", UNVERIFIED: "Belum diverifikasi", NEEDS_REVIEW: "Perlu diperiksa", VERIFIED: "Terverifikasi", REJECTED: "Ditolak", QUEUED: "Dalam antrean", PROCESSING: "Sedang diproses", COMPLETED: "Selesai", COMPLETED_WITH_ERRORS: "Selesai dengan catatan", FAILED: "Gagal", SUBMITTED: "Baru dikirim", RESUBMITTED: "Dikirim ulang" };

function money(value: string | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV harus memiliki header dan minimal satu baris data");
  const headers = lines[0].split(",").map((item) => item.trim());
  const required = ["videoId", "snapshotDate", "views", "clicks", "orders", "unitsSold", "gmv", "commission"];
  if (required.some((key) => !headers.includes(key))) throw new Error(`Header wajib: ${required.join(", ")}`);
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((item) => item.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    return {
      videoId: row.videoId,
      snapshotDate: new Date(row.snapshotDate).toISOString(),
      views: Number(row.views || 0), likes: Number(row.likes || 0), comments: Number(row.comments || 0), shares: Number(row.shares || 0),
      clicks: Number(row.clicks || 0), orders: Number(row.orders || 0), unitsSold: Number(row.unitsSold || 0), refunds: Number(row.refunds || 0),
      gmv: Number(row.gmv || 0), commission: Number(row.commission || 0), currency: row.currency || "IDR", evidenceUrl: row.evidenceUrl || undefined,
    };
  });
}

export default function AffiliateReviewPage() {
  const [queue, setQueue] = useState<any>({ accounts: [], metrics: [], flags: [] });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [imports, setImports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [csvText, setCsvText] = useState("videoId,snapshotDate,views,clicks,orders,unitsSold,gmv,commission,likes,comments,shares,refunds,currency,evidenceUrl\n");
  const [sourceName, setSourceName] = useState(`affiliate-metrics-${new Date().toISOString().slice(0, 10)}.csv`);

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      setSourceName(file.name);
      if (file.name.toLowerCase().endsWith(".csv")) {
        setCsvText(await file.text());
        return;
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Gunakan file CSV atau XLSX");
      const XLSX = await import("@e965/xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) throw new Error("Workbook tidak memiliki worksheet");
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, { header: 1, raw: false, defval: "" });
      const lines = rows.filter((row) => row.some((value) => String(value).trim())).map((row) => row.map((value) => String(value ?? "").replaceAll(",", " ")).join(","));
      setCsvText(lines.join("\n"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File belum dapat dibaca");
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [queueResponse, submittedResponse, resubmittedResponse, importsResponse] = await Promise.all([
        fetch("/api/backend/affiliate/verification-queue", { cache: "no-store" }),
        fetch("/api/backend/submissions?status=SUBMITTED", { cache: "no-store" }),
        fetch("/api/backend/submissions?status=RESUBMITTED", { cache: "no-store" }),
        fetch("/api/backend/affiliate/metric-imports", { cache: "no-store" }),
      ]);
      const [queueData, submittedData, resubmittedData, importsData] = await Promise.all([queueResponse.json(), submittedResponse.json(), resubmittedResponse.json(), importsResponse.json()]);
      if (!queueResponse.ok) throw new Error(queueData.message || "Antrean verifikasi belum dapat dimuat");
      setQueue(queueData);
      setSubmissions([...(submittedData.data || []), ...(resubmittedData.data || [])].filter((item: any) => item.affiliateVideos?.length));
      setImports(Array.isArray(importsData) ? importsData : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Antrean belum dapat dimuat"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, url: string, body: object, success: string) => {
    setBusyId(id); setError(""); setMessage("");
    try {
      const response = await csrfFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Tindakan belum dapat diproses");
      setMessage(success); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tindakan belum dapat diproses"); }
    finally { setBusyId(""); }
  };

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault(); setBusyId("import"); setError(""); setMessage("");
    try {
      const rows = parseCsv(csvText);
      const response = await csrfFetch("/api/backend/affiliate/metric-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceName, rows }) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Impor belum dapat dimulai");
      setMessage(`${rows.length} baris masuk antrean pemrosesan latar belakang.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impor belum dapat dimulai"); }
    finally { setBusyId(""); }
  };

  if (loading) return <main className="min-h-screen bg-[#FFFFFF] p-6 sm:p-8"><p className="font-semibold text-orange-600">Memuat antrean affiliate...</p></main>;

  return <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600">Review & verifikasi manusia</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Verifikasi Affiliate</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Periksa akun, konten, snapshot metrik, serta flag kualitas. Flag tidak menghukum siswa otomatis dan selalu memerlukan keputusan reviewer.</p></div><button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-orange-700"><RefreshCw size={17}/> Muat ulang</button></header>
    {(error || message) && <div role="status" className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Review konten", submissions.length, Clock3], ["Akun", queue.accounts.length, UserRoundCheck], ["Snapshot", queue.metrics.length, BadgeCheck], ["Flag terbuka", queue.flags.length, ShieldAlert]].map(([label, value, Icon]: any) => <article key={label} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><Icon className="mb-3 text-orange-600" size={21}/><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p></article>)}</section>

    <section><h2 className="text-xl font-extrabold text-slate-900">Konten menunggu review akademik</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{submissions.length ? submissions.map((submission) => <article key={submission.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-orange-600">{statusLabels[submission.status]}</p><h3 className="mt-1 font-extrabold text-slate-900">{submission.assignment.title}</h3><p className="mt-1 text-sm text-slate-600">{submission.student.fullName} · {submission.student.studentNumber}</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{submission._count?.versions || 1} versi</span></div><Link href={`/dashboard/review/${submission.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white">Buka review & rubrik <ExternalLink size={15}/></Link></article>) : <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500 lg:col-span-2">Tidak ada konten yang menunggu review.</p>}</div></section>

    <section><h2 className="text-xl font-extrabold text-slate-900">Verifikasi akun publik</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{queue.accounts.length ? queue.accounts.map((account: any) => <article key={account.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-orange-600">{account.platform}</p><h3 className="mt-1 font-extrabold">@{account.username}</h3><p className="mt-1 text-sm text-slate-600">{account.student.fullName} · {account.student.studentNumber}</p><a href={account.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-orange-700">Buka profil publik <ExternalLink size={13}/></a></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{statusLabels[account.status]}</span></div><textarea value={notes[account.id] || ""} onChange={(e) => setNotes({ ...notes, [account.id]: e.target.value })} placeholder="Catatan reviewer (wajib jika ditolak)" className="mt-4 min-h-20 w-full rounded-xl border p-3 text-sm"/><div className="mt-3 flex gap-2"><button disabled={busyId === account.id} onClick={() => void act(account.id, `/api/backend/affiliate/accounts/${account.id}/review`, { status: "VERIFIED", notes: notes[account.id] }, "Akun berhasil diverifikasi.")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white"><CheckCircle2 size={16}/> Verifikasi</button><button disabled={busyId === account.id} onClick={() => void act(account.id, `/api/backend/affiliate/accounts/${account.id}/review`, { status: "REJECTED", notes: notes[account.id] }, "Akun ditolak dengan catatan.")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700"><XCircle size={16}/> Tolak</button></div></article>) : <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500 lg:col-span-2">Semua akun telah ditangani.</p>}</div></section>

    <section><h2 className="text-xl font-extrabold text-slate-900">Verifikasi snapshot metrik</h2><div className="mt-4 space-y-4">{queue.metrics.length ? queue.metrics.map((metric: any) => <article key={metric.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><div className="grid gap-5 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${metric.verification === "NEEDS_REVIEW" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabels[metric.verification]}</span><span className="text-xs text-slate-500">{new Date(metric.snapshotDate).toLocaleString("id-ID")} · {metric.source}</span></div><h3 className="mt-2 font-extrabold">{metric.student.fullName} · {metric.affiliateVideo.productName || "Konten affiliate"}</h3><a href={metric.affiliateVideo.videoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-orange-700">Buka konten <ExternalLink size={13}/></a><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">{[["Views",metric.views],["Klik",metric.clicks],["Pesanan",metric.orders],["GMV",money(metric.gmv)],["Komisi",money(metric.commission)]].map(([label,value]) => <div key={String(label)} className="rounded-lg bg-orange-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-extrabold">{value}</p></div>)}</div>{metric.fraudFlags?.length > 0 && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-amber-800"><AlertTriangle size={17}/> Alasan pemeriksaan</p><ul className="mt-2 list-inside list-disc text-sm text-amber-800">{metric.fraudFlags.map((flag: any) => <li key={flag.id}>{flag.reason}</li>)}</ul></div>}</div><div className="w-full lg:w-72"><textarea value={notes[metric.id] || ""} onChange={(e) => setNotes({ ...notes, [metric.id]: e.target.value })} placeholder="Catatan verifikasi" className="min-h-20 w-full rounded-xl border p-3 text-sm"/><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={busyId === metric.id} onClick={() => void act(metric.id, `/api/backend/affiliate/metrics/${metric.id}/verify`, { decision: "VERIFIED", notes: notes[metric.id] }, "Snapshot terverifikasi.")} className="min-h-11 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white">Verifikasi</button><button disabled={busyId === metric.id} onClick={() => void act(metric.id, `/api/backend/affiliate/metrics/${metric.id}/verify`, { decision: "REJECTED", notes: notes[metric.id] }, "Snapshot ditolak dengan alasan.")} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700">Tolak</button></div></div></div></article>) : <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">Semua snapshot telah ditangani.</p>}</div></section>

    <section><h2 className="text-xl font-extrabold text-slate-900">Flag kualitas data</h2><p className="mt-1 text-sm text-slate-600">Pilih penyelesaian setelah bukti diperiksa. Nilai snapshot asli tidak diubah.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{queue.flags.length ? queue.flags.map((flag: any) => <article key={flag.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-amber-700">{flag.type}</p><h3 className="mt-1 font-extrabold">{flag.affiliateVideo.student.fullName}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{flag.reason}</p><textarea value={notes[flag.id] || ""} onChange={(e) => setNotes({ ...notes, [flag.id]: e.target.value })} placeholder="Hasil pemeriksaan (wajib)" className="mt-4 min-h-20 w-full rounded-xl border p-3 text-sm"/><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={() => void act(flag.id, `/api/backend/affiliate/flags/${flag.id}/resolve`, { status: "DISMISSED", notes: notes[flag.id] }, "Flag dinyatakan tidak terbukti.")} className="min-h-11 rounded-xl border px-2 text-xs font-bold">Tidak terbukti</button><button onClick={() => void act(flag.id, `/api/backend/affiliate/flags/${flag.id}/resolve`, { status: "RESOLVED", notes: notes[flag.id] }, "Flag selesai ditangani.")} className="min-h-11 rounded-xl bg-slate-900 px-2 text-xs font-bold text-white">Selesai</button><button onClick={() => void act(flag.id, `/api/backend/affiliate/flags/${flag.id}/resolve`, { status: "CONFIRMED", notes: notes[flag.id] }, "Flag dikonfirmasi untuk tindak lanjut.")} className="min-h-11 rounded-xl border border-red-200 px-2 text-xs font-bold text-red-700">Dikonfirmasi</button></div></article>) : <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500 lg:col-span-2">Tidak ada flag terbuka.</p>}</div></section>

    <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><FileUp className="mt-1 shrink-0 text-orange-600"/><div><h2 className="text-xl font-extrabold text-slate-900">Impor metrik CSV/XLSX asinkron</h2><p className="mt-1 text-sm leading-6 text-slate-600">Pilih file atau tempel CSV. Baris diproses worker di latar belakang, sehingga halaman tetap responsif dan setiap kesalahan tercatat per baris.</p></div></div><form onSubmit={handleImport} className="mt-5 grid gap-4"><label className="text-sm font-bold">Pilih file CSV atau XLSX<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void handleImportFile(e.target.files?.[0])} className="mt-1 block min-h-11 w-full rounded-xl border bg-white px-3 py-2 font-normal"/></label><label className="text-sm font-bold">Nama sumber<input required value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-bold">Preview data CSV<textarea required value={csvText} onChange={(e) => setCsvText(e.target.value)} className="mt-1 min-h-44 w-full rounded-xl border p-3 font-mono text-xs font-normal"/></label><button disabled={busyId === "import"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white disabled:opacity-50"><FileUp size={17}/>{busyId === "import" ? "Mengantrekan..." : "Mulai impor"}</button></form>{imports.length > 0 && <div className="mt-6 overflow-x-auto"><table className="min-w-[700px] w-full text-left text-sm"><thead className="bg-orange-50 text-xs uppercase text-slate-600"><tr><th className="p-3">Sumber</th><th className="p-3">Status</th><th className="p-3">Progres</th><th className="p-3">Berhasil</th><th className="p-3">Gagal</th></tr></thead><tbody>{imports.map((item: any) => <tr key={item.id} className="border-t"><td className="p-3 font-semibold">{item.sourceName}</td><td className="p-3">{statusLabels[item.status] || item.status}</td><td className="p-3">{item.processedRows}/{item.totalRows}</td><td className="p-3 text-emerald-700">{item.validRows}</td><td className="p-3 text-red-700">{item.failedRows}</td></tr>)}</tbody></table></div>}</section>
  </div></main>;
}
