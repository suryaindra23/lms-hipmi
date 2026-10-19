"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Scale, ShieldCheck } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type ConsentDocument = { id: string; type: string; version: string; title: string; content: string; effectiveAt: string };
type Consent = { id: string; type: string; status: string; grantedAt: string; withdrawnAt?: string | null; mayWithdraw: boolean; document: { title: string; version: string }; student?: { id: string; fullName: string } | null };
type DataRequest = { id: string; type: string; status: string; details?: string | null; resolution?: string | null; dueAt?: string | null; createdAt: string };
type ManagedRequest = DataRequest & { requester: { firstName: string; lastName: string; email: string }; student?: { fullName: string; studentNumber: string } | null };
type Subject = { id: string; fullName: string; studentNumber: string };

export default function PrivacyPage() {
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [managedRequests, setManagedRequests] = useState<ManagedRequest[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isParent, setIsParent] = useState(false);
  const [canManagePrivacy, setCanManagePrivacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [subjectByDocument, setSubjectByDocument] = useState<Record<string, string>>({});
  const [resolutionByRequest, setResolutionByRequest] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const sessionResponse = await fetch("/api/session", { cache: "no-store" });
      if (!sessionResponse.ok) throw new Error("Sesi pengguna tidak tersedia");
      const sessionData = await sessionResponse.json();
      const mayManage = Array.isArray(sessionData.roles) && sessionData.roles.includes("super-admin") || sessionData.permissions?.some((permission: { resource?: string; action?: string }) => permission.resource === "privacy" && permission.action === "manage");
      const responses = await Promise.all([
        fetch("/api/backend/privacy/consent-documents", { cache: "no-store" }),
        fetch("/api/backend/privacy/consents/me", { cache: "no-store" }),
        fetch("/api/backend/privacy/data-requests/me", { cache: "no-store" }),
        fetch("/api/backend/privacy/subjects", { cache: "no-store" }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("Data privasi belum dapat dimuat");
      const [documentData, consentData, requestData, subjectData] = await Promise.all(responses.map((response) => response.json()));
      setDocuments(documentData);
      setConsents(consentData);
      setRequests(requestData);
      setSubjects(subjectData);
      setIsParent(Array.isArray(sessionData.roles) && sessionData.roles.includes("parent"));
      setCanManagePrivacy(Boolean(mayManage));
      if (mayManage) {
        const managedResponse = await fetch("/api/backend/privacy/data-requests", { cache: "no-store" });
        if (!managedResponse.ok) throw new Error("Antrean hak data belum dapat dimuat");
        setManagedRequests(await managedResponse.json());
      } else {
        setManagedRequests([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data privasi belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function grant(document: ConsentDocument, studentId?: string) {
    setBusy(document.id);
    setError("");
    const response = await csrfFetch("/api/backend/privacy/consents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId: document.id, type: document.type, studentId: studentId || undefined, method: "AUTHENTICATED_CHECKBOX" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.message || "Persetujuan belum dapat dicatat");
    else { setMessage("Persetujuan dan versinya berhasil dicatat."); await load(); }
    setBusy("");
  }

  async function withdraw(id: string) {
    setBusy(id);
    const response = await csrfFetch(`/api/backend/privacy/consents/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Ditarik oleh pengguna melalui dashboard" }),
    });
    if (!response.ok) setError("Persetujuan belum dapat ditarik");
    else { setMessage("Persetujuan telah ditarik tanpa menghapus riwayat audit."); await load(); }
    setBusy("");
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("request");
    const response = await csrfFetch("/api/backend/privacy/data-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: form.get("type"), studentId: form.get("studentId") || undefined, details: form.get("details") || undefined }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.message || "Permintaan belum dapat dibuat");
    else { setMessage("Permintaan hak data berhasil dicatat dan memiliki tenggat penanganan."); formElement.reset(); await load(); }
    setBusy("");
  }

  async function updateManagedRequest(id: string, status: string) {
    setBusy(id);
    setError("");
    const response = await csrfFetch(`/api/backend/privacy/data-requests/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, resolution: ["REJECTED", "COMPLETED"].includes(status) ? resolutionByRequest[id] : undefined }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.message || "Status permintaan belum dapat diperbarui");
    else { setMessage(`Permintaan diperbarui menjadi ${status}.`); await load(); }
    setBusy("");
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-orange-600"><Loader2 className="animate-spin" size={18} /> Memuat pusat privasi...</div>;

  return <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8"><div className="mx-auto max-w-5xl">
    <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Privacy by design</p>
    <h2 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-900"><Scale className="text-orange-600" /> Privasi & Persetujuan</h2>
    <p className="mt-2 text-sm text-slate-600">Lihat versi persetujuan, tarik pilihan opsional, atau ajukan akses, koreksi, pembatasan, export, dan penghapusan sesuai kebijakan retensi.</p>
    {error && <p role="alert" className="mt-5 flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</p>}
    {message && <p role="status" className="mt-5 flex gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} />{message}</p>}

    <section className="mt-7"><h3 className="text-lg font-bold text-slate-900">Dokumen persetujuan aktif</h3><div className="mt-3 grid gap-4 md:grid-cols-2">{documents.map((document) => {
      const subjectId = subjectByDocument[document.id] || subjects[0]?.id;
      const active = consents.find((consent) => consent.type === document.type && consent.status === "ACTIVE" && (subjectId ? consent.student?.id === subjectId : !consent.student));
      return <article key={document.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-orange-600">{document.type} · v{document.version}</p><h4 className="mt-1 font-bold text-slate-900">{document.title}</h4></div><ShieldCheck className="text-emerald-600" size={20} /></div><p className="mt-3 text-sm leading-6 text-slate-600">{document.content}</p>{isParent && subjects.length > 1 && document.type !== "IDENTITY" && <label className="mt-3 block text-xs font-bold text-slate-700">Subjek siswa<select value={subjectId} onChange={(event) => setSubjectByDocument((current) => ({ ...current, [document.id]: event.target.value }))} className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-3">{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.fullName}</option>)}</select></label>}<div className="mt-4">{active ? active.mayWithdraw ? <button type="button" disabled={busy === active.id} onClick={() => withdraw(active.id)} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50">Tarik persetujuan</button> : <p className="text-xs font-semibold text-emerald-700">Persetujuan aktif; hanya pemberi atau subjek yang dapat menariknya.</p> : document.type === "IDENTITY" ? <p className="text-xs font-semibold text-slate-500">Persetujuan ini dicatat bersama pengajuan identitas dan tidak dapat dibuat terpisah.</p> : <button type="button" disabled={busy === document.id || (document.type === "GUARDIAN" && (!subjectId || !isParent))} onClick={() => grant(document, subjectId)} className="bg-sunrise min-h-11 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50">Berikan persetujuan</button>}</div></article>;
    })}</div></section>

    <section className="mt-8 grid gap-5 lg:grid-cols-2"><form onSubmit={createRequest} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Ajukan permintaan hak data</h3><label className="mt-4 block text-sm font-bold text-slate-700">Jenis<select name="type" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="ACCESS">Akses data</option><option value="CORRECTION">Koreksi</option><option value="DELETION">Penghapusan sesuai retensi</option><option value="RESTRICTION">Pembatasan pemrosesan</option><option value="EXPORT">Export aman</option><option value="CONSENT_WITHDRAWAL">Penarikan persetujuan</option></select></label>{subjects.length > 0 && <label className="mt-3 block text-sm font-bold text-slate-700">Subjek<select name="studentId" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.fullName} ({subject.studentNumber})</option>)}</select></label>}<label className="mt-3 block text-sm font-bold text-slate-700">Keterangan<textarea name="details" maxLength={2000} className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3" /></label><button disabled={busy === "request"} className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50">Kirim permintaan</button></form>
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Riwayat permintaan</h3><div className="mt-4 space-y-3">{requests.length === 0 ? <p className="text-sm text-slate-500">Belum ada permintaan.</p> : requests.map((request) => <div key={request.id} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between gap-3"><p className="text-sm font-bold text-slate-900">{request.type}</p><span className="text-xs font-bold text-orange-700">{request.status}</span></div><p className="mt-1 text-xs text-slate-500">Dibuat {new Date(request.createdAt).toLocaleDateString("id-ID")}{request.dueAt ? ` · Tenggat ${new Date(request.dueAt).toLocaleDateString("id-ID")}` : ""}</p>{request.resolution && <p className="mt-2 text-sm text-slate-600">{request.resolution}</p>}</div>)}</div></div></section>
    {canManagePrivacy && <section className="mt-8 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Antrean penanganan hak data</h3><p className="mt-1 text-sm text-slate-600">Keputusan final memerlukan resolusi tertulis dan tidak dapat dibuka ulang.</p><div className="mt-4 space-y-4">{managedRequests.length === 0 ? <p className="text-sm text-slate-500">Tidak ada permintaan dalam antrean.</p> : managedRequests.map((request) => { const next: Record<string, string[]> = { SUBMITTED: ["IN_REVIEW", "CANCELLED"], IN_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"], APPROVED: ["COMPLETED", "CANCELLED"] }; const actions = next[request.status] || []; return <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{request.type} · {request.requester.firstName} {request.requester.lastName}</p><p className="text-xs text-slate-500">{request.student ? `${request.student.fullName} (${request.student.studentNumber})` : request.requester.email}</p></div><span className="text-xs font-bold text-orange-700">{request.status}</span></div>{request.details && <p className="mt-3 text-sm text-slate-600">{request.details}</p>}{actions.some((action) => ["REJECTED", "COMPLETED"].includes(action)) && <label className="mt-3 block text-xs font-bold text-slate-700">Resolusi<textarea value={resolutionByRequest[request.id] || ""} onChange={(event) => setResolutionByRequest((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={4000} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label>}<div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <button key={action} type="button" disabled={busy === request.id || (["REJECTED", "COMPLETED"].includes(action) && !resolutionByRequest[request.id]?.trim())} onClick={() => updateManagedRequest(request.id, action)} className="min-h-10 rounded-xl border border-orange-300 bg-white px-3 text-xs font-bold text-orange-700 disabled:opacity-50">{action}</button>)}</div></article>; })}</div></section>}
  </div></main>;
}
