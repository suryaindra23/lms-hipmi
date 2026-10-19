"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { csrfFetch } from "@/lib/csrf";
import AccountPageFrame from "@/components/AccountPageFrame";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await csrfFetch("/api/backend/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || "Jika akun tersedia, petunjuk reset akan dikirim.");
    setLoading(false);
  }

  return (
    <AccountPageFrame eyebrow="Pemulihan akun" title="Kembali ke ruang belajar." description="Atur ulang akses akun dengan aman agar Anda dapat melanjutkan kegiatan belajar dan mengajar.">
        <h2 className="text-3xl font-extrabold text-slate-950">Lupa kata sandi</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">Masukkan email akun. Pesan yang sama akan ditampilkan meskipun email tidak terdaftar.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-bold text-slate-700" htmlFor="email">Alamat email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 focus:border-orange-500 focus:outline-none" />
          <button disabled={loading} className="bg-sunrise min-h-12 w-full rounded-full font-extrabold text-white disabled:opacity-60">{loading ? "Memproses..." : "Kirim petunjuk reset"}</button>
        </form>
        {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
        <Link href="/login" className="mt-6 inline-flex text-sm font-bold text-orange-700 hover:underline">Kembali ke login</Link>
    </AccountPageFrame>
  );
}
