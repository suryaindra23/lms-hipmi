"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Award,
  FileText,
  GraduationCap,
  Loader2,
  Megaphone,
  UserRoundSearch,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type Announcement = {
  id: string;
  title: string;
  audience: string;
  status: string;
  createdAt: string;
};
type Template = { id: string; name: string; titleTemplate: string };
type Student = { id: string; fullName: string; studentNumber: string };
type Achievement = { id: string; title: string; code: string };
type Cms = {
  id: string;
  type: string;
  title: string;
  status: string;
  slug: string;
};
type Lead = {
  id: string;
  schoolName: string;
  picName: string;
  email: string;
  phone: string;
  status: string;
  estimatedStudents: number;
  createdAt: string;
};

async function json<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      (data as { message?: string }).message ||
        "Permintaan belum dapat diproses",
    );
  return data as T;
}

export default function ManagementPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [cms, setCms] = useState<Cms[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const urls = [
        "/api/backend/support/announcements/manage",
        "/api/backend/support/certificate-templates",
        "/api/backend/students",
        "/api/backend/support/cms",
        "/api/backend/leads",
        "/api/backend/support/achievement-definitions",
      ];
      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const [
        announcementData,
        templateData,
        studentData,
        cmsData,
        leadData,
        achievementData,
      ] = await Promise.all([
        json<Announcement[]>(responses[0]),
        json<Template[]>(responses[1]),
        json<{ data?: Student[] } | Student[]>(responses[2]),
        json<Cms[]>(responses[3]),
        json<Lead[]>(responses[4]),
        json<Achievement[]>(responses[5]),
      ]);
      setAnnouncements(announcementData);
      setTemplates(templateData);
      setStudents(
        Array.isArray(studentData) ? studentData : studentData.data || [],
      );
      setCms(cmsData);
      setLeads(leadData);
      setAchievements(achievementData);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Data pengelolaan belum dapat dimuat",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    payload: (form: FormData) => Record<string, unknown>,
    success: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(path);
    setError("");
    try {
      await json(
        await csrfFetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload(data)),
        }),
      );
      form.reset();
      setMessage(success);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Data belum dapat disimpan",
      );
    }
    setBusy("");
  }

  async function publish(path: string) {
    setBusy(path);
    setError("");
    try {
      await json(await csrfFetch(path, { method: "POST" }));
      setMessage("Konten berhasil dipublikasikan.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Konten belum dapat dipublikasikan",
      );
    }
    setBusy("");
  }

  async function updateLead(id: string, status: string) {
    setBusy(id);
    try {
      await json(
        await csrfFetch(`/api/backend/leads/${id}/status`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Status lead belum berubah",
      );
    }
    setBusy("");
  }

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-orange-600">
        <Loader2 className="animate-spin" size={18} /> Memuat pengelolaan...
      </div>
    );

  return (
    <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
          Pengelolaan Fase 7
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
          Konten, Pencapaian & Lead
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Terbitkan komunikasi resmi, kelola kelayakan sertifikat, dan tindak
          lanjuti minat sekolah. Saat ini ada {announcements.length} pengumuman
          tercatat.
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

        <div className="mt-7 grid gap-5 xl:grid-cols-3">
          <form
            onSubmit={(event) =>
              submit(
                event,
                "/api/backend/support/announcements",
                (form) => ({
                  title: form.get("title"),
                  body: form.get("body"),
                  audience: form.get("audience"),
                  publishNow: form.get("publishNow") === "on",
                }),
                "Pengumuman berhasil dibuat.",
              )
            }
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 font-bold">
              <Megaphone size={18} className="text-orange-600" /> Pengumuman
              baru
            </h3>
            <label className="mt-4 block text-sm font-bold">
              Judul
              <input
                name="title"
                required
                minLength={3}
                className="form-control mt-1"
              />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Isi
              <textarea
                name="body"
                required
                minLength={3}
                className="form-control mt-1 min-h-28"
              />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Audiens
              <select name="audience" className="form-control mt-1">
                <option value="ALL">Semua</option>
                <option value="STUDENTS">Siswa</option>
                <option value="TEACHERS">Guru</option>
                <option value="PARENTS">Orang tua</option>
                <option value="STAFF">Staf</option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input name="publishNow" type="checkbox" /> Langsung publikasikan
            </label>
            <button
              disabled={busy.includes("announcements")}
              className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white"
            >
              Simpan
            </button>
          </form>

          <form
            onSubmit={(event) =>
              submit(
                event,
                "/api/backend/support/certificate-templates",
                (form) => ({
                  name: form.get("name"),
                  titleTemplate: form.get("titleTemplate"),
                  description: form.get("description"),
                  eligibilityRule: {
                    minApprovedSubmissions: Number(form.get("submissions")),
                    minLearningProgress: Number(form.get("progress")),
                    minApprovedStores: Number(form.get("stores")),
                  },
                }),
                "Template sertifikat berhasil dibuat.",
              )
            }
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 font-bold">
              <GraduationCap size={18} className="text-orange-600" /> Template
              sertifikat
            </h3>
            <label className="mt-4 block text-sm font-bold">
              Nama template
              <input name="name" required className="form-control mt-1" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Judul sertifikat
              <input
                name="titleTemplate"
                required
                defaultValue="Sertifikat Kelulusan {{studentName}}"
                className="form-control mt-1"
              />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Deskripsi
              <input name="description" className="form-control mt-1" />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="text-xs font-bold">
                Tugas
                <input
                  name="submissions"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="form-control mt-1"
                />
              </label>
              <label className="text-xs font-bold">
                Progress %
                <input
                  name="progress"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="0"
                  className="form-control mt-1"
                />
              </label>
              <label className="text-xs font-bold">
                Toko
                <input
                  name="stores"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="form-control mt-1"
                />
              </label>
            </div>
            <button
              disabled={busy.includes("certificate-templates")}
              className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white"
            >
              Buat template
            </button>
          </form>

          <form
            onSubmit={(event) =>
              submit(
                event,
                "/api/backend/support/certificates",
                (form) => ({
                  templateId: form.get("templateId"),
                  studentId: form.get("studentId"),
                }),
                "Sertifikat masuk antrean penerbitan.",
              )
            }
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 font-bold">
              <GraduationCap size={18} className="text-orange-600" /> Terbitkan
              sertifikat
            </h3>
            <label className="mt-4 block text-sm font-bold">
              Template
              <select name="templateId" required className="form-control mt-1">
                <option value="">Pilih template</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-bold">
              Siswa
              <select name="studentId" required className="form-control mt-1">
                <option value="">Pilih siswa</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} ({student.studentNumber})
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Sistem memeriksa kelayakan sebelum membuat PDF. Sertifikat dapat
              dicabut dengan jejak audit.
            </p>
            <button
              disabled={busy === "/api/backend/support/certificates"}
              className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white"
            >
              Terbitkan
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <form
              onSubmit={(event) =>
                submit(
                  event,
                  "/api/backend/support/achievements",
                  (form) => ({
                    code: form.get("code"),
                    title: form.get("title"),
                    description: form.get("description"),
                    icon: "AWARD",
                    criteria: { note: form.get("criteria") },
                  }),
                  "Definisi pencapaian berhasil dibuat.",
                )
              }
            >
              <h3 className="flex items-center gap-2 font-bold">
                <Award size={18} className="text-orange-600" /> Definisi
                pencapaian
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Kode
                  <input name="code" required className="form-control mt-1" />
                </label>
                <label className="text-sm font-bold">
                  Judul
                  <input name="title" required className="form-control mt-1" />
                </label>
              </div>
              <label className="mt-3 block text-sm font-bold">
                Deskripsi
                <textarea
                  name="description"
                  required
                  className="form-control mt-1"
                />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Kriteria
                <input name="criteria" className="form-control mt-1" />
              </label>
              <button className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white">
                Buat pencapaian
              </button>
            </form>
            <form
              onSubmit={(event) => {
                const values = new FormData(event.currentTarget);
                const achievementId = String(values.get("achievementId") || "");
                submit(
                  event,
                  `/api/backend/support/achievements/${achievementId}/award`,
                  (form) => ({
                    studentId: form.get("studentId"),
                    evidence: { note: form.get("evidence") },
                  }),
                  "Pencapaian berhasil diberikan.",
                );
              }}
              className="mt-6 border-t pt-5"
            >
              <h4 className="text-sm font-bold">Berikan kepada siswa</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select name="achievementId" required className="form-control">
                  <option value="">Pilih pencapaian</option>
                  {achievements.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <select name="studentId" required className="form-control">
                  <option value="">Pilih siswa</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <input
                name="evidence"
                placeholder="Catatan bukti (opsional)"
                className="form-control mt-3"
              />
              <button className="mt-3 min-h-11 rounded-xl border border-orange-200 px-4 text-sm font-bold text-orange-700">
                Berikan pencapaian
              </button>
            </form>
          </div>
          <form
            onSubmit={(event) =>
              submit(
                event,
                "/api/backend/support/cms",
                (form) => ({
                  slug: form.get("slug"),
                  type: form.get("type"),
                  title: form.get("title"),
                  excerpt: form.get("excerpt"),
                  body: { text: form.get("body") },
                  position: 0,
                }),
                "Konten CMS tersimpan sebagai draf.",
              )
            }
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 font-bold">
              <FileText size={18} className="text-orange-600" /> Konten landing
              page
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Jenis
                <select name="type" className="form-control mt-1">
                  <option value="FAQ">FAQ</option>
                  <option value="TESTIMONIAL">Testimoni</option>
                  <option value="CASE_STUDY">Studi kasus</option>
                  <option value="PARTNER">Mitra</option>
                  <option value="PAGE">Halaman</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Slug
                <input name="slug" required className="form-control mt-1" />
              </label>
            </div>
            <label className="mt-3 block text-sm font-bold">
              Judul
              <input name="title" required className="form-control mt-1" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Ringkasan
              <input name="excerpt" className="form-control mt-1" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Isi
              <textarea name="body" required className="form-control mt-1" />
            </label>
            <button className="bg-sunrise mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-white">
              Simpan draf
            </button>
          </form>
        </div>

        <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold">Konten menunggu publikasi</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cms.map((item) => (
              <article key={item.id} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-orange-700">
                  {item.type} · {item.status}
                </p>
                <p className="mt-1 font-bold">{item.title}</p>
                {item.status === "DRAFT" && (
                  <button
                    disabled={busy.includes(item.id)}
                    onClick={() =>
                      publish(`/api/backend/support/cms/${item.id}/publish`)
                    }
                    className="mt-3 text-xs font-bold text-orange-700"
                  >
                    Publikasikan
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold">
            <UserRoundSearch size={18} className="text-orange-600" /> Lead
            sekolah
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="p-3">Sekolah</th>
                  <th className="p-3">PIC</th>
                  <th className="p-3">Kontak</th>
                  <th className="p-3">Siswa</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b">
                    <td className="p-3 font-bold">
                      {lead.schoolName}
                      <span className="block text-xs font-normal text-slate-500">
                        {new Date(lead.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </td>
                    <td className="p-3">{lead.picName}</td>
                    <td className="p-3">
                      {lead.email}
                      <span className="block text-xs text-slate-500">
                        {lead.phone}
                      </span>
                    </td>
                    <td className="p-3">{lead.estimatedStudents}</td>
                    <td className="p-3">
                      <select
                        disabled={busy === lead.id}
                        value={lead.status}
                        onChange={(event) =>
                          updateLead(lead.id, event.target.value)
                        }
                        className="min-h-10 rounded-lg border bg-white px-2"
                      >
                        <option value="PENDING">Menunggu</option>
                        <option value="CONTACTED">Dihubungi</option>
                        <option value="APPROVED">Disetujui</option>
                        <option value="REJECTED">Ditolak</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
