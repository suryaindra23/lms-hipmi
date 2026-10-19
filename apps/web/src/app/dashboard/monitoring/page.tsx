"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, LoaderCircle, MessageSquareText, RefreshCw } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type WarningItem = {
  id: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  triggeredAt: string;
  actionNote: string | null;
  resolution: string | null;
  student: { id: string; fullName: string; studentNumber: string; class: { name: string } | null };
  rule: { code: string; name: string; description: string };
  assignedTo: { firstName: string; lastName: string } | null;
  actions: Array<{ id: string; fromStatus: string; toStatus: string; note: string | null; createdAt: string; actor: { firstName: string; lastName: string } }>;
};

const severityClass: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-800",
  ATTENTION: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export default function MonitoringPage() {
  const [items, setItems] = useState<WarningItem[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/backend/monitoring/early-warnings?status=${status}&periodDays=30`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Early warning belum dapat dimuat");
      setItems(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Early warning belum dapat dimuat"); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const update = async (item: WarningItem, nextStatus: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED") => {
    const note = notes[item.id]?.trim();
    if (!note) { setError("Tambahkan catatan tindakan atau alasan sebelum memperbarui status."); return; }
    setSubmittingId(item.id); setError(""); setNotice("");
    try {
      const response = await csrfFetch(`/api/backend/monitoring/early-warnings/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus, note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Tindak lanjut belum dapat disimpan");
      setNotice(`Tindak lanjut untuk ${item.student.fullName} berhasil disimpan.`);
      setNotes((current) => ({ ...current, [item.id]: "" }));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tindak lanjut belum dapat disimpan"); }
    finally { setSubmittingId(""); }
  };

  return (
    <main className="p-5 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Early warning</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Pendampingan siswa</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Sinyal berbasis aturan membantu menentukan tindak lanjut manusia. Sinyal tidak menjadi hukuman atau keputusan otomatis.</p></div>
        <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-500" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="OPEN">Terbuka</option><option value="ACKNOWLEDGED">Ditindaklanjuti</option><option value="RESOLVED">Terselesaikan</option><option value="DISMISSED">Ditutup tanpa tindakan</option></select><button onClick={() => void load()} className="min-h-11 rounded-xl border border-orange-200 p-3 text-orange-700" aria-label="Perbarui early warning"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      </header>

      {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {loading ? <div className="rounded-2xl border border-orange-100 bg-white p-8 text-sm text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Memuat sinyal…</div> : items.length === 0 ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-sm text-emerald-800"><CheckCircle2 className="mb-2 h-6 w-6" />Tidak ada sinyal dengan status ini.</div> : items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><AlertTriangle className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">{item.title}</h3><p className="mt-1 text-sm font-medium text-slate-700">{item.student.fullName} · {item.student.class?.name || "Belum ada kelas"}</p><p className="text-xs text-slate-500">{item.student.studentNumber} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(item.triggeredAt))}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${severityClass[item.severity] || "bg-slate-100"}`}>{item.severity}</span></div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{item.message}</p>
            <p className="mt-3 text-xs text-slate-500"><strong className="text-slate-700">Aturan:</strong> {item.rule.name} — {item.rule.description}</p>
            {item.actions.length > 0 && <div className="mt-4 rounded-xl border border-slate-100 p-3"><p className="flex items-center gap-2 text-xs font-bold text-slate-700"><MessageSquareText className="h-4 w-4" /> Tindak lanjut terakhir</p><p className="mt-2 text-xs leading-5 text-slate-600">{item.actions[0].note || "Tanpa catatan"}</p></div>}
            {["OPEN", "ACKNOWLEDGED"].includes(item.status) && <div className="mt-4"><label className="text-xs font-bold text-slate-700">Catatan pendampingan<textarea value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={3} placeholder="Contoh: sudah menghubungi siswa dan menjadwalkan pendampingan…" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-orange-400" /></label><div className="mt-3 flex flex-wrap gap-2">{item.status === "OPEN" && <button onClick={() => void update(item, "ACKNOWLEDGED")} disabled={submittingId === item.id} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Tandai ditindaklanjuti</button>}<button onClick={() => void update(item, "RESOLVED")} disabled={submittingId === item.id} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Selesaikan</button><button onClick={() => void update(item, "DISMISSED")} disabled={submittingId === item.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60">Tutup sinyal</button></div></div>}
          </article>
        ))}
      </section>
    </main>
  );
}
