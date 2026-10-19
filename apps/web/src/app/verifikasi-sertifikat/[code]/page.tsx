"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, CircleX, Loader2 } from "lucide-react";

type Result = { valid: boolean; status: string; verificationCode?: string; title?: string; school?: string; issuedAt?: string; studentName?: string; city?: string };

export default function CertificateVerificationPage() {
  const { code } = useParams<{ code: string }>();
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => { fetch(`/api/backend/public/certificates/${encodeURIComponent(code)}`).then((response) => response.json()).then(setResult).catch(() => setResult({ valid: false, status: "ERROR" })); }, [code]);
  if (!result) return <div className="flex min-h-screen items-center justify-center gap-2 text-orange-600"><Loader2 className="animate-spin" size={18} /> Memeriksa sertifikat...</div>;
  return <main className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6"><article className="w-full max-w-xl rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">{result.valid ? <BadgeCheck className="mx-auto text-emerald-600" size={52} /> : <CircleX className="mx-auto text-red-600" size={52} />}<p className="mt-4 text-sm font-bold uppercase tracking-widest text-orange-600">Verifikasi publik</p><h1 className="mt-2 text-2xl font-extrabold text-slate-900">{result.valid ? "Sertifikat valid" : "Sertifikat tidak valid"}</h1>{result.valid && <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left text-sm leading-7 text-slate-600"><p><strong className="text-slate-900">Judul:</strong> {result.title}</p>{result.studentName && <p><strong className="text-slate-900">Penerima:</strong> {result.studentName}</p>}<p><strong className="text-slate-900">Sekolah:</strong> {result.school}{result.city ? `, ${result.city}` : ""}</p><p><strong className="text-slate-900">Terbit:</strong> {result.issuedAt ? new Date(result.issuedAt).toLocaleDateString("id-ID") : "-"}</p><p><strong className="text-slate-900">Kode:</strong> {result.verificationCode}</p></div>}<p className="mt-5 text-xs leading-5 text-slate-500">Identitas penerima hanya ditampilkan bila pemilik memiliki persetujuan publikasi aktif.</p><Link href="/" className="mt-6 inline-block text-sm font-bold text-orange-700">Kembali ke beranda</Link></article></main>;
}
