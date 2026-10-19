"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Check, X, FileText, Loader2, AlertCircle, Download } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

export default function VerifyIdentityPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canReadDocument, setCanReadDocument] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [reasons, setReasons] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState("");

  const fetchPendingDocuments = async () => {
    try {
      const sessionRes = await fetch("/api/session", { cache: "no-store" });
      if (!sessionRes.ok) {
        setAccessDenied(true);
        return;
      }

      const session = await sessionRes.json();
      const canVerify = session?.roles?.includes("super-admin") || session?.permissions?.some((permission: { resource?: string; action?: string }) => permission.resource === "identity" && permission.action === "verify");
      if (!canVerify) {
        setAccessDenied(true);
        return;
      }
      setCanReadDocument(session?.roles?.includes("super-admin") || session?.permissions?.some((permission: { resource?: string; action?: string }) => permission.resource === "identity.document" && permission.action === "read"));

      const res = await fetch("/api/backend/identity-documents/pending", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) throw new Error("Gagal mengambil antrean verifikasi");

      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gagal mengambil antrean verifikasi", err);
      setError("Antrean verifikasi belum dapat dimuat. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDocuments();
  }, []);

  const handleVerify = async (id: string, status: "VALID" | "REJECTED" | "NEEDS_CORRECTION") => {
    if (status !== "VALID" && !notes[id]?.trim()) {
      setError("Catatan wajib diisi ketika menolak atau meminta perbaikan.");
      return;
    }
    setProcessingId(id);
    setError("");
    try {
      const res = await csrfFetch(`/api/backend/identity-documents/${id}/verify`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          reasonCode: status === "VALID" ? undefined : reasons[id] || "DOCUMENT_MISMATCH",
          notes: notes[id] || "",
        }),
      });

      if (!res.ok) throw new Error("Gagal melakukan verifikasi dokumen");

      // Hapus dari list lokal
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAccess = async (id: string) => {
    setProcessingId(id);
    setError("");
    try {
      const response = await csrfFetch(`/api/backend/identity-documents/${id}/access`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Dokumen belum dapat diakses");
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dokumen belum dapat diakses");
    } finally {
      setProcessingId(null);
    }
  };

  const handleNoteChange = (id: string, value: string) => {
    setNotes(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="p-8 bg-[#FFFFFF] min-h-screen">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-2 flex items-center gap-2">
        <ShieldAlert className="text-[#377C78]" /> Antrean Verifikasi Identitas
      </h2>
      <p className="text-[#64748B] mb-8">
        Hanya verifier berwenang yang dapat membuka file melalui tautan singkat. Setiap akses dan keputusan dicatat dalam audit.
      </p>

      {accessDenied ? (
        <div className="p-6 bg-red-50 rounded-xl border border-red-200 text-red-700 max-w-3xl" role="alert">
          <h3 className="font-bold mb-1">Akses ditolak</h3>
          <p className="text-sm">Halaman ini hanya dapat dibuka oleh administrator yang berwenang.</p>
        </div>
      ) : error && (
        <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600 mb-6 max-w-3xl">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!accessDenied && (loading ? (
        <div className="text-[#377C78] font-semibold">Memuat dokumen pending...</div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {documents.length === 0 ? (
            <div className="p-8 bg-white border border-[#DDEBE8] rounded-xl text-center text-[#64748B]">
              Tidak ada dokumen yang menunggu verifikasi saat ini.
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="p-6 bg-white rounded-xl border border-[#DDEBE8] shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-[#1F2937]">{doc.student.fullName}</h3>
                    <p className="text-sm text-[#64748B]">No. Induk: {doc.student.studentNumber} | Sekolah: {doc.student.school.name}</p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-50 text-[#286864] text-xs font-semibold rounded-full border border-yellow-200">
                    {doc.documentType}
                  </span>
                </div>

                <div className="bg-[#FFFFFF] p-4 rounded-lg border border-[#DDEBE8] text-sm space-y-2">
                  {doc.student.identifiers.map((identifier: { type: string; masked: string; status: string }) => <p key={identifier.type}>{identifier.type}: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold">{identifier.masked}</span></p>)}
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 mt-2 font-semibold"><FileText size={14} /> File telah lolos pemeriksaan karantina</p>
                  {canReadDocument ? <button type="button" onClick={() => handleAccess(doc.id)} disabled={processingId === doc.id} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-orange-300 px-3 font-bold text-orange-700 disabled:opacity-50"><Download size={15} /> Buka dokumen (90 detik)</button> : <p className="mt-2 text-xs font-semibold text-slate-500">Izin verifikasi tidak otomatis memberikan izin membuka file identitas.</p>}
                </div>

                {/* Notes Input */}
                <div>
                  <label htmlFor={`verification-notes-${doc.id}`} className="block text-xs font-semibold text-[#1F2937] mb-1">Catatan Verifikasi (Opsional jika valid, wajib jika tolak/revisi)</label>
                  <input
                    id={`verification-notes-${doc.id}`}
                    type="text"
                    placeholder="Contoh: NIK tidak sesuai dengan KTP, Foto dokumen buram..."
                    className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                    value={notes[doc.id] || ""}
                    onChange={(e) => handleNoteChange(doc.id, e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor={`verification-reason-${doc.id}`} className="block text-xs font-semibold text-[#1F2937] mb-1">Kode alasan untuk tolak/perbaikan</label>
                  <select id={`verification-reason-${doc.id}`} value={reasons[doc.id] || "DOCUMENT_MISMATCH"} onChange={(event) => setReasons((current) => ({ ...current, [doc.id]: event.target.value }))} className="min-h-10 w-full rounded-lg border border-[#64748B]/30 px-3 text-sm"><option value="DOCUMENT_MISMATCH">Data tidak cocok</option><option value="FILE_UNREADABLE">Dokumen tidak terbaca</option><option value="DOCUMENT_EXPIRED">Dokumen kedaluwarsa</option><option value="OTHER">Lainnya</option></select>
                </div>

                {/* Actions Button */}
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    disabled={processingId === doc.id}
                    onClick={() => handleVerify(doc.id, "REJECTED")}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center gap-1 disabled:opacity-50"
                  >
                    <X size={14} /> Tolak Dokumen
                  </button>
                  <button
                    disabled={processingId === doc.id}
                    onClick={() => handleVerify(doc.id, "NEEDS_CORRECTION")}
                    className="px-4 py-2 border border-yellow-300 text-yellow-700 rounded-lg text-xs font-bold hover:bg-yellow-50 flex items-center gap-1 disabled:opacity-50"
                  >
                    <AlertCircle size={14} /> Minta Perbaikan
                  </button>
                  <button
                    disabled={processingId === doc.id}
                    onClick={() => handleVerify(doc.id, "VALID")}
                    className="px-4 py-2 bg-gradient-to-r from-[#FBBF24] to-[#377C78] text-white rounded-lg text-xs font-bold hover:opacity-90 flex items-center gap-1 disabled:opacity-50"
                  >
                    {processingId === doc.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Setujui Identitas
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
