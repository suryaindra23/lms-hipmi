"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Layers3, Loader2, Plus, Users } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type Program = { id: string; code: string; name: string; _count?: { courses: number } };
type Lesson = { id: string; title: string; isPublished: boolean };
type Module = { id: string; title: string; isPublished: boolean; lessons: Lesson[] };
type Course = { id: string; code: string; name: string; modules?: Module[]; program?: Program | null };
type SchoolClass = { id: string; code: string; name: string };
type BuilderItem = { name: string; weight: number; required?: boolean };

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  const message = payload?.message;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
}

export default function CurriculumPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tree, setTree] = useState<Course[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [rubricItems, setRubricItems] = useState<BuilderItem[]>([
    { name: "Kualitas hasil", weight: 40 }, { name: "Kelengkapan", weight: 35 }, { name: "Orisinalitas", weight: 25 },
  ]);
  const [checklistItems, setChecklistItems] = useState<BuilderItem[]>([
    { name: "Profil toko lengkap", weight: 25, required: true }, { name: "Produk memenuhi brief", weight: 40, required: true },
    { name: "Operasional siap", weight: 20, required: true }, { name: "Bukti aman", weight: 15, required: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/backend/learning/programs"), fetch("/api/backend/learning/courses"),
        fetch("/api/backend/learning/tree"), fetch("/api/backend/learning/classes"),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("Struktur pembelajaran belum dapat dimuat");
      const [programData, courseData, treeData, classData] = await Promise.all(responses.map((response) => response.json()));
      setPrograms(programData); setCourses(courseData); setTree(treeData); setClasses(classData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data belum dapat dimuat");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const send = async (url: string, payload: unknown, success: string, reset?: () => void) => {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await csrfFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseError(response, "Data gagal disimpan"));
      setMessage(success); reset?.(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Data gagal disimpan"); }
    finally { setSaving(false); }
  };

  const formValue = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) || "").trim();

  const createProgram = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    void send("/api/backend/learning/programs", { code: formValue(form, "code"), name: formValue(form, "name"), description: formValue(form, "description") || undefined }, "Program berhasil dibuat.", () => form.reset());
  };
  const createCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    void send("/api/backend/learning/courses", { programId: formValue(form, "programId") || undefined, code: formValue(form, "code"), name: formValue(form, "name"), description: formValue(form, "description") || undefined }, "Course berhasil dibuat.", () => form.reset());
  };
  const createModule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const courseId = formValue(form, "courseId");
    void send(`/api/backend/learning/courses/${courseId}/modules`, { title: formValue(form, "title"), description: formValue(form, "description") || undefined, isPublished: true }, "Modul berhasil diterbitkan.", () => form.reset());
  };
  const createLesson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const moduleId = formValue(form, "moduleId");
    void send(`/api/backend/learning/modules/${moduleId}/lessons`, { title: formValue(form, "title"), summary: formValue(form, "summary") || undefined, estimatedMinutes: Number(formValue(form, "minutes")) || undefined, isPublished: true }, "Lesson berhasil diterbitkan.", () => form.reset());
  };
  const enroll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    void send("/api/backend/learning/enrollments/class", { courseId: formValue(form, "courseId"), classId: formValue(form, "classId") }, "Siswa aktif di kelas berhasil dimasukkan ke course.");
  };
  const createRubric = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    void send("/api/backend/rubrics", { name: formValue(form, "name"), description: formValue(form, "description") || undefined, criteria: rubricItems.map((item, index) => ({ name: item.name, weight: item.weight, maxScore: 100, position: index + 1 })) }, "Rubrik berhasil dibuat.", () => form.reset());
  };
  const createMgmpRubrics = () => {
    void send("/api/backend/rubrics/templates/mgmp", {}, "Tiga rubrik MGMP siap digunakan: KIK, Bahasa Inggris, dan Informatika.");
  };
  const createChecklist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    void send("/api/backend/student-store/checklist-templates", { name: formValue(form, "name"), platform: formValue(form, "platform") || undefined, minimumProducts: Number(formValue(form, "minimumProducts")), items: checklistItems.map((item, index) => ({ code: `ITEM_${index + 1}`, label: item.name, evidenceType: "SCREENSHOT", weight: item.weight, isRequired: Boolean(item.required), position: index + 1 })) }, "Checklist toko berhasil dibuat.", () => form.reset());
  };

  const allModules = tree.flatMap((course) => (course.modules || []).map((module) => ({ ...module, courseName: course.name })));
  return <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Fase 4 · LMS Inti</p>
      <h2 className="mt-2 text-2xl font-extrabold text-slate-800">Struktur Pembelajaran</h2>
      <p className="mt-2 text-sm text-slate-500">Susun program sampai lesson, daftarkan kelas, lalu siapkan rubrik dan checklist yang dapat dipakai saat membuat tugas.</p>
      {error && <div role="alert" className="mt-5 flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18}/>{error}</div>}
      {message && <div role="status" className="mt-5 flex gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 size={18}/>{message}</div>}
      {loading ? <p className="mt-8 font-semibold text-orange-600">Memuat struktur...</p> : <>
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniForm title="1. Program" onSubmit={createProgram}><Input name="code" label="Kode" placeholder="WIRAUSAHA"/><Input name="name" label="Nama program"/><Input name="description" label="Deskripsi"/></MiniForm>
          <MiniForm title="2. Course" onSubmit={createCourse}><Select name="programId" label="Program" optional options={programs.map((item) => ({ value: item.id, label: item.name }))}/><Input name="code" label="Kode"/><Input name="name" label="Nama course"/><Input name="description" label="Deskripsi"/></MiniForm>
          <MiniForm title="3. Modul" onSubmit={createModule}><Select name="courseId" label="Course" options={courses.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))}/><Input name="title" label="Judul modul"/><Input name="description" label="Ringkasan"/></MiniForm>
          <MiniForm title="4. Lesson" onSubmit={createLesson}><Select name="moduleId" label="Modul" options={allModules.map((item) => ({ value: item.id, label: `${item.courseName} · ${item.title}` }))}/><Input name="title" label="Judul lesson"/><Input name="summary" label="Ringkasan"/><Input name="minutes" label="Durasi (menit)" type="number"/></MiniForm>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <form onSubmit={enroll} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-slate-800"><Users size={19} className="text-orange-600"/>Enrollment kelas</h3>
            <div className="mt-4 grid gap-3"><Select name="courseId" label="Course" options={courses.map((item) => ({ value: item.id, label: item.name }))}/><Select name="classId" label="Kelas" options={classes.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))}/></div>
            <SaveButton saving={saving} label="Daftarkan seluruh siswa aktif"/>
          </form>
          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-slate-800"><Layers3 size={19} className="text-orange-600"/>Struktur saat ini</h3>
            <div className="mt-4 space-y-3">{tree.length === 0 ? <p className="text-sm text-slate-500">Belum ada course.</p> : tree.map((course) => <article key={course.id} className="rounded-xl bg-orange-50/60 p-4"><p className="text-xs font-bold text-orange-700">{course.program?.name || "Tanpa program"} · {course.code}</p><h4 className="font-bold text-slate-800">{course.name}</h4><div className="mt-2 space-y-1 text-sm text-slate-600">{course.modules?.map((module) => <p key={module.id}>• {module.title} <span className="text-slate-400">({module.lessons.length} lesson)</span></p>)}</div></article>)}</div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4"><section className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><h3 className="font-bold text-violet-950">Rubrik AI MGMP</h3><p className="mt-2 text-sm leading-6 text-violet-900">Buat tiga rubrik terpisah untuk KIK, Bahasa Inggris, dan Informatika. Pakai masing-masing pada tugas MGMP terkait agar nilai dan rekomendasi AI tidak tercampur.</p><button type="button" onClick={createMgmpRubrics} disabled={saving} className="mt-4 min-h-11 w-full rounded-xl bg-violet-700 px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Buat 3 rubrik MGMP"}</button></section><Builder title="Rubrik penilaian" nameLabel="Nama rubrik" items={rubricItems} setItems={setRubricItems} onSubmit={createRubric}/></div>
          <Builder title="Checklist Student Store" nameLabel="Nama checklist" items={checklistItems} setItems={setChecklistItems} onSubmit={createChecklist} checklist/>
        </section>
      </>}
    </div>
  </main>;
}

function MiniForm({ title, onSubmit, children }: { title: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return <form onSubmit={onSubmit} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"><h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><Plus size={17} className="text-orange-600"/>{title}</h3><div className="space-y-3">{children}</div><button className="mt-4 min-h-11 w-full rounded-xl bg-orange-600 px-3 text-sm font-bold text-white">Simpan</button></form>;
}
function Input({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder?: string; type?: string }) { return <label className="block text-xs font-bold text-slate-700">{label}<input name={name} type={type} required={name !== "description" && name !== "summary"} min={type === "number" ? 1 : undefined} placeholder={placeholder} className="form-control mt-1"/></label>; }
function Select({ name, label, options, optional, optionalLabel = "Tanpa program" }: { name: string; label: string; options: Array<{ value: string; label: string }>; optional?: boolean; optionalLabel?: string }) { return <label className="block text-xs font-bold text-slate-700">{label}<select name={name} required={!optional} className="form-control mt-1"><option value="">{optional ? optionalLabel : "Pilih"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function SaveButton({ saving, label }: { saving: boolean; label: string }) { return <button disabled={saving} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={17} className="animate-spin"/>}{label}</button>; }

function Builder({ title, nameLabel, items, setItems, onSubmit, checklist }: { title: string; nameLabel: string; items: BuilderItem[]; setItems: React.Dispatch<React.SetStateAction<BuilderItem[]>>; onSubmit: (event: FormEvent<HTMLFormElement>) => void; checklist?: boolean }) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return <form onSubmit={onSubmit} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-bold text-slate-800"><BookOpen size={19} className="text-orange-600"/>{title}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><Input name="name" label={nameLabel}/><Input name="description" label="Deskripsi"/>{checklist && <><Select name="platform" label="Platform" optional options={["SHOPEE", "TIKTOK", "TOKOPEDIA", "OTHER"].map((value) => ({ value, label: value }))}/><Input name="minimumProducts" label="Minimum produk" type="number"/></>}</div><div className="mt-4 space-y-2">{items.map((item, index) => <div key={index} className="grid grid-cols-[1fr_80px_auto] gap-2"><input aria-label={`${title} item ${index + 1}`} value={item.name} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, name: event.target.value } : value))} className="form-control" required/><input aria-label={`Bobot item ${index + 1}`} type="number" min={1} max={100} value={item.weight} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, weight: Number(event.target.value) } : value))} className="form-control"/>{checklist ? <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.required} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, required: event.target.checked } : value))}/>Wajib</label> : <button type="button" aria-label="Hapus kriteria" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="px-2 text-red-600">×</button>}</div>)}</div><div className="mt-3 flex items-center justify-between"><button type="button" onClick={() => setItems((current) => [...current, { name: "Kriteria baru", weight: 0, required: true }])} className="text-sm font-bold text-orange-600">+ Tambah item</button><span className={`text-sm font-bold ${total === 100 ? "text-green-700" : "text-red-600"}`}>Total {total}%</span></div><button disabled={total !== 100} className="mt-4 min-h-11 w-full rounded-xl bg-orange-600 font-bold text-white disabled:bg-slate-300">Simpan {title}</button></form>;
}
