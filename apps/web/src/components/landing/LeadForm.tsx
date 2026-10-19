"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type LeadFormInputs = {
  schoolName: string;
  educationLevel: string;
  city: string;
  province: string;
  picName: string;
  picTitle: string;
  email: string;
  phone: string;
  estimatedStudents: number;
  programOfInterest: string;
  message?: string;
  consent: boolean;
  website?: string; // Honeypot
};

export default function LeadForm() {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<LeadFormInputs>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: LeadFormInputs) => {
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await csrfFetch("/api/backend/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Gagal mengirim pendaftaran");

      setSuccess(true);
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pendaftaran belum dapat dikirim. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="border-b border-slate-900/10 bg-white py-20 sm:py-28" id="register">
      <div className="mx-auto grid max-w-[1280px] items-start gap-12 px-4 sm:px-6 md:grid-cols-5 lg:gap-20 lg:px-10">
        {/* Left Column: Info */}
        <div className="space-y-5 md:sticky md:top-28 md:col-span-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Untuk sekolah</p>
          <h2 className="text-balance text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Tidak perlu menyiapkan proposal panjang.
          </h2>
          <p className="text-sm leading-7 text-slate-600">
            Ceritakan kondisi sekolah, jumlah peserta, dan program yang ingin dijalankan. Informasi ini membantu tim kami menyiapkan percakapan yang lebih relevan.
          </p>
          <div className="border-y border-slate-900/15 py-5 text-sm leading-7 text-slate-600"><strong className="text-slate-900">Yang akan dibahas bersama:</strong><ol className="mt-3 space-y-2">{["Kesiapan sekolah dan peserta", "Alur kerja guru dan pengelola", "Ruang lingkup praktik digital"].map((item, index) => <li key={item} className="flex gap-3"><span className="text-xs font-extrabold text-orange-700">0{index + 1}</span>{item}</li>)}</ol></div>
          <p className="text-xs leading-5 text-slate-500">Mengirim formulir tidak otomatis membuat akun atau tenant sekolah.</p>
        </div>

        {/* Right Column: Form Card */}
        <div className="lead-form-panel border border-slate-900/15 bg-[#F1F8F6] p-5 sm:p-8 md:col-span-3">
          {success && (
            <div role="status" className="mb-6 p-4 bg-green-50 rounded-xl flex items-center gap-3 text-sm text-green-700">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span>Pendaftaran berhasil dikirim! Tim kami akan segera menghubungi Anda.</span>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 rounded-xl flex items-center gap-3 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Honeypot field (hidden from real users, autocomplete off) */}
            <div style={{ display: "none" }}>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                placeholder="Your website URL"
                {...register("website")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-school-name" className="block text-xs font-semibold text-[#1F2937] mb-1">Nama Sekolah</label>
                <input
                  id="lead-school-name"
                  type="text"
                  placeholder="Contoh: SMK Negeri 1 Jakarta"
                  autoComplete="organization"
                  aria-invalid={Boolean(errors.schoolName)}
                  {...register("schoolName", { required: "Nama sekolah wajib diisi" })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
                {errors.schoolName && <p className="mt-1 text-xs font-semibold text-red-600">{errors.schoolName.message}</p>}
              </div>

              <div>
                <label htmlFor="lead-education-level" className="block text-xs font-semibold text-[#1F2937] mb-1">Jenjang Pendidikan</label>
                <select
                  id="lead-education-level"
                  {...register("educationLevel", { required: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 bg-white px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                >
                  <option value="SMK">SMK / Vokasi</option>
                  <option value="SMA">SMA</option>
                  <option value="SMP">SMP</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-city" className="block text-xs font-semibold text-[#1F2937] mb-1">Kota / Kabupaten</label>
                <input
                  id="lead-city"
                  type="text"
                  placeholder="Jakarta Pusat"
                  autoComplete="address-level2"
                  {...register("city", { required: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="lead-province" className="block text-xs font-semibold text-[#1F2937] mb-1">Provinsi</label>
                <input
                  id="lead-province"
                  type="text"
                  placeholder="DKI Jakarta"
                  autoComplete="address-level1"
                  {...register("province", { required: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-pic-name" className="block text-xs font-semibold text-[#1F2937] mb-1">Nama Penanggung Jawab (PIC)</label>
                <input
                  id="lead-pic-name"
                  type="text"
                  placeholder="Ahmad Yani"
                  autoComplete="name"
                  {...register("picName", { required: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="lead-pic-title" className="block text-xs font-semibold text-[#1F2937] mb-1">Jabatan PIC</label>
                <input
                  id="lead-pic-title"
                  type="text"
                  placeholder="Kepala Sekolah / Waka Hubin"
                  {...register("picTitle", { required: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-email" className="block text-xs font-semibold text-[#1F2937] mb-1">Email Sekolah / PIC</label>
                <input
                  id="lead-email"
                  type="email"
                  placeholder="admin@sekolah.sch.id"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email", { required: "Email wajib diisi", pattern: { value: /^\S+@\S+\.\S+$/, message: "Format email belum sesuai" } })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
                {errors.email && <p className="mt-1 text-xs font-semibold text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="lead-phone" className="block text-xs font-semibold text-[#1F2937] mb-1">No. WhatsApp</label>
                <input
                  id="lead-phone"
                  type="tel"
                  placeholder="08123456789"
                  autoComplete="tel"
                  inputMode="tel"
                  {...register("phone", { required: true, minLength: 9 })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-estimated-students" className="block text-xs font-semibold text-[#1F2937] mb-1">Perkiraan Jumlah Siswa</label>
                <input
                  id="lead-estimated-students"
                  type="number"
                  placeholder="150"
                  inputMode="numeric"
                  {...register("estimatedStudents", { required: true, min: 1, valueAsNumber: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="lead-program" className="block text-xs font-semibold text-[#1F2937] mb-1">Program yang Diminati</label>
                <select
                  id="lead-program"
                  {...register("programOfInterest", { required: true })}
                  className="min-h-11 w-full rounded-xl border border-[#64748B]/30 bg-white px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                >
                  <option value="Kewirausahaan Digital">Kewirausahaan Digital</option>
                  <option value="Praktik Affiliate">Praktik Content & Affiliate</option>
                  <option value="Full Program">Semua Program</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="lead-message" className="block text-xs font-semibold text-[#1F2937] mb-1">Pesan / Harapan (Opsional)</label>
              <textarea
                id="lead-message"
                placeholder="Tulis pesan jika ada..."
                {...register("message")}
                maxLength={1000}
                className="min-h-24 w-full resize-y rounded-xl border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
              />
            </div>

            <div className="flex items-start gap-2 bg-[#FFFFFF] p-3 rounded-lg border border-[#DDEBE8] text-xs text-[#64748B]">
              <input
                id="lead-consent"
                type="checkbox"
                {...register("consent", { required: "Persetujuan diperlukan" })}
                className="mt-1 size-4"
              />
              <label htmlFor="lead-consent">
                Saya menyetujui <Link href="/kebijakan-privasi" className="font-semibold text-orange-700 hover:underline">Kebijakan Privasi</Link> dan mengizinkan pengolahan data formulir untuk verifikasi serta tindak lanjut kemitraan.
              </label>
            </div>
            {errors.consent && <p className="text-xs font-semibold text-red-600">{errors.consent.message}</p>}

            <div className="flex justify-end border-t border-slate-900/10 pt-5">
              <button
                type="submit"
                disabled={loading || success}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-orange-700 disabled:opacity-50 sm:w-auto"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {!loading && <Send className="h-4 w-4" />}
                Kirim Permintaan
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
