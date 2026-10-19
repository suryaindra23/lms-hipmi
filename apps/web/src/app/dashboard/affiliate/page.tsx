"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, ExternalLink, FileVideo2, Link2, Plus, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

const platformLabels: Record<string, string> = { TIKTOK: "TikTok", SHOPEE: "Shopee Video", INSTAGRAM: "Instagram Reels", YOUTUBE: "YouTube Shorts" };
const statusLabels: Record<string, string> = { DRAFT: "Draf", SUBMITTED: "Menunggu review", RESUBMITTED: "Dikirim ulang", REVISION_REQUIRED: "Perlu revisi", APPROVED: "Disetujui", REJECTED: "Ditolak", UNVERIFIED: "Belum diverifikasi", NEEDS_REVIEW: "Perlu diperiksa", VERIFIED: "Terverifikasi", PENDING_VERIFICATION: "Menunggu verifikasi", INACTIVE: "Tidak aktif" };

const emptyAccount = { platform: "TIKTOK", username: "", displayName: "", profileUrl: "", externalAccountId: "" };
const emptyContent = { affiliateAccountId: "", platform: "TIKTOK", videoUrl: "", publishedAt: "", caption: "", hook: "", productName: "", productExternalId: "", productUrl: "", campaignName: "", evidenceUrl: "", insightsEvidenceUrl: "", studentNote: "", disclosureAccepted: false, ownershipDeclared: false };
const emptyMetric = { views: "", likes: "", comments: "", shares: "", clicks: "", orders: "", unitsSold: "", refunds: "", gmv: "", commission: "", snapshotDate: "", evidenceUrl: "", supersedesId: "" };

function money(value: number | string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AffiliateWorkspacePage() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ ...emptyAccount });
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [contentForm, setContentForm] = useState({ ...emptyContent, publishedAt: localDateTime() });
  const [metricVideo, setMetricVideo] = useState<any>(null);
  const [metricForm, setMetricForm] = useState({ ...emptyMetric, snapshotDate: localDateTime() });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/backend/affiliate/workspace", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Ruang kerja affiliate belum dapat dimuat");
      setWorkspace(data);
      const requestedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("assignmentId") : null;
      if (requestedId) setSelectedAssignment(data.assignments?.find((item: any) => item.id === requestedId) || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ruang kerja affiliate belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const performance = workspace?.performance || {};
  const videos = performance.videos || [];
  const selectedExistingVideo = selectedAssignment?.submissions?.[0]?.affiliateVideos?.[0];

  useEffect(() => {
    if (!selectedAssignment) return;
    const existing = selectedAssignment.submissions?.[0]?.affiliateVideos?.[0];
    const account = workspace?.accounts?.find((item: any) => item.id === existing?.affiliateAccountId) || workspace?.accounts?.[0];
    setContentForm({
      affiliateAccountId: account?.id || "",
      platform: existing?.platform || account?.platform || "TIKTOK",
      videoUrl: existing?.videoUrl || "",
      publishedAt: localDateTime(existing?.publishedAt),
      caption: existing?.caption || "",
      hook: existing?.hook || "",
      productName: existing?.productName || "",
      productExternalId: existing?.productExternalId || "",
      productUrl: existing?.productUrl || "",
      campaignName: existing?.campaignName || "",
      evidenceUrl: existing?.evidenceUrl || "",
      insightsEvidenceUrl: existing?.insightsEvidenceUrl || "",
      studentNote: existing?.studentNote || "",
      disclosureAccepted: Boolean(existing?.disclosureAccepted),
      ownershipDeclared: Boolean(existing?.ownershipDeclared),
    });
  }, [selectedAssignment, workspace?.accounts]);

  const canEditSelected = !selectedAssignment?.submissions?.[0] || ["DRAFT", "REVISION_REQUIRED"].includes(selectedAssignment.submissions[0].status);

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await csrfFetch("/api/backend/affiliate/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(accountForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Akun belum dapat disimpan");
      setMessage("Akun affiliate tersimpan dan masuk antrean verifikasi.");
      setAccountForm({ ...emptyAccount }); setShowAccountForm(false);
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Akun belum dapat disimpan"); }
    finally { setBusy(false); }
  };

  const handleSaveContent = async (submitForReview: boolean) => {
    if (!selectedAssignment) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await csrfFetch("/api/backend/affiliate/content", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...contentForm, assignmentId: selectedAssignment.id, publishedAt: new Date(contentForm.publishedAt).toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Konten belum dapat disimpan");
      if (submitForReview) {
        const finalResponse = await csrfFetch(`/api/backend/submissions/${data.submission.id}/submit`, { method: "POST" });
        const finalData = await finalResponse.json();
        if (!finalResponse.ok) throw new Error(finalData.message || "Konten tersimpan sebagai draf, tetapi belum dapat dikirim");
      }
      setMessage(submitForReview ? "Konten berhasil dikirim untuk review guru." : "Draf konten dan versinya berhasil disimpan.");
      setSelectedAssignment(null);
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Konten belum dapat diproses"); }
    finally { setBusy(false); }
  };

  const handleSaveMetric = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!metricVideo) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = {
        views: Number(metricForm.views || 0), likes: Number(metricForm.likes || 0), comments: Number(metricForm.comments || 0), shares: Number(metricForm.shares || 0),
        clicks: Number(metricForm.clicks || 0), orders: Number(metricForm.orders || 0), unitsSold: Number(metricForm.unitsSold || 0), refunds: Number(metricForm.refunds || 0),
        gmv: Number(metricForm.gmv || 0), commission: Number(metricForm.commission || 0), snapshotDate: new Date(metricForm.snapshotDate).toISOString(), evidenceUrl: metricForm.evidenceUrl || undefined, supersedesId: metricForm.supersedesId || undefined,
      };
      const response = await csrfFetch(`/api/backend/affiliate/videos/${metricVideo.id}/snapshots`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Metrik belum dapat disimpan");
      setMessage(data.verification === "NEEDS_REVIEW" ? "Snapshot tersimpan dan ditandai untuk pemeriksaan guru; data asli tetap aman." : "Snapshot baru tersimpan tanpa menimpa riwayat lama.");
      setMetricVideo(null); setMetricForm({ ...emptyMetric, snapshotDate: localDateTime() });
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Metrik belum dapat disimpan"); }
    finally { setBusy(false); }
  };

  const openMetricForm = (video: any, correction?: any) => {
    setMetricVideo(video);
    setMetricForm(correction ? {
      views: String(correction.views), likes: String(correction.likes), comments: String(correction.comments), shares: String(correction.shares),
      clicks: String(correction.clicks), orders: String(correction.orders), unitsSold: String(correction.unitsSold), refunds: String(correction.refunds),
      gmv: String(correction.gmv), commission: String(correction.commission), snapshotDate: localDateTime(correction.snapshotDate), evidenceUrl: correction.evidenceUrl || "", supersedesId: correction.id,
    } : { ...emptyMetric, snapshotDate: localDateTime() });
  };

  const kpis = [
    ["Konten", performance.totalVideos || 0, FileVideo2], ["Tayangan", Number(performance.totalViews || 0).toLocaleString("id-ID"), BarChart3],
    ["CTR", `${Number(performance.ctr || 0).toFixed(2)}%`, Link2], ["Pesanan", Number(performance.totalOrders || 0).toLocaleString("id-ID"), CheckCircle2],
    ["GMV", money(performance.totalGmv || 0), BarChart3], ["Komisi", money(performance.totalCommission || 0), CheckCircle2],
  ];

  if (loading) return <main className="min-h-screen bg-[#FFFFFF] p-6 sm:p-8"><p className="font-semibold text-orange-600">Memuat ruang kerja affiliate...</p></main>;

  return (
    <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600">Fase 5 · Affiliate</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Affiliate Saya</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Kelola akun publik, kirim konten, lalu catat performa sebagai snapshot historis. Sistem tidak pernah meminta password, OTP, cookie, atau token marketplace.</p></div>
          <button onClick={() => void loadWorkspace()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-orange-700"><RefreshCw size={17}/> Muat ulang</button>
        </header>

        {(error || message) && <div role="status" className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

        <p className="-mb-5 text-xs font-semibold text-slate-500">Ringkasan finansial hanya menggunakan snapshot terbaru yang sudah diverifikasi.</p>
        <section aria-labelledby="ringkasan-affiliate" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <h2 id="ringkasan-affiliate" className="sr-only">Ringkasan performa</h2>
          {kpis.map(([label, value, Icon]: any) => <article key={label} className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><Icon className="mb-3 text-orange-600" size={20}/><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-xl font-extrabold text-slate-900">{value}</p></article>)}
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-extrabold text-slate-900">Akun affiliate publik</h2><p className="mt-1 text-sm text-slate-600">Tambahkan profil publik saja. Verifikasi dilakukan guru secara terpisah.</p></div><button onClick={() => setShowAccountForm((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white"><Plus size={17}/>{showAccountForm ? "Tutup form" : "Tambah akun"}</button></div>
          {showAccountForm && <form onSubmit={handleCreateAccount} className="mt-5 grid gap-4 rounded-xl bg-orange-50/60 p-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">Platform<select value={accountForm.platform} onChange={(e) => setAccountForm({ ...accountForm, platform: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"><option value="TIKTOK">TikTok</option><option value="SHOPEE">Shopee</option><option value="INSTAGRAM">Instagram</option><option value="YOUTUBE">YouTube</option></select></label>
            <label className="text-sm font-bold text-slate-700">Username<input required value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} placeholder="contoh: andi.kreator" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"/></label>
            <label className="text-sm font-bold text-slate-700">Nama tampilan<input value={accountForm.displayName} onChange={(e) => setAccountForm({ ...accountForm, displayName: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"/></label>
            <label className="text-sm font-bold text-slate-700">URL profil publik<input required type="url" value={accountForm.profileUrl} onChange={(e) => setAccountForm({ ...accountForm, profileUrl: e.target.value })} placeholder="https://www.tiktok.com/@username" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"/></label>
            <button disabled={busy} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Menyimpan..." : "Simpan akun"}</button>
          </form>}
          <div className="mt-5 grid gap-3 md:grid-cols-2">{workspace?.accounts?.length ? workspace.accounts.map((account: any) => <article key={account.id} className="flex items-start justify-between gap-4 rounded-xl border p-4"><div><p className="text-xs font-bold uppercase text-orange-600">{platformLabels[account.platform] || account.platform}</p><p className="mt-1 font-extrabold text-slate-900">@{account.username}</p><a href={account.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-orange-700">Lihat profil <ExternalLink size={13}/></a></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${account.status === "VERIFIED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{statusLabels[account.status] || account.status}</span></article>) : <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500 md:col-span-2">Belum ada akun. Tambahkan akun sebelum mengumpulkan konten.</p>}</div>
        </section>

        <section><h2 className="text-xl font-extrabold text-slate-900">Tugas konten affiliate</h2><p className="mt-1 text-sm text-slate-600">Setiap perubahan tersimpan sebagai versi baru sehingga versi lama tetap dapat ditinjau.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{workspace?.assignments?.length ? workspace.assignments.map((assignment: any) => { const submission = assignment.submissions?.[0]; const video = submission?.affiliateVideos?.[0]; const canEdit = !submission || ["DRAFT", "REVISION_REQUIRED"].includes(submission.status); return <article key={assignment.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-orange-600">{assignment.course?.code} · berakhir {new Date(assignment.endDate).toLocaleDateString("id-ID")}</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">{assignment.title}</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{statusLabels[submission?.status || "DRAFT"]}</span></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{assignment.description}</p>{submission?.feedback && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><strong>Feedback:</strong> {submission.feedback}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setSelectedAssignment(assignment)} className="min-h-11 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white">{video ? (canEdit ? "Perbarui konten" : "Lihat konten") : "Mulai tugas"}</button>{video && <button onClick={() => openMetricForm(video)} className="min-h-11 rounded-xl border border-orange-200 px-4 text-sm font-bold text-orange-700">Tambah metrik</button>}</div>{video && <p className="mt-3 text-xs text-slate-500">Versi konten {video.currentVersion} · {video.metricSnapshots?.length || 0} snapshot tersimpan</p>}</article>; }) : <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500 lg:col-span-2">Belum ada tugas affiliate aktif.</p>}</div></section>

        <section><h2 className="text-xl font-extrabold text-slate-900">Riwayat performa</h2><div className="mt-4 space-y-4">{videos.length ? videos.map((video: any) => <article key={video.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"><div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase text-orange-600">{platformLabels[video.platform] || video.platform}</p><h3 className="mt-1 font-extrabold text-slate-900">{video.productName || "Konten affiliate"}</h3><a href={video.videoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-orange-700">Buka konten <ExternalLink size={13}/></a></div><button onClick={() => openMetricForm(video)} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Catat snapshot baru</button></div><div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-orange-50 text-xs uppercase text-slate-600"><tr>{["Waktu", "Views", "Klik", "CTR", "Pesanan", "GMV", "Komisi", "Status", "Aksi"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{video.metricSnapshots?.length ? video.metricSnapshots.map((metric: any) => <tr key={metric.id} className="border-t"><td className="px-4 py-3">{new Date(metric.snapshotDate).toLocaleString("id-ID")}</td><td className="px-4 py-3">{metric.views.toLocaleString("id-ID")}</td><td className="px-4 py-3">{metric.clicks.toLocaleString("id-ID")}</td><td className="px-4 py-3">{Number(metric.ctr).toFixed(2)}%</td><td className="px-4 py-3">{metric.orders}</td><td className="px-4 py-3">{money(metric.gmv)}</td><td className="px-4 py-3">{money(metric.commission)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${metric.verification === "VERIFIED" ? "bg-emerald-100 text-emerald-700" : metric.verification === "NEEDS_REVIEW" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabels[metric.verification]}</span></td><td className="px-4 py-3"><button onClick={() => openMetricForm(video, metric)} className="rounded-lg border px-3 py-2 text-xs font-bold text-orange-700">Koreksi</button></td></tr>) : <tr><td colSpan={9} className="p-5 text-center text-slate-500">Belum ada snapshot.</td></tr>}</tbody></table></div></article>) : <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">Riwayat akan muncul setelah konten affiliate disimpan.</p>}</div></section>
      </div>

      {selectedAssignment && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-8"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-orange-600">Form konten affiliate</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedAssignment.title}</h2></div><button aria-label="Tutup" onClick={() => setSelectedAssignment(null)} className="grid size-11 place-items-center rounded-xl hover:bg-slate-100"><X/></button></div>{!canEditSelected && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Konten telah dikirim dan terkunci sampai guru meminta revisi.</p>}<fieldset disabled={!canEditSelected || busy} className="mt-5 grid gap-4 sm:grid-cols-2 disabled:opacity-70">
        <label className="text-sm font-bold">Akun affiliate<select required value={contentForm.affiliateAccountId} onChange={(e) => { const account = workspace.accounts.find((item: any) => item.id === e.target.value); setContentForm({ ...contentForm, affiliateAccountId: e.target.value, platform: account?.platform || contentForm.platform }); }} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"><option value="">Pilih akun</option>{workspace.accounts.map((account: any) => <option key={account.id} value={account.id}>{platformLabels[account.platform]} · @{account.username}</option>)}</select></label>
        <label className="text-sm font-bold">Tanggal publikasi<input type="datetime-local" required value={contentForm.publishedAt} onChange={(e) => setContentForm({ ...contentForm, publishedAt: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold sm:col-span-2">URL konten publik<input type="url" required value={contentForm.videoUrl} onChange={(e) => setContentForm({ ...contentForm, videoUrl: e.target.value })} placeholder="https://www.tiktok.com/@akun/video/..." className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold">Nama produk<input required value={contentForm.productName} onChange={(e) => setContentForm({ ...contentForm, productName: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold">URL produk<input type="url" required value={contentForm.productUrl} onChange={(e) => setContentForm({ ...contentForm, productUrl: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold">Campaign / tag<input value={contentForm.campaignName} onChange={(e) => setContentForm({ ...contentForm, campaignName: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold">Hook pembuka<input value={contentForm.hook} onChange={(e) => setContentForm({ ...contentForm, hook: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold sm:col-span-2">Caption<textarea value={contentForm.caption} onChange={(e) => setContentForm({ ...contentForm, caption: e.target.value })} className="mt-1 min-h-24 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="text-sm font-bold">URL bukti publikasi<input type="url" required value={contentForm.evidenceUrl} onChange={(e) => setContentForm({ ...contentForm, evidenceUrl: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold">URL screenshot insight (opsional)<input type="url" value={contentForm.insightsEvidenceUrl} onChange={(e) => setContentForm({ ...contentForm, insightsEvidenceUrl: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>
        <label className="text-sm font-bold sm:col-span-2">Catatan siswa<textarea value={contentForm.studentNote} onChange={(e) => setContentForm({ ...contentForm, studentNote: e.target.value })} className="mt-1 min-h-20 w-full rounded-lg border p-3 font-normal"/></label>
        <label className="flex gap-3 rounded-xl bg-orange-50 p-4 text-sm sm:col-span-2"><input type="checkbox" required checked={contentForm.ownershipDeclared} onChange={(e) => setContentForm({ ...contentForm, ownershipDeclared: e.target.checked })} className="mt-1 size-4"/><span><strong>Saya menyatakan akun dan konten ini milik saya.</strong><br/><span className="text-slate-600">Saya tidak membagikan password, OTP, cookie, atau token marketplace.</span></span></label>
        <label className="flex gap-3 rounded-xl bg-orange-50 p-4 text-sm sm:col-span-2"><input type="checkbox" required checked={contentForm.disclosureAccepted} onChange={(e) => setContentForm({ ...contentForm, disclosureAccepted: e.target.checked })} className="mt-1 size-4"/><span><strong>Saya mengikuti ketentuan platform dan disclosure iklan.</strong><br/><span className="text-slate-600">Konten akan diperiksa manusia sebelum dinilai.</span></span></label>
      </fieldset>{canEditSelected && <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button onClick={() => void handleSaveContent(false)} disabled={busy} className="min-h-11 rounded-xl border px-5 text-sm font-bold">Simpan draf</button><button onClick={() => void handleSaveContent(true)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white"><Send size={17}/>{busy ? "Memproses..." : "Kirim untuk review"}</button></div>}{selectedExistingVideo?.versions?.length > 1 && <p className="mt-4 text-xs text-slate-500">{selectedExistingVideo.versions.length} versi konten tersimpan.</p>}</div></div>}

      {metricVideo && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-8"><form onSubmit={handleSaveMetric} className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-orange-600">Snapshot historis</p><h2 className="mt-1 text-xl font-extrabold">Catat performa baru</h2><p className="mt-1 text-sm text-slate-600">{metricVideo.productName || metricVideo.videoUrl}</p></div><button type="button" aria-label="Tutup" onClick={() => setMetricVideo(null)} className="grid size-11 place-items-center rounded-xl hover:bg-slate-100"><X/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{[["views","Views"],["clicks","Klik"],["orders","Pesanan"],["unitsSold","Unit terjual"],["likes","Likes"],["comments","Komentar"],["shares","Dibagikan"],["refunds","Refund / batal"],["gmv","GMV (Rp)"],["commission","Komisi (Rp)"]].map(([key,label]) => <label key={key} className="text-sm font-bold">{label}<input type="number" min="0" step={key === "gmv" || key === "commission" ? "0.01" : "1"} required={["views","clicks","orders","unitsSold","gmv","commission"].includes(key)} value={(metricForm as any)[key]} onChange={(e) => setMetricForm({ ...metricForm, [key]: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label>)}<label className="text-sm font-bold">Waktu pengambilan<input type="datetime-local" required value={metricForm.snapshotDate} onChange={(e) => setMetricForm({ ...metricForm, snapshotDate: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label><label className="text-sm font-bold">URL bukti insight<input type="url" value={metricForm.evidenceUrl} onChange={(e) => setMetricForm({ ...metricForm, evidenceUrl: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"/></label></div><div className="mt-5 flex gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800"><ShieldCheck className="shrink-0" size={20}/><p>CTR, conversion rate, nilai pesanan rata-rata, dan rate komisi dihitung otomatis. Angka lama tidak ditimpa dan flag hanya mengirim data ke pemeriksaan manusia.</p></div><button disabled={busy} className="mt-5 min-h-11 w-full rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan snapshot"}</button></form></div>}
    </main>
  );
}
