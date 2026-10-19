"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Award,
  Bell,
  Check,
  Download,
  HelpCircle,
  Loader2,
  Megaphone,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};
type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt?: string | null;
};
type Certificate = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  verificationCode: string;
  publicVisible: boolean;
  issuedAt?: string | null;
  student: { fullName: string; studentNumber?: string };
  template?: { name: string };
};
type Achievement = {
  id: string;
  awardedAt: string;
  achievement: { title: string; description: string; icon: string };
  student: { fullName: string };
};
type Portfolio = {
  id: string;
  title: string;
  description?: string | null;
  sourceType: string;
  status: string;
  publicSlug?: string | null;
  student: { fullName: string };
};
type Ticket = {
  id: string;
  ticketNumber: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  updatedAt: string;
  _count: { messages: number };
};
type TicketDetail = Ticket & {
  description: string;
  resolution?: string | null;
  messages: Array<{ id: string; body: string; isInternal: boolean; createdAt: string; fileName?: string | null; mimeType?: string | null; scanStatus?: string | null; author: { firstName: string; lastName: string } }>;
};
type Preference = {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  digestFrequency: string;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      (data as { message?: string }).message ||
        "Permintaan belum dapat diproses",
    );
  return data as T;
}

export default function SupportingPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [hasAdvanced, setHasAdvanced] = useState(false);
  const [preference, setPreference] = useState<Preference>({
    emailEnabled: false,
    whatsappEnabled: false,
    smsEnabled: false,
    digestFrequency: "IMMEDIATE",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const results = await Promise.allSettled([
      fetch("/api/backend/support/notifications").then(readJson<Notification[]>),
      fetch("/api/backend/support/announcements").then(readJson<Announcement[]>),
      fetch("/api/backend/support/certificates").then(readJson<Certificate[]>),
      fetch("/api/backend/support/achievements").then(readJson<Achievement[]>),
      fetch("/api/backend/support/portfolio").then(readJson<Portfolio[]>),
      fetch("/api/backend/support/helpdesk").then(readJson<Ticket[]>),
      fetch("/api/backend/support/notification-preferences").then(readJson<Preference>),
      fetch("/api/session").then(readJson<{ roles?: string[] }>),
      fetch("/api/backend/access/effective").then(readJson<{ entitlements?: Record<string, unknown> }>),
    ]);

    const [notificationsResult, announcementsResult, certificatesResult, achievementsResult, portfolioResult, ticketsResult, preferenceResult, sessionResult, accessResult] = results;
    if (notificationsResult.status === "fulfilled") setNotifications(notificationsResult.value);
    if (announcementsResult.status === "fulfilled") setAnnouncements(announcementsResult.value);
    if (certificatesResult.status === "fulfilled") setCertificates(certificatesResult.value);
    if (achievementsResult.status === "fulfilled") setAchievements(achievementsResult.value);
    if (portfolioResult.status === "fulfilled") setPortfolio(portfolioResult.value);
    if (ticketsResult.status === "fulfilled") setTickets(ticketsResult.value);
    if (preferenceResult.status === "fulfilled") setPreference(preferenceResult.value);
    if (sessionResult.status === "fulfilled") {
      setIsStaff((sessionResult.value.roles || []).some((role) => ["super-admin", "school-admin", "program-manager", "principal", "support"].includes(role)));
    }
    const advancedEnabled = accessResult.status === "fulfilled" && accessResult.value.entitlements?.["support.advanced.use"] === true;
    setHasAdvanced(advancedEnabled);
    if ([notificationsResult, announcementsResult, ticketsResult, preferenceResult, sessionResult, accessResult].some((result) => result.status === "rejected") || (advancedEnabled && [certificatesResult, achievementsResult, portfolioResult].some((result) => result.status === "rejected"))) {
      setError("Sebagian informasi belum dapat dimuat. Daftar yang tersedia tetap ditampilkan.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function savePreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("preference");
    setError("");
    try {
      const response = await csrfFetch(
        "/api/backend/support/notification-preferences",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(preference),
        },
      );
      setPreference(await readJson<Preference>(response));
      setMessage(
        "Preferensi notifikasi tersimpan. Notifikasi dalam aplikasi tetap aktif untuk pesan penting.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Preferensi belum tersimpan",
      );
    }
    setBusy("");
  }

  async function markRead(id: string) {
    await csrfFetch(`/api/backend/support/notifications/${id}/read`, {
      method: "PATCH",
    });
    setNotifications((items) =>
      items.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
  }

  async function downloadCertificate(id: string) {
    setBusy(id);
    setError("");
    try {
      const result = await readJson<{ url: string }>(
        await fetch(`/api/backend/support/certificates/${id}/download`),
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sertifikat belum dapat diunduh",
      );
    }
    setBusy("");
  }

  async function togglePublication(
    kind: "certificates" | "portfolio",
    item: Certificate | Portfolio,
  ) {
    setBusy(item.id);
    setError("");
    const visible =
      kind === "certificates"
        ? !(item as Certificate).publicVisible
        : (item as Portfolio).status !== "PUBLISHED";
    try {
      await readJson(
        await csrfFetch(`/api/backend/support/${kind}/${item.id}/publication`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ publicVisible: visible }),
        }),
      );
      setMessage(
        visible
          ? "Karya berhasil dipublikasikan dengan persetujuan aktif."
          : "Publikasi telah dinonaktifkan.",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Pilihan publikasi belum tersimpan",
      );
    }
    setBusy("");
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("ticket");
    setError("");
    try {
      await readJson(
        await csrfFetch("/api/backend/support/helpdesk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            category: data.get("category"),
            priority: data.get("priority"),
            subject: data.get("subject"),
            description: data.get("description"),
          }),
        }),
      );
      form.reset();
      setMessage(
        "Tiket bantuan berhasil dibuat. Data sensitif otomatis disamarkan.",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Tiket belum dapat dibuat",
      );
    }
    setBusy("");
  }

  async function openTicket(id: string) {
    setBusy(id); setError("");
    try { setSelectedTicket(await readJson<TicketDetail>(await fetch(`/api/backend/support/helpdesk/${id}`))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Detail tiket belum dapat dimuat"); }
    setBusy("");
  }

  async function replyTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedTicket) return; const form = event.currentTarget; const data = new FormData(form); setBusy("reply");
    try {
      await readJson(await csrfFetch(`/api/backend/support/helpdesk/${selectedTicket.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: data.get("body"), isInternal: isStaff && data.get("isInternal") === "on" }) }));
      const file = data.get("attachment");
      if (file instanceof File && file.size > 0) {
        const metadata = { fileName: file.name, mimeType: file.type, sizeBytes: file.size };
        const upload = await readJson<{ storageKey: string; uploadUrl: string }>(await csrfFetch(`/api/backend/support/helpdesk/${selectedTicket.id}/attachments/upload-url`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(metadata) }));
        const uploaded = await fetch(upload.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
        if (!uploaded.ok) throw new Error("Lampiran belum berhasil diunggah");
        await readJson(await csrfFetch(`/api/backend/support/helpdesk/${selectedTicket.id}/attachments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...metadata, storageKey: upload.storageKey, isInternal: isStaff && data.get("isInternal") === "on" }) }));
      }
      form.reset(); await openTicket(selectedTicket.id); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Balasan belum dapat dikirim"); }
    setBusy("");
  }

  async function downloadHelpdeskAttachment(messageId: string) {
    setBusy(messageId);
    try {
      const result = await readJson<{ url: string }>(await fetch(`/api/backend/support/helpdesk/messages/${messageId}/attachment`));
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Lampiran belum dapat diunduh"); }
    setBusy("");
  }

  async function resolveTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedTicket) return; const data = new FormData(event.currentTarget); setBusy("resolve");
    try {
      await readJson(await csrfFetch(`/api/backend/support/helpdesk/${selectedTicket.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: data.get("status"), resolution: data.get("resolution") || undefined }) }));
      await openTicket(selectedTicket.id); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Status tiket belum dapat diperbarui"); }
    setBusy("");
  }

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-orange-600">
        <Loader2 className="animate-spin" size={18} /> Memuat pusat dukungan...
      </div>
    );

  return (
    <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
          Fase 7 · Pengalaman pendukung
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
          Pusat Dukungan & Pencapaian
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Notifikasi, pengumuman, sertifikat, karya, dan bantuan dalam satu
          tempat yang aman.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
          >
            {message}
          </p>
        )}

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Bell size={19} className="text-orange-600" /> Notifikasi
              </h3>
              <button
                onClick={async () => {
                  await csrfFetch(
                    "/api/backend/support/notifications/read-all",
                    { method: "POST" },
                  );
                  await load();
                }}
                className="text-xs font-bold text-orange-700"
              >
                Tandai semua dibaca
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-3 overflow-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada notifikasi.</p>
              ) : (
                notifications.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl p-4 ${item.readAt ? "bg-slate-50" : "bg-orange-50"}`}
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.body}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                      {!item.readAt && (
                        <button
                          aria-label="Tandai dibaca"
                          onClick={() => markRead(item.id)}
                          className="h-10 w-10 shrink-0 rounded-full bg-white text-emerald-700"
                        >
                          <Check className="mx-auto" size={17} />
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <form
            onSubmit={savePreference}
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <Settings2 size={19} className="text-orange-600" /> Preferensi
              notifikasi
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              Kanal eksternal hanya mengirim bila penyedia resmi dikonfigurasi.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["emailEnabled", "Email"],
                  ["whatsappEnabled", "WhatsApp"],
                  ["smsEnabled", "SMS"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={preference[key]}
                    onChange={(event) =>
                      setPreference({
                        ...preference,
                        [key]: event.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Ringkasan
              <select
                className="form-control mt-1"
                value={preference.digestFrequency}
                onChange={(event) =>
                  setPreference({
                    ...preference,
                    digestFrequency: event.target.value,
                  })
                }
              >
                <option value="IMMEDIATE">Langsung</option>
                <option value="DAILY">Harian</option>
                <option value="WEEKLY">Mingguan</option>
              </select>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-slate-700">
                Jam tenang mulai
                <input
                  type="time"
                  className="form-control mt-1"
                  value={preference.quietHoursStart || ""}
                  onChange={(event) =>
                    setPreference({
                      ...preference,
                      quietHoursStart: event.target.value || null,
                    })
                  }
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Selesai
                <input
                  type="time"
                  className="form-control mt-1"
                  value={preference.quietHoursEnd || ""}
                  onChange={(event) =>
                    setPreference({
                      ...preference,
                      quietHoursEnd: event.target.value || null,
                    })
                  }
                />
              </label>
            </div>
            <button
              disabled={busy === "preference"}
              className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Simpan preferensi
            </button>
          </form>
        </div>

        <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Megaphone size={19} className="text-orange-600" /> Pengumuman
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada pengumuman aktif.
              </p>
            ) : (
              announcements.map((item) => (
                <article key={item.id} className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs font-bold text-orange-700">
                    {item.audience}
                  </p>
                  <h4 className="mt-1 font-bold text-slate-900">
                    {item.title}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.body}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        {!hasAdvanced && <section className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Paket Advanced</p><h3 className="mt-1 font-bold text-slate-900">Sertifikat, pencapaian, dan portofolio</h3><p className="mt-1 text-sm text-slate-600">Fitur publikasi karya dan penerbitan sertifikat tersedia setelah akses Advanced aktif.</p><Link href="/paket" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-orange-600 px-4 text-sm font-bold text-white">Lihat paket</Link></section>}

        {hasAdvanced && <><div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <ShieldCheck size={19} className="text-orange-600" /> Sertifikat
            </h3>
            <div className="mt-4 space-y-3">
              {certificates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">Belum ada sertifikat yang diterbitkan.</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Sertifikat akan muncul setelah admin menerbitkannya dan proses pembuatan PDF selesai.</p>
                </div>
              ) : (
                certificates.map((item) => (
                  <article key={item.id} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.student.fullName}
                          {item.student.studentNumber ? ` · ${item.student.studentNumber}` : ""}
                        </p>
                        {item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">{item.template?.name || "Sertifikat sekolah"}</span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{item.status === "ISSUED" ? "Sudah terbit" : item.status === "QUEUED" ? "Sedang dibuat" : item.status}</span>
                          {item.issuedAt && <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">Terbit {new Date(item.issuedAt).toLocaleDateString("id-ID")}</span>}
                        </div>
                        <p className="mt-3 text-xs font-mono text-slate-500">Kode: {item.verificationCode}</p>
                      </div>
                      <div className="flex gap-2">
                        {item.status === "ISSUED" && (
                          <button
                            onClick={() => downloadCertificate(item.id)}
                            className="min-h-10 rounded-lg border px-3 text-xs font-bold text-slate-700"
                          >
                            <Download size={15} className="inline" /> Unduh
                          </button>
                        )}
                        <button
                          disabled={
                            busy === item.id || item.status !== "ISSUED"
                          }
                          onClick={() =>
                            togglePublication("certificates", item)
                          }
                          className="min-h-10 rounded-lg border px-3 text-xs font-bold text-orange-700 disabled:opacity-40"
                        >
                          {item.publicVisible
                            ? "Jadikan privat"
                            : "Publikasikan"}
                        </button>
                      </div>
                    </div>
                    {item.publicVisible && (
                      <a
                        className="mt-3 block text-xs font-bold text-orange-700 underline"
                        href={`/verifikasi-sertifikat/${item.verificationCode}`}
                        target="_blank"
                      >
                        Buka halaman verifikasi
                      </a>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <Award size={19} className="text-orange-600" /> Pencapaian
            </h3>
            <div className="mt-4 space-y-3">
              {achievements.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada pencapaian.</p>
              ) : (
                achievements.map((item) => (
                  <article key={item.id} className="rounded-xl bg-amber-50 p-4">
                    <p className="font-bold text-slate-900">
                      🏆 {item.achievement.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.achievement.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.student.fullName} ·{" "}
                      {new Date(item.awardedAt).toLocaleDateString("id-ID")}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">
            Portofolio karya yang disetujui
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Karya publik hanya tampil saat persetujuan publikasi aktif.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {portfolio.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada karya dalam portofolio.
              </p>
            ) : (
              portfolio.map((item) => (
                <article key={item.id} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-orange-700">
                    {item.sourceType}
                  </p>
                  <p className="mt-1 font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.description}
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      disabled={busy === item.id}
                      onClick={() => togglePublication("portfolio", item)}
                      className="text-xs font-bold text-orange-700"
                    >
                      {item.status === "PUBLISHED"
                        ? "Jadikan privat"
                        : "Publikasikan"}
                    </button>
                    {item.publicSlug && (
                      <a
                        href={`/portofolio/${item.publicSlug}`}
                        target="_blank"
                        className="text-xs font-bold text-slate-600 underline"
                      >
                        Lihat publik
                      </a>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section></>}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <form
            onSubmit={createTicket}
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <HelpCircle size={19} className="text-orange-600" /> Buat tiket
              bantuan
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-slate-700">
                Kategori
                <select name="category" className="form-control mt-1">
                  <option>Akun & akses</option>
                  <option>Materi & tugas</option>
                  <option>Student Store</option>
                  <option>Privasi</option>
                  <option>Lainnya</option>
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                Prioritas
                <select name="priority" className="form-control mt-1">
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="URGENT">Mendesak</option>
                  <option value="LOW">Rendah</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm font-bold text-slate-700">
              Subjek
              <input
                name="subject"
                minLength={5}
                required
                className="form-control mt-1"
              />
            </label>
            <label className="mt-3 block text-sm font-bold text-slate-700">
              Keterangan
              <textarea
                name="description"
                minLength={10}
                maxLength={5000}
                required
                className="form-control mt-1 min-h-28"
                placeholder="Jangan menuliskan kata sandi atau nomor identitas lengkap."
              />
            </label>
            <button
              disabled={busy === "ticket"}
              className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Kirim tiket
            </button>
          </form>
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Riwayat tiket</h3>
            <div className="mt-4 space-y-3">
              {tickets.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada tiket.</p>
              ) : (
                tickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    className="rounded-xl bg-slate-50 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-orange-700">
                          {ticket.ticketNumber} · {ticket.category}
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {ticket.subject}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ticket._count.messages} pesan · diperbarui{" "}
                          {new Date(ticket.updatedAt).toLocaleString("id-ID")}
                        </p>
                        <button type="button" disabled={busy === ticket.id} onClick={() => openTicket(ticket.id)} className="mt-3 text-xs font-bold text-orange-700">Buka percakapan</button>
                      </div>
                      <span className="h-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                        {ticket.status}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
        {selectedTicket && <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-orange-700">{selectedTicket.ticketNumber} · {selectedTicket.category}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{selectedTicket.subject}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{selectedTicket.description}</p></div><button type="button" onClick={() => setSelectedTicket(null)} className="min-h-10 rounded-lg border px-3 text-xs font-bold">Tutup</button></div><div className="mt-5 space-y-3">{selectedTicket.messages.length === 0 ? <p className="text-sm text-slate-500">Belum ada balasan.</p> : selectedTicket.messages.map((item) => <article key={item.id} className={`rounded-xl p-4 ${item.isInternal ? "bg-amber-50" : "bg-slate-50"}`}><div className="flex justify-between gap-3 text-xs"><strong>{item.author.firstName} {item.author.lastName}</strong><span className="text-slate-400">{new Date(item.createdAt).toLocaleString("id-ID")}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>{item.fileName && <button type="button" disabled={item.scanStatus !== "CLEAN" || busy === item.id} onClick={() => void downloadHelpdeskAttachment(item.id)} className="mt-3 min-h-10 rounded-lg border bg-white px-3 text-xs font-bold text-orange-700 disabled:text-slate-400">{item.scanStatus === "CLEAN" ? `Unduh ${item.fileName}` : item.scanStatus === "INFECTED" ? "Lampiran ditolak" : "Lampiran sedang diperiksa"}</button>}{item.isInternal && <span className="mt-2 block text-xs font-bold text-amber-700">Catatan internal</span>}</article>)}</div><form onSubmit={replyTicket} className="mt-5 border-t pt-5"><label className="block text-sm font-bold text-slate-700">Balasan<textarea name="body" required minLength={2} maxLength={5000} className="form-control mt-1 min-h-24" /></label><label className="mt-3 block text-sm font-bold text-slate-700">Lampiran opsional<input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png" className="form-control mt-1" /><span className="mt-1 block text-xs font-normal text-slate-500">PDF, JPG, atau PNG maksimal 8 MB. File diperiksa sebelum dapat diunduh.</span></label>{isStaff && <label className="mt-3 flex items-center gap-2 text-sm"><input name="isInternal" type="checkbox" /> Catatan internal (tidak terlihat pemohon)</label>}<button disabled={busy === "reply"} className="bg-sunrise mt-3 min-h-11 rounded-xl px-4 text-sm font-bold text-white">Kirim balasan</button></form>{isStaff && <form onSubmit={resolveTicket} className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-[180px_1fr_auto]"><select name="status" defaultValue={selectedTicket.status} className="form-control"><option value="OPEN">Terbuka</option><option value="IN_PROGRESS">Ditangani</option><option value="WAITING_REQUESTER">Menunggu pemohon</option><option value="RESOLVED">Selesai</option><option value="CLOSED">Ditutup</option></select><input name="resolution" defaultValue={selectedTicket.resolution || ""} placeholder="Ringkasan penyelesaian" className="form-control" /><button disabled={busy === "resolve"} className="min-h-11 rounded-xl border border-orange-200 px-4 text-sm font-bold text-orange-700">Perbarui</button></form>}</section>}
      </div>
    </main>
  );
}
