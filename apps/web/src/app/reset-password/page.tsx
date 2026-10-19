"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { csrfFetch } from "@/lib/csrf";
import AccountPageFrame from "@/components/AccountPageFrame";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await csrfFetch("/api/backend/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Token tidak valid");
    else setMessage(data.message);
    setLoading(false);
  }

  return (
    <AccountPageFrame eyebrow="Keamanan akun" title="Mulai lagi dengan aman." description="Buat kata sandi baru untuk menjaga akses ke materi, karya, dan perkembangan belajar Anda.">
        <h2 className="text-3xl font-extrabold text-slate-950">Buat kata sandi baru</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">Gunakan minimal delapan karakter dan jangan memakai kata sandi akun lain.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-bold text-slate-700" htmlFor="password">Kata sandi baru</label>
          <input id="password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 focus:border-orange-500 focus:outline-none" />
          <button disabled={loading || !token} className="bg-sunrise min-h-12 w-full rounded-full font-extrabold text-white disabled:opacity-60">{loading ? "Memproses..." : "Simpan kata sandi"}</button>
        </form>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
        <Link href="/login" className="mt-6 inline-flex text-sm font-bold text-orange-700 hover:underline">Kembali ke login</Link>
    </AccountPageFrame>
  );
}
