"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, Building2, ChevronLeft, ChevronRight, GraduationCap, Loader2, Plus, School, Search, Users, UserRound, X } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type Tab = "school" | "classes" | "students" | "teachers" | "parents";

type MasterData = {
  school: {
    id: string;
    code: string;
    npsn?: string | null;
    name: string;
    level: string;
    status: string;
    city?: string | null;
    province?: string | null;
    principal?: string | null;
    picName?: string | null;
    picEmail?: string | null;
    picPhone?: string | null;
  };
  classes: Array<{ id: string; code: string; name: string; grade?: number | null; capacity?: number | null; isActive: boolean; _count: { students: number } }>;
  students: Array<{ id: string; studentNumber: string; fullName: string; phone?: string | null; status: string; class?: { name: string; code: string } | null; user: { email: string; status: string }; _count: { studentParents: number } }>;
  teachers: Array<{ id: string; nip?: string | null; fullName: string; phone?: string | null; isActive: boolean; user: { email: string; status: string }; _count: { materials: number; assignments: number } }>;
  parents: Array<{ id: string; fullName: string; phone?: string | null; isActive: boolean; user: { email: string; status: string }; studentParents: Array<{ student: { id: string; fullName: string; studentNumber: string } }> }>;
  counts: { classes: number; students: number; teachers: number; parents: number };
};

type MasterDataItem = MasterData["classes"][number] | MasterData["students"][number] | MasterData["teachers"][number] | MasterData["parents"][number];
type MasterDataListing = { items: MasterDataItem[]; page: number; pageSize: number; total: number; totalPages: number };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "school", label: "Sekolah" },
  { id: "classes", label: "Kelas" },
  { id: "students", label: "Siswa" },
  { id: "teachers", label: "Guru" },
  { id: "parents", label: "Orang Tua" },
];

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>("school");
  const [data, setData] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState("student");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteActivationPath, setInviteActivationPath] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [listing, setListing] = useState<MasterDataListing | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingVersion, setListingVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);

  const loadData = useCallback(() => {
    fetch("/api/backend/master-data")
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Master Data belum dapat dimuat");
        }
        return response.json();
      })
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Master Data belum dapat dimuat"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => loadData(), [loadData]);

  useEffect(() => {
    if (activeTab === "school" || !data) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (query.trim()) params.set("query", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (activeTab === "students" && classFilter) params.set("classId", classFilter);
      setListingLoading(true);
      fetch(`/api/backend/master-data/lists/${activeTab}?${params}`)
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.message || "Daftar belum dapat dimuat");
          return payload;
        })
        .then((payload) => { if (!cancelled) setListing(payload); })
        .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Daftar belum dapat dimuat"); })
        .finally(() => { if (!cancelled) setListingLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [activeTab, classFilter, data, listingVersion, page, query, statusFilter]);

  function refreshData() {
    loadData();
    setListingVersion((value) => value + 1);
  }

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    setQuery("");
    setStatusFilter("");
    setClassFilter("");
    setPage(1);
    setListing(null);
  }

  function toggleUserForm() {
    if (showInvite) {
      setShowInvite(false);
      return;
    }
    if (["students", "teachers", "parents"].includes(activeTab)) {
      setInviteRole(activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent");
    }
    setInviteMessage("");
    setInviteError("");
    setInviteActivationPath("");
    setShowInvite(true);
  }

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSubmittingInvite(true);
    setInviteError("");
    setInviteMessage("");
    setInviteActivationPath("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const firstName = String(form.get("firstName") || "");
    const lastName = String(form.get("lastName") || "");
    const profileData: Record<string, string> = {
      fullName: `${firstName} ${lastName}`.trim(),
      phone: String(form.get("phone") || "").trim(),
    };
    if (inviteRole === "student") {
      profileData.studentNumber = String(form.get("studentNumber") || "");
      const classId = String(form.get("classId") || "");
      if (classId) profileData.classId = classId;
    }
    if (inviteRole === "teacher") profileData.nip = String(form.get("nip") || "");
    if (inviteRole === "parent") {
      profileData.studentId = String(form.get("studentId") || "");
      profileData.relationship = String(form.get("relationship") || "WALI");
    }
    const response = await csrfFetch("/api/backend/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") || ""),
        firstName,
        lastName,
        roleSlug: inviteRole,
        schoolId: data.school.id,
        profileData,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setInviteError(Array.isArray(result.message) ? result.message.join(", ") : result.message || "Undangan gagal dibuat");
    } else {
      const activationPath = result.activationToken ? `/aktivasi?token=${encodeURIComponent(result.activationToken)}` : "";
      setInviteActivationPath(activationPath);
      setInviteMessage(activationPath ? "Pengguna dan peran berhasil disiapkan. Bagikan tautan aktivasi satu kali kepada pengguna." : "Pengguna dan peran berhasil disiapkan. Undangan siap dikirim melalui layanan email.");
      formElement.reset();
    }
    setSubmittingInvite(false);
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm font-bold text-orange-600"><Loader2 className="animate-spin" size={18} /> Memuat Master Data...</div>;
  }

  if (error || !data) {
    return <div className="p-4 sm:p-8"><div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-5 text-sm text-red-700"><AlertCircle size={18} />{error || "Master Data tidak tersedia"}</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Administrasi Sekolah</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold text-[#1F2937]">Master Data</h2><button type="button" onClick={toggleUserForm} className="bg-sunrise inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white">{showInvite ? <X size={17} /> : <Plus size={17} />}{showInvite ? "Tutup form" : activeTab === "students" ? "Tambah siswa" : "Tambah pengguna"}</button></div>
        <p className="mt-2 text-sm text-[#64748B]">Data umum sekolah sesuai konteks akun. Dokumen identitas tetap berada di menu verifikasi terpisah.</p>

        {showInvite && <InvitationForm data={data} role={inviteRole} setRole={setInviteRole} onSubmit={sendInvitation} loading={submittingInvite} message={inviteMessage} error={inviteError} activationPath={inviteActivationPath} />}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<School size={20} />} label="Kelas" value={data.counts.classes} />
          <Stat icon={<GraduationCap size={20} />} label="Siswa" value={data.counts.students} />
          <Stat icon={<Users size={20} />} label="Guru" value={data.counts.teachers} />
          <Stat icon={<UserRound size={20} />} label="Orang Tua" value={data.counts.parents} />
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto rounded-xl border border-[#DDEBE8] bg-white p-2" role="tablist" aria-label="Jenis Master Data">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => selectTab(tab.id)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold ${activeTab === tab.id ? "bg-orange-100 text-orange-700" : "text-slate-600 hover:bg-slate-50"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <section className="mt-5" aria-live="polite">
          {activeTab === "school" && <SchoolPanel school={data.school} />}
          {activeTab !== "school" && <ListFilters activeTab={activeTab} classes={data.classes} query={query} setQuery={(value) => { setQuery(value); setPage(1); }} status={statusFilter} setStatus={(value) => { setStatusFilter(value); setPage(1); }} classId={classFilter} setClassId={(value) => { setClassFilter(value); setPage(1); }} />}
          {activeTab === "classes" && <><CreateClassForm onCreated={refreshData} />{listingLoading && !listing ? <LoadingList /> : <ClassesTable rows={(listing?.items || data.classes) as MasterData["classes"]} />}</>}
          {activeTab === "students" && <><StudentImportForm onCompleted={refreshData} />{listingLoading && !listing ? <LoadingList /> : <StudentsTable rows={(listing?.items || data.students) as MasterData["students"]} />}</>}
          {activeTab === "teachers" && (listingLoading && !listing ? <LoadingList /> : <TeachersTable rows={(listing?.items || data.teachers) as MasterData["teachers"]} />)}
          {activeTab === "parents" && (listingLoading && !listing ? <LoadingList /> : <ParentsTable rows={(listing?.items || data.parents) as MasterData["parents"]} />)}
          {activeTab !== "school" && listing && <Pagination listing={listing} loading={listingLoading} onPage={setPage} />}
        </section>
      </div>
    </div>
  );
}

function ListFilters({ activeTab, classes, query, setQuery, status, setStatus, classId, setClassId }: { activeTab: Exclude<Tab, "school">; classes: MasterData["classes"]; query: string; setQuery: (value: string) => void; status: string; setStatus: (value: string) => void; classId: string; setClassId: (value: string) => void }) {
  const studentStatuses = ["DRAFT", "PENDING_ACTIVATION", "ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED", "SUSPENDED"];
  return <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-orange-100 bg-white p-4">
    <label className="relative min-w-64 flex-1"><span className="sr-only">Cari data</span><Search aria-hidden="true" className="absolute left-3 top-3.5 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, nomor, kode, atau email" className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3" /></label>
    <label><span className="sr-only">Filter status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="">Semua status</option>{activeTab === "students" ? studentStatuses.map((item) => <option key={item} value={item}>{item}</option>) : <><option value="active">Aktif</option><option value="inactive">Nonaktif</option></>}</select></label>
    {activeTab === "students" && <label><span className="sr-only">Filter kelas</span><select value={classId} onChange={(event) => setClassId(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="">Semua kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
  </div>;
}

function Pagination({ listing, loading, onPage }: { listing: MasterDataListing; loading: boolean; onPage: (page: number) => void }) {
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><p>{listing.total} data · Halaman {listing.page} dari {listing.totalPages}</p><div className="flex gap-2"><button type="button" disabled={loading || listing.page <= 1} onClick={() => onPage(listing.page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 px-3 font-bold disabled:opacity-40"><ChevronLeft size={16} /> Sebelumnya</button><button type="button" disabled={loading || listing.page >= listing.totalPages} onClick={() => onPage(listing.page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 px-3 font-bold disabled:opacity-40">Berikutnya <ChevronRight size={16} /></button></div></div>;
}

function LoadingList() {
  return <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-orange-100 bg-white text-sm font-bold text-orange-600"><Loader2 className="animate-spin" size={18} /> Memuat daftar...</div>;
}

function InvitationForm({ data, role, setRole, onSubmit, loading, message, error, activationPath }: { data: MasterData; role: string; setRole: (role: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; message: string; error: string; activationPath: string }) {
  return <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-2xl border border-orange-200 bg-white p-5 shadow-sm sm:grid-cols-2">
    <div className="sm:col-span-2"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Pengguna baru</p><h3 className="mt-1 text-xl font-extrabold text-slate-950">Tambahkan pengguna ke {data.school.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">Pilih peran dan lengkapi datanya. Pengguna akan membuat kata sandi sendiri melalui tautan aktivasi satu kali.</p></div>
    <div><label className="text-sm font-bold text-slate-700" htmlFor="invite-role">Peran pengguna</label><select id="invite-role" value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="student">Siswa</option><option value="teacher">Guru</option><option value="parent">Orang tua/wali</option></select></div>
    <div><label className="text-sm font-bold text-slate-700" htmlFor="invite-school">Sekolah</label><input id="invite-school" disabled value={data.school.name} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500" /></div>
    <div><label className="text-sm font-bold text-slate-700" htmlFor="invite-email">Email</label><input id="invite-email" name="email" type="email" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></div>
    <div><label className="text-sm font-bold text-slate-700" htmlFor="invite-first">Nama depan</label><input id="invite-first" name="firstName" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></div>
    <div><label className="text-sm font-bold text-slate-700" htmlFor="invite-last">Nama belakang</label><input id="invite-last" name="lastName" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></div>
    {role === "student" && <><div><label className="text-sm font-bold text-slate-700" htmlFor="student-number">Nomor induk siswa</label><input id="student-number" name="studentNumber" required maxLength={50} placeholder="Contoh: 2026001" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></div><div><label className="text-sm font-bold text-slate-700" htmlFor="student-class">Kelas</label><select id="student-class" name="classId" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="">Belum ditentukan</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></>}
    {role === "teacher" && <div><label className="text-sm font-bold text-slate-700" htmlFor="teacher-nip">NIP/ID Guru</label><input id="teacher-nip" name="nip" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></div>}
    {role === "parent" && <><div><label className="text-sm font-bold text-slate-700" htmlFor="parent-student">Anak yang dihubungkan</label><select id="parent-student" name="studentId" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">{data.students.map((item) => <option key={item.id} value={item.id}>{item.fullName} ({item.studentNumber})</option>)}</select></div><div><label className="text-sm font-bold text-slate-700" htmlFor="relationship">Hubungan</label><select id="relationship" name="relationship" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="AYAH">Ayah</option><option value="IBU">Ibu</option><option value="WALI">Wali</option></select></div></>}
    <div><label className="text-sm font-bold text-slate-700" htmlFor="invite-phone">Nomor telepon <span className="font-normal text-slate-400">(opsional)</span></label><input id="invite-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="Contoh: 0812 3456 7890" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
    {message && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 sm:col-span-2"><p>{message}</p>{activationPath && <a href={activationPath} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 font-extrabold text-white">Buka halaman aktivasi</a>}</div>}
    <button disabled={loading} className="bg-sunrise min-h-11 rounded-xl px-4 text-sm font-extrabold text-white disabled:opacity-60 sm:col-span-2">{loading ? "Menyiapkan pengguna..." : `Tambahkan ${role === "student" ? "siswa" : role === "teacher" ? "guru" : "orang tua/wali"}`}</button>
  </form>;
}

function CreateClassForm({ onCreated }: { onCreated: () => void }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await csrfFetch("/api/backend/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.get("code"), name: form.get("name"), grade: Number(form.get("grade")) || undefined, capacity: Number(form.get("capacity")) || undefined }) });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Kelas berhasil ditambahkan." : result.message || "Kelas gagal ditambahkan.");
    if (response.ok) { formElement.reset(); onCreated(); }
  }
  return <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl border border-orange-100 bg-white p-4 sm:grid-cols-5"><input name="code" required placeholder="Kode kelas" aria-label="Kode kelas" className="min-h-11 rounded-xl border border-slate-300 px-3" /><input name="name" required placeholder="Nama kelas" aria-label="Nama kelas" className="min-h-11 rounded-xl border border-slate-300 px-3" /><input name="grade" type="number" min="1" max="13" placeholder="Tingkat" aria-label="Tingkat" className="min-h-11 rounded-xl border border-slate-300 px-3" /><input name="capacity" type="number" min="1" placeholder="Kapasitas" aria-label="Kapasitas" className="min-h-11 rounded-xl border border-slate-300 px-3" /><button className="bg-sunrise min-h-11 rounded-xl px-3 text-sm font-extrabold text-white">Tambah kelas</button>{message && <p role="status" className="text-sm text-slate-600 sm:col-span-5">{message}</p>}</form>;
}

function StudentImportForm({ onCompleted }: { onCompleted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null);
    setStatus("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setStatus("File maksimal 2 MB.");
    setLoading(true);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("CSV belum memiliki baris data");
      const headers = parsed[0].map((value) => value.trim());
      const required = ["email", "studentNumber", "fullName"];
      if (required.some((name) => !headers.includes(name))) throw new Error(`Header wajib: ${required.join(", ")}`);
      const rows = parsed.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || undefined])));
      const response = await csrfFetch("/api/backend/imports/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceName: file.name, rows }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(", ") : result.message || "Import gagal dibuat");
      setStatus(`Import ${result.totalRows} baris masuk antrean.`);
      await monitorImport(result.id, setStatus);
      onCompleted();
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "File belum dapat diproses");
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={submit} className="mb-4 rounded-xl border border-orange-100 bg-white p-4"><div className="flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><label htmlFor="student-import" className="text-sm font-bold text-slate-700">Import siswa CSV</label><input id="student-import" type="file" accept=".csv,text/csv" required onChange={chooseFile} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div><button disabled={loading || !file} className="bg-sunrise min-h-11 rounded-xl px-4 text-sm font-extrabold text-white disabled:opacity-60">{loading ? "Memproses antrean..." : "Import asynchronous"}</button><a download="template-import-siswa.csv" href="data:text/csv;charset=utf-8,email%2CstudentNumber%2CfullName%2CclassCode%2Cnisn%0A" className="inline-flex min-h-11 items-center rounded-xl border border-orange-300 px-4 text-sm font-bold text-orange-700">Unduh template</a></div>{status && <p role="status" className="mt-3 text-sm text-slate-600">{status}</p>}</form>;
}

async function monitorImport(id: string, setStatus: (message: string) => void) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`/api/backend/imports/${id}`);
    if (!response.ok) throw new Error("Status import belum dapat dibaca");
    const job = await response.json();
    setStatus(`${job.status}: ${job.processedRows}/${job.totalRows} diproses, ${job.failedRows} gagal.`);
    if (["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"].includes(job.status)) return;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  throw new Error("Import masih berjalan. Periksa kembali daftar import nanti.");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-4 rounded-xl border border-[#DDEBE8] bg-white p-4 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-orange-100 text-orange-700">{icon}</span><div><p className="text-xs font-semibold text-[#64748B]">{label}</p><p className="text-2xl font-extrabold text-[#1F2937]">{value}</p></div></div>;
}

function SchoolPanel({ school }: { school: MasterData["school"] }) {
  const rows = [
    ["Nama sekolah", school.name],
    ["Kode / NPSN", `${school.code}${school.npsn ? ` / ${school.npsn}` : ""}`],
    ["Jenjang", school.level],
    ["Lokasi", [school.city, school.province].filter(Boolean).join(", ") || "-"],
    ["Kepala sekolah", school.principal || "-"],
    ["PIC", school.picName || "-"],
    ["Kontak PIC", [school.picEmail, school.picPhone].filter(Boolean).join(" · ") || "-"],
    ["Status", school.status],
  ];
  return <div className="rounded-2xl border border-[#DDEBE8] bg-white p-5 shadow-sm"><h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-[#1F2937]"><Building2 className="text-orange-600" size={21} /> Profil Sekolah</h3><dl className="grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-xl bg-[#FFFFFF] p-4"><dt className="text-xs font-bold text-[#64748B]">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#1F2937]">{value}</dd></div>)}</dl></div>;
}

function ClassesTable({ rows }: { rows: MasterData["classes"] }) {
  return <DataTable headers={["Kode", "Kelas", "Tingkat", "Siswa", "Kapasitas", "Status"]} empty="Belum ada kelas.">{rows.map((row) => <tr key={row.id}><Cell>{row.code}</Cell><Cell strong>{row.name}</Cell><Cell>{row.grade || "-"}</Cell><Cell>{row._count.students}</Cell><Cell>{row.capacity || "-"}</Cell><Cell><Status active={row.isActive} /></Cell></tr>)}</DataTable>;
}

function StudentsTable({ rows }: { rows: MasterData["students"] }) {
  return <DataTable headers={["No. Induk", "Nama", "Kelas", "Email", "Orang Tua", "Status"]} empty="Belum ada siswa.">{rows.map((row) => <tr key={row.id}><Cell>{row.studentNumber}</Cell><Cell strong>{row.fullName}</Cell><Cell>{row.class?.name || "-"}</Cell><Cell>{row.user.email}</Cell><Cell>{row._count.studentParents}</Cell><Cell><Status active={row.status === "ACTIVE"} label={row.status} /></Cell></tr>)}</DataTable>;
}

function TeachersTable({ rows }: { rows: MasterData["teachers"] }) {
  return <DataTable headers={["NIP", "Nama", "Email", "Materi", "Tugas", "Status"]} empty="Belum ada guru.">{rows.map((row) => <tr key={row.id}><Cell>{row.nip || "-"}</Cell><Cell strong>{row.fullName}</Cell><Cell>{row.user.email}</Cell><Cell>{row._count.materials}</Cell><Cell>{row._count.assignments}</Cell><Cell><Status active={row.isActive} /></Cell></tr>)}</DataTable>;
}

function ParentsTable({ rows }: { rows: MasterData["parents"] }) {
  return <DataTable headers={["Nama", "Email", "Telepon", "Anak Terhubung", "Status"]} empty="Belum ada akun orang tua yang terhubung.">{rows.map((row) => <tr key={row.id}><Cell strong>{row.fullName}</Cell><Cell>{row.user.email}</Cell><Cell>{row.phone || "-"}</Cell><Cell>{row.studentParents.map((link) => `${link.student.fullName} (${link.student.studentNumber})`).join(", ") || "-"}</Cell><Cell><Status active={row.isActive} /></Cell></tr>)}</DataTable>;
}

function DataTable({ headers, empty, children }: { headers: string[]; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) && children.length > 0;
  if (!hasRows) return <div className="rounded-xl border border-[#DDEBE8] bg-white p-8 text-center text-sm text-[#64748B]">{empty}</div>;
  return <div className="overflow-x-auto rounded-xl border border-[#DDEBE8] bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-[#FFF7ED] text-xs uppercase tracking-wide text-orange-800"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-amber-100">{children}</tbody></table></div>;
}

function Cell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-slate-600 ${strong ? "font-bold text-slate-900" : ""}`}>{children}</td>;
}

function Status({ active, label }: { active: boolean; label?: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{label || (active ? "AKTIF" : "NONAKTIF")}</span>;
}
