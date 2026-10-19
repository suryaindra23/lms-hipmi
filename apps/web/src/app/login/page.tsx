"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrf";
import BrandLogo from "@/components/BrandLogo";

const accessNotes = [
  { number: "01", title: "Murid", note: "Melanjutkan materi, tugas, dan revisi." },
  { number: "02", title: "Guru", note: "Mereview pekerjaan dan memberi arahan." },
  { number: "03", title: "Instansi", note: "Memantau program sesuai kewenangan." },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await csrfFetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, ...(otpRequired ? { otp } : {}) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = typeof data?.message === "string" ? data.message : "Email atau kata sandi belum sesuai";
        if (message.includes("Kode verifikasi")) {
          setOtpRequired(true);
          throw new Error("Masukkan kode 6 digit dari aplikasi autentikator Anda.");
        }
        throw new Error(message);
      }

      const selectedOffer = new URLSearchParams(window.location.search).get("offer");
      router.replace(selectedOffer ? `/checkout/${encodeURIComponent(selectedOffer)}` : "/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Email atau kata sandi belum sesuai");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header>
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:h-24 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Sunrise Academy — Beranda">
            <BrandLogo className="text-xl" priority />
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xs font-extrabold text-slate-600 transition hover:text-orange-700 sm:text-sm">
            <ArrowLeft aria-hidden="true" size={16} /> Kembali ke beranda
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1440px] lg:grid-cols-[.95fr_1.05fr]">
        <section className="flex flex-col justify-between px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:pr-20">
          <div>
            <p className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">
              <span className="h-px w-9 bg-orange-600" /> Area pengguna
            </p>
            <h1 className="mt-7 max-w-2xl text-[clamp(2.75rem,5.5vw,5.5rem)] font-extrabold leading-[.96] tracking-[-0.06em]">
              Kembali ke pekerjaan yang
              <span className="font-editorial block py-1 font-normal italic tracking-[-0.04em] text-orange-700">sedang berjalan.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-600">
              Satu pintu masuk untuk belajar, memberi umpan balik, dan membaca perkembangan program sekolah.
            </p>

            <div className="mt-12 max-w-xl border-t border-slate-900/10">
              {accessNotes.map((item) => (
                <div key={item.number} className="grid grid-cols-[34px_82px_1fr] gap-3 border-b border-slate-900/10 py-4 text-sm">
                  <span className="font-extrabold text-orange-700">{item.number}</span>
                  <strong>{item.title}</strong>
                  <span className="leading-6 text-slate-600">{item.note}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-12 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <ShieldCheck aria-hidden="true" size={16} className="text-orange-700" /> Akses dan data mengikuti peran pengguna.
          </p>
        </section>

        <section className="relative flex items-center bg-orange-50 px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <div className="relative mx-auto w-full max-w-[540px]">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-700">Masuk ke platform</p>
                <p className="mt-1 text-sm font-bold text-slate-700">Gunakan akun dari sekolah Anda</p>
              </div>
              <span className="text-xs font-bold text-slate-400">01 / 01</span>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-9">
              <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">Selamat datang kembali.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Masukkan detail akun untuk melanjutkan ke ruang kerja Anda.</p>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label htmlFor="login-email" className="mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-700">Alamat email</label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-700/10"
                      placeholder="nama@sekolah.sch.id"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>

                  {otpRequired && (
                    <div>
                      <label htmlFor="login-otp" className="mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-700">Kode verifikasi</label>
                      <input
                        id="login-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        minLength={6}
                        maxLength={6}
                        pattern="[0-9]{6}"
                        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 tracking-[0.35em] text-slate-950 focus:border-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-700/10"
                        placeholder="000000"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        autoFocus
                      />
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="login-password" className="text-xs font-extrabold uppercase tracking-[0.08em] text-slate-700">Kata sandi</label>
                      <Link href="/lupa-password" className="text-xs font-bold text-orange-700 hover:underline">Lupa kata sandi?</Link>
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 placeholder:text-slate-400 focus:border-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-700/10"
                        placeholder="Masukkan kata sandi"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 transition hover:text-slate-950"
                        aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-orange-600 px-5 text-sm font-extrabold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Memproses..." : otpRequired ? "Verifikasi & masuk" : "Masuk ke platform"}
                  {!loading && <ArrowRight aria-hidden="true" size={17} />}
                </button>
              </form>

              <p className="mt-7 border-t border-slate-900/10 pt-5 text-xs leading-6 text-slate-500">
                Belum memiliki akses? Hubungi admin sekolah. Untuk institusi baru, <Link href="/#register" className="font-extrabold text-orange-700 hover:underline">ceritakan kebutuhan sekolah</Link>.
              </p>
            </div>

            <p className="mt-7 text-xs leading-5 text-slate-600">Sunrise Academy tidak pernah meminta kata sandi toko atau marketplace Anda.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
