"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrf";

type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  organization: { name: string } | null;
};

type AccountSession = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  mfaVerifiedAt: string | null;
  createdAt: string;
  current: boolean;
};

type Setup = { secret: string; otpauthUri: string };
type Notice = { tone: "success" | "error"; text: string } | null;

function formatDate(value: string | null) {
  if (!value) return "Belum tercatat";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function deviceName(userAgent: string | null) {
  if (!userAgent) return "Perangkat tidak dikenal";
  const browser = userAgent.includes("Edg/") ? "Microsoft Edge" : userAgent.includes("Chrome/") ? "Chrome" : userAgent.includes("Firefox/") ? "Firefox" : userAgent.includes("Safari/") ? "Safari" : "Browser";
  const device = /iPhone|Android|Mobile/i.test(userAgent) ? "Ponsel" : /iPad|Tablet/i.test(userAgent) ? "Tablet" : /Macintosh/i.test(userAgent) ? "Mac" : /Windows/i.test(userAgent) ? "Windows" : "Komputer";
  return `${browser} · ${device}`;
}

export default function SecurityPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaPassword, setMfaPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const load = useCallback(async () => {
    try {
      const [accountResponse, sessionsResponse] = await Promise.all([
        fetch("/api/backend/auth/account", { cache: "no-store" }),
        fetch("/api/backend/auth/sessions", { cache: "no-store" }),
      ]);
      if (accountResponse.status === 401) return router.replace("/login");
      const accountData = await accountResponse.json().catch(() => ({}));
      const sessionData = await sessionsResponse.json().catch(() => []);
      if (!accountResponse.ok) throw new Error(accountData.message || "Data akun belum dapat dimuat");
      if (!sessionsResponse.ok) throw new Error("Daftar perangkat belum dapat dimuat");
      setAccount(accountData);
      setFirstName(accountData.firstName || "");
      setLastName(accountData.lastName || "");
      setPhone(accountData.phone || "");
      setSessions(Array.isArray(sessionData) ? sessionData : []);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Kontrol akun belum dapat dimuat" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function api(path: string, init: RequestInit = {}) {
    const response = await csrfFetch(`/api/backend/auth/${path}`, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Permintaan belum dapat diproses");
    return data;
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setNotice(null);
    try {
      const updated = await api("account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined }),
      });
      setAccount(updated);
      setNotice({ tone: "success", text: "Informasi akun berhasil diperbarui." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Informasi akun belum dapat disimpan" });
    } finally {
      setBusy("");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== passwordConfirmation) {
      setNotice({ tone: "error", text: "Konfirmasi kata sandi baru belum sama." });
      return;
    }
    setBusy("password");
    setNotice(null);
    try {
      const result = await api("change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setNotice({ tone: "success", text: `${result.message}. ${result.revokedOtherSessions || 0} sesi lain telah dikeluarkan.` });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Kata sandi belum dapat diperbarui" });
    } finally {
      setBusy("");
    }
  }

  async function revokeSession(session: AccountSession) {
    if (!window.confirm(`Keluarkan ${deviceName(session.userAgent)} dari akun?`)) return;
    setBusy(session.id);
    setNotice(null);
    try {
      await api(`sessions/${session.id}`, { method: "DELETE" });
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setNotice({ tone: "success", text: "Perangkat berhasil dikeluarkan dari akun." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Perangkat belum dapat dikeluarkan" });
    } finally {
      setBusy("");
    }
  }

  async function logoutAll() {
    if (!window.confirm("Keluar dari seluruh perangkat, termasuk perangkat ini?")) return;
    setBusy("logout-all");
    try {
      await api("logout-all", { method: "POST" });
    } finally {
      await csrfFetch("/api/session", { method: "DELETE" }).catch(() => undefined);
      router.replace("/login");
      router.refresh();
    }
  }

  async function beginMfa() {
    setBusy("mfa");
    setNotice(null);
    try {
      setSetup(await api("mfa/setup", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "MFA belum dapat disiapkan" });
    } finally {
      setBusy("");
    }
  }

  async function confirmMfa() {
    setBusy("mfa");
    setNotice(null);
    try {
      await api("mfa/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: mfaCode }) });
      setSetup(null);
      setMfaCode("");
      setNotice({ tone: "success", text: "Verifikasi dua langkah berhasil diaktifkan." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Kode verifikasi tidak valid" });
    } finally {
      setBusy("");
    }
  }

  async function disableMfa() {
    setBusy("mfa");
    setNotice(null);
    try {
      await api("mfa/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: mfaCode, password: mfaPassword }) });
      await csrfFetch("/api/session", { method: "DELETE" }).catch(() => undefined);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "MFA belum dapat dinonaktifkan" });
      setBusy("");
    }
  }

  if (loading) {
    return <main className="grid min-h-[60vh] place-items-center"><p className="flex items-center gap-2 text-sm font-bold text-slate-500"><LoaderCircle className="animate-spin" size={18} /> Menyiapkan kontrol akun…</p></main>;
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex flex-col gap-5 border-b border-slate-900/10 pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Akun & keamanan</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-950">Kontrol akun</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Perbarui informasi pribadi, lindungi kata sandi, dan periksa perangkat yang masih terhubung.</p>
        </div>
        <div className="flex items-center gap-3 border border-slate-900/10 bg-white px-4 py-3">
          <span className="grid size-10 place-items-center rounded-full bg-orange-50 font-black text-orange-700">{account?.firstName?.charAt(0).toUpperCase() || "A"}</span>
          <div><p className="text-sm font-extrabold text-slate-950">{account ? `${account.firstName} ${account.lastName}` : "Pengguna"}</p><p className="text-xs text-slate-500">{account?.organization?.name || account?.email}</p></div>
        </div>
      </div>

      {notice && <div role={notice.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-5 border-l-2 px-4 py-3 text-sm font-semibold ${notice.tone === "error" ? "border-red-600 bg-red-50 text-red-700" : "border-emerald-600 bg-emerald-50 text-emerald-800"}`}>{notice.text}</div>}

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <section className="border border-slate-900/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-700"><UserRound size={19} /></span><div><h3 className="font-extrabold text-slate-950">Informasi akun</h3><p className="mt-1 text-sm text-slate-500">Nama dan nomor kontak yang digunakan di dalam platform.</p></div></div>
          <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nama depan"><input required minLength={2} maxLength={80} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field>
            <Field label="Nama belakang"><input required minLength={2} maxLength={80} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field>
            <Field label="Email akun"><input disabled value={account?.email || ""} className="min-h-11 w-full rounded-md border border-slate-900/15 bg-slate-50 px-3 text-sm font-normal text-slate-500" /></Field>
            <Field label="Nomor telepon"><input type="tel" maxLength={30} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Contoh: 0812 3456 7890" className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/10 pt-5 sm:col-span-2">
              <p className="text-xs text-slate-500">Bergabung {formatDate(account?.createdAt || null)}</p>
              <button disabled={busy === "profile" || firstName.trim().length < 2 || lastName.trim().length < 2} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-extrabold text-white disabled:opacity-45"><Save size={16} /> Simpan perubahan</button>
            </div>
          </form>
        </section>

        <section className="border border-slate-900/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700"><KeyRound size={19} /></span><div><h3 className="font-extrabold text-slate-950">Ubah kata sandi</h3><p className="mt-1 text-sm text-slate-500">Perangkat lain otomatis dikeluarkan setelah perubahan.</p></div></div>
          <form onSubmit={changePassword} className="mt-6 space-y-4">
            <Field label="Kata sandi saat ini"><input required minLength={8} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field>
            <Field label="Kata sandi baru"><input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field>
            <Field label="Ulangi kata sandi baru"><input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field>
            <button disabled={busy === "password" || currentPassword.length < 8 || newPassword.length < 8 || passwordConfirmation.length < 8} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-5 text-sm font-extrabold text-white disabled:opacity-45"><KeyRound size={16} /> Perbarui kata sandi</button>
          </form>
        </section>
      </div>

      <section className="mt-6 border border-slate-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><MonitorSmartphone size={19} /></span><div><h3 className="font-extrabold text-slate-950">Perangkat yang terhubung</h3><p className="mt-1 text-sm text-slate-500">Periksa dan keluarkan perangkat yang tidak Anda kenali.</p></div></div>
          <button disabled={busy === "logout-all" || sessions.length === 0} onClick={logoutAll} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-xs font-extrabold text-red-700 disabled:opacity-45"><LogOut size={15} /> Keluar dari semua perangkat</button>
        </div>
        <div className="mt-6 divide-y divide-slate-900/10 border-y border-slate-900/10">
          {sessions.length === 0 ? <p className="py-6 text-sm text-slate-500">Tidak ada sesi aktif yang tercatat.</p> : (showAllSessions ? sessions : sessions.slice(0, 5)).map((session) => {
            const mobile = /iPhone|Android|Mobile|iPad|Tablet/i.test(session.userAgent || "");
            return <div key={session.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">{mobile ? <Smartphone className="mt-0.5 shrink-0 text-slate-500" size={20} /> : <Laptop className="mt-0.5 shrink-0 text-slate-500" size={20} />}<div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-900">{deviceName(session.userAgent)}{session.current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">Perangkat ini</span>}</p><p className="mt-1 text-xs leading-5 text-slate-500">Masuk {formatDate(session.createdAt)} · IP {session.ipAddress || "tidak tersedia"} · Berakhir {formatDate(session.expiresAt)}</p></div></div>
              {!session.current && <button disabled={busy === session.id} onClick={() => void revokeSession(session)} className="min-h-9 shrink-0 rounded-md border border-slate-200 px-3 text-xs font-extrabold text-slate-700 disabled:opacity-45">Keluarkan</button>}
            </div>;
          })}
        </div>
        {sessions.length > 5 && <button onClick={() => setShowAllSessions((value) => !value)} className="mt-4 min-h-10 text-xs font-extrabold text-orange-700 hover:underline">{showAllSessions ? "Tampilkan lebih ringkas" : `Tampilkan semua ${sessions.length} perangkat`}</button>}
      </section>

      <section className="mt-6 border border-slate-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck size={19} /></span><div><h3 className="font-extrabold text-slate-950">Verifikasi dua langkah</h3><p className="mt-1 text-sm text-slate-500">Tambahkan kode autentikator untuk tindakan yang sensitif.</p></div><span className={`ml-auto rounded-full px-3 py-1 text-[11px] font-extrabold ${account?.mfaEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{account?.mfaEnabled ? "Aktif" : "Belum aktif"}</span></div>
        {!account?.mfaEnabled && !setup && <button disabled={busy === "mfa"} onClick={beginMfa} className="mt-5 min-h-11 rounded-md bg-emerald-700 px-5 text-sm font-extrabold text-white disabled:opacity-45">Aktifkan verifikasi dua langkah</button>}
        {setup && <div className="mt-5 max-w-2xl space-y-4 border-t border-slate-900/10 pt-5"><p className="text-sm leading-6 text-slate-600">Masukkan kunci berikut ke Google Authenticator, Microsoft Authenticator, atau aplikasi TOTP lain.</p><code className="block break-all bg-slate-950 p-4 text-sm text-amber-300">{setup.secret}</code><Field label="Kode 6 digit pertama"><input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" maxLength={6} /></Field><button disabled={busy === "mfa" || mfaCode.length !== 6} onClick={confirmMfa} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-extrabold text-white disabled:opacity-45"><CheckCircle2 size={16} /> Konfirmasi dan aktifkan</button></div>}
        {account?.mfaEnabled && <div className="mt-5 max-w-2xl space-y-4 border-t border-slate-900/10 pt-5"><p className="text-sm leading-6 text-slate-600">Untuk menonaktifkan verifikasi dua langkah, masukkan kata sandi dan kode autentikator saat ini. Seluruh sesi akan dikeluarkan.</p><Field label="Kata sandi"><input type="password" autoComplete="current-password" value={mfaPassword} onChange={(event) => setMfaPassword(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></Field><Field label="Kode 6 digit"><input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" maxLength={6} /></Field><button disabled={busy === "mfa" || mfaPassword.length < 8 || mfaCode.length !== 6} onClick={disableMfa} className="min-h-11 rounded-md border border-red-200 px-5 text-sm font-extrabold text-red-700 disabled:opacity-45">Nonaktifkan verifikasi dua langkah</button></div>}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-extrabold text-slate-700">{label}<span className="mt-2 block">{children}</span></label>;
}
