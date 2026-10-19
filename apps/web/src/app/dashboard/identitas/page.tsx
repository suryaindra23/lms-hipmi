"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type IdentityFormInputs = {
  nik: string;
  nisn: string;
  documentType: "KTP" | "KIA" | "KK";
  document: FileList;
  consent: boolean;
};

type IdentityStatus = {
  document: { id: string; documentType: string; documentStatus: string; verificationStatus: string; verificationNotes?: string | null; scanStatus: string } | null;
  identifiers: Array<{ type: string; masked: string; status: string }>;
};

export default function IdentityUploadPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<IdentityFormInputs>();
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchIdentityStatus = async () => {
    try {
      const res = await fetch("/api/backend/identity-documents/me", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error("Gagal mengambil status identitas");
      setStatus(data);
    } catch {
      setError("Status identitas belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdentityStatus();
  }, []);

  const onSubmit = async (formData: IdentityFormInputs) => {
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const file = formData.document?.[0];
      if (!file) throw new Error("Pilih dokumen identitas terlebih dahulu");
      const prepare = await csrfFetch("/api/backend/identity-documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const upload = await prepare.json();
      if (!prepare.ok) throw new Error(upload.message || "Tujuan unggah belum dapat dibuat");
      const stored = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!stored.ok) throw new Error("File gagal masuk ke penyimpanan karantina");
      const res = await csrfFetch("/api/backend/identity-documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nik: formData.nik,
          nisn: formData.nisn || undefined,
          type: formData.documentType,
          storageKey: upload.storageKey,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          consent: formData.consent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal mengunggah identitas");

      setSuccess(true);
      fetchIdentityStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pengajuan identitas gagal");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#FFFFFF] min-h-screen">
        <div className="text-[#377C78] font-semibold">Memuat status identitas...</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#FFFFFF] min-h-screen max-w-2xl">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-2 flex items-center gap-2">
        <ShieldCheck className="text-[#377C78]" /> Verifikasi Identitas
      </h2>
      <p className="text-[#64748B] mb-8">
        NIK dan NISN dienkripsi, sedangkan dokumen masuk karantina dan dipindai sebelum dapat ditinjau verifier.
      </p>

      {/* Status Box */}
      {status?.document ? (
        <div className="rounded-xl border border-[#DDEBE8] bg-white p-6 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-[#1F2937] mb-3">Status Dokumen</h3>
          <div className="space-y-2">
            <p className="text-sm">Tipe Dokumen: <span className="font-semibold">{status.document.documentType}</span></p>
            <p className="text-sm">Pemindaian file: <span className="font-semibold">{status.document.scanStatus}</span></p>
            <p className="text-sm">Status Verifikasi: <span className="font-semibold text-[#377C78]">{status.document.verificationStatus}</span></p>
            {status.identifiers.map((identifier) => <p key={identifier.type} className="text-sm">{identifier.type}: <span className="font-mono font-semibold">{identifier.masked}</span></p>)}
            {status.document.verificationNotes && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">Catatan: {status.document.verificationNotes}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#FBBF24] bg-yellow-50/50 p-6 text-center mb-6">
          <AlertCircle className="mx-auto text-[#286864] mb-2" size={32} />
          <p className="font-semibold text-[#1F2937]">Dokumen Belum Dilengkapi</p>
          <p className="text-sm text-[#64748B] mt-1">Harap lengkapi formulir di bawah ini untuk proses verifikasi.</p>
        </div>
      )}

      {/* Form Upload */}
      {(!status?.document || ["REJECTED", "NEEDS_CORRECTION"].includes(status.document.documentStatus) || status.document.scanStatus === "FAILED") && (
        <div className="rounded-xl border border-[#DDEBE8] bg-white p-6 shadow-sm">
          {success && (
            <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2 text-sm text-green-600 mb-4">
              <CheckCircle size={18} />
              <span>Dokumen berhasil diajukan untuk verifikasi!</span>
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600 mb-4">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="identity-nisn" className="block text-sm font-medium text-[#1F2937] mb-1">NISN (Opsional)</label>
              <input id="identity-nisn" inputMode="numeric" maxLength={10} {...register("nisn", { pattern: /^\d{10}$/ })} className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none" placeholder="10 digit NISN" />
              {errors.nisn && <span className="text-red-500 text-xs">NISN harus berisi tepat 10 digit.</span>}
            </div>

            <div>
              <label htmlFor="identity-nik" className="block text-sm font-medium text-[#1F2937] mb-1">NIK (Nomor Induk Kependudukan)</label>
              <input
                id="identity-nik"
                type="text"
                maxLength={16}
                {...register("nik", { required: true, pattern: /^\d{16}$/ })}
                className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                placeholder="16 digit angka NIK"
              />
              {errors.nik && <span className="text-red-500 text-xs">NIK harus berisi tepat 16 digit angka.</span>}
            </div>

            <div>
              <label htmlFor="identity-document-type" className="block text-sm font-medium text-[#1F2937] mb-1">Tipe Dokumen</label>
              <select
                id="identity-document-type"
                {...register("documentType", { required: true })}
                className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
              >
                <option value="KTP">KTP (Siswa &gt;= 17 tahun)</option>
                <option value="KIA">KIA (Siswa &lt; 17 tahun)</option>
                <option value="KK">Kartu Keluarga (KK)</option>
              </select>
            </div>

            <div>
              <label htmlFor="identity-document" className="block text-sm font-medium text-[#1F2937] mb-1">Dokumen identitas</label>
              <input
                id="identity-document"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                {...register("document", { required: true })}
                className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">JPG, PNG, atau PDF; maksimal 8 MB. File tidak langsung dapat dibuka sebelum lolos pemindaian.</p>
            </div>

            <div className="flex items-start gap-2 bg-[#FFFFFF] p-3 rounded-lg border border-[#DDEBE8] text-xs text-[#64748B]">
              <input
                id="identity-consent"
                type="checkbox"
                required
                {...register("consent", { required: true })}
                className="mt-0.5"
              />
              <label htmlFor="identity-consent">
                Saya menyetujui pemrosesan terbatas NIK, NISN, dan dokumen ini untuk verifikasi kepesertaan sesuai versi persetujuan yang tercatat. Persetujuan dapat ditarik melalui permintaan hak data.
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FBBF24] to-[#377C78] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Ajukan Verifikasi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
