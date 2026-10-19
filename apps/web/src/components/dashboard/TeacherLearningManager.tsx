"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardPlus, FileText, Loader2, Plus } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";
import Link from "next/link";

type Course = { id: string; name: string; code: string };
type LearningCourse = Course & { modules: Array<{ id: string; title: string; position: number; lessons: Array<{ id: string; title: string; position: number }> }> };
type Material = {
  id: string;
  title: string;
  type: string;
  content?: string | null;
  fileUrl?: string | null;
  originalFileName?: string | null;
  course: Course;
};
type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  startDate: string;
  endDate: string;
  maxScore: number;
  isActive: boolean;
  course: Course;
  _count?: { submissions: number };
};
type Rubric = { id: string; name: string };
type Checklist = { id: string; name: string; minimumProducts: number };

function materialKind(material: Pick<Material, "type" | "originalFileName">) {
  return material.originalFileName?.toLowerCase().endsWith(".pptx") ? "PPTX" : material.type;
}

function localDateTime(offsetHours = 0) {
  const value = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function errorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  const message = payload?.message;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
}

export default function TeacherLearningManager() {
  const [tab, setTab] = useState<"materials" | "assignments">("materials");
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningTree, setLearningTree] = useState<LearningCourse[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [materialCourseId, setMaterialCourseId] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState("TEXT");
  const [materialContent, setMaterialContent] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialLessonId, setMaterialLessonId] = useState("");

  const [assignmentCourseId, setAssignmentCourseId] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentType, setAssignmentType] = useState("AFFILIATE");
  const [assignmentStart, setAssignmentStart] = useState(localDateTime());
  const [assignmentEnd, setAssignmentEnd] = useState(localDateTime(7 * 24));
  const [assignmentMaxScore, setAssignmentMaxScore] = useState(100);
  const [assignmentPublished, setAssignmentPublished] = useState(true);
  const [assignmentRubricId, setAssignmentRubricId] = useState("");
  const [assignmentChecklistId, setAssignmentChecklistId] = useState("");
  const [assignmentModuleId, setAssignmentModuleId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [courseResponse, treeResponse, materialResponse, assignmentResponse, rubricResponse, checklistResponse] = await Promise.all([
        fetch("/api/backend/learning/courses"),
        fetch("/api/backend/learning/tree"),
        fetch("/api/backend/learning/materials"),
        fetch("/api/backend/assignments"),
        fetch("/api/backend/rubrics"),
        fetch("/api/backend/student-store/checklist-templates"),
      ]);
      if (!courseResponse.ok) throw new Error(await errorMessage(courseResponse, "Mata pelajaran belum dapat dimuat"));
      if (!treeResponse.ok || !materialResponse.ok) throw new Error(await errorMessage(materialResponse, "Materi belum dapat dimuat"));
      if (!assignmentResponse.ok) throw new Error(await errorMessage(assignmentResponse, "Tugas belum dapat dimuat"));

      if (!rubricResponse.ok || !checklistResponse.ok) throw new Error("Rubrik dan checklist belum dapat dimuat");
      const [courseData, treeData, materialData, assignmentData, rubricData, checklistData] = await Promise.all([
        courseResponse.json(),
        treeResponse.json(),
        materialResponse.json(),
        assignmentResponse.json(),
        rubricResponse.json(),
        checklistResponse.json(),
      ]);
      setCourses(courseData);
      setLearningTree(treeData);
      setMaterials(materialData);
      setAssignments(assignmentData.data || []);
      setRubrics(rubricData || []);
      setChecklists(checklistData || []);
      if (!materialCourseId && courseData[0]) setMaterialCourseId(courseData[0].id);
      if (!assignmentCourseId && courseData[0]) setAssignmentCourseId(courseData[0].id);
      const firstLesson = treeData.flatMap((course: LearningCourse) => course.modules.flatMap((module) => module.lessons))[0];
      const firstModule = treeData.flatMap((course: LearningCourse) => course.modules)[0];
      if (!materialLessonId && firstLesson) setMaterialLessonId(firstLesson.id);
      if (!assignmentModuleId && firstModule) setAssignmentModuleId(firstModule.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data pembelajaran belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  }, [assignmentCourseId, assignmentModuleId, materialCourseId, materialLessonId]);

  const materialLessons = learningTree.find((course) => course.id === materialCourseId)?.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title }))) || [];
  const assignmentModules = learningTree.find((course) => course.id === assignmentCourseId)?.modules || [];

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const createMaterial = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await csrfFetch("/api/backend/learning/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: materialCourseId,
          lessonId: materialLessonId,
          title: materialTitle,
          type: materialType,
          content: materialContent || undefined,
          fileUrl: materialUrl || undefined,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Materi gagal disimpan"));
      setMaterialTitle("");
      setMaterialContent("");
      setMaterialUrl("");
      setSuccess("Materi berhasil dipublikasikan.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Materi gagal disimpan");
    } finally {
      setSaving(false);
    }
  };

  const createAssignment = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await csrfFetch("/api/backend/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: assignmentCourseId,
          moduleId: assignmentModuleId,
          title: assignmentTitle,
          description: assignmentDescription || undefined,
          type: assignmentType,
          startDate: new Date(assignmentStart).toISOString(),
          endDate: new Date(assignmentEnd).toISOString(),
          maxScore: assignmentMaxScore,
          rubricId: assignmentRubricId || undefined,
          checklistTemplateId: assignmentType === "STORE" ? assignmentChecklistId || undefined : undefined,
          isActive: assignmentPublished,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Tugas gagal disimpan"));
      setAssignmentTitle("");
      setAssignmentDescription("");
      setSuccess(assignmentPublished ? "Tugas berhasil dipublikasikan." : "Tugas berhasil disimpan sebagai draf.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tugas gagal disimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Ruang Guru</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#1F2937]">Kelola Materi & Tugas</h2>
          <p className="mt-2 text-sm text-[#64748B]">Konten hanya diterbitkan untuk mata pelajaran di sekolah Anda.</p>
          <Link href="/dashboard/kurikulum" className="mt-3 inline-flex text-sm font-bold text-orange-600 hover:underline">Atur program, modul, lesson, rubrik & checklist →</Link>
        </div>

        <div className="mb-6 flex gap-2 rounded-xl border border-[#DDEBE8] bg-white p-2" role="tablist" aria-label="Jenis konten pembelajaran">
          <button type="button" role="tab" aria-selected={tab === "materials"} onClick={() => setTab("materials")} className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-bold ${tab === "materials" ? "bg-orange-100 text-orange-700" : "text-slate-600"}`}>
            Materi
          </button>
          <button type="button" role="tab" aria-selected={tab === "assignments"} onClick={() => setTab("assignments")} className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-bold ${tab === "assignments" ? "bg-orange-100 text-orange-700" : "text-slate-600"}`}>
            Tugas
          </button>
        </div>

        {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</div>}
        {success && <div role="status" className="mb-5 flex gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 size={18} />{success}</div>}

        {courses.length === 0 && !loading ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Belum ada mata pelajaran aktif. Hubungi administrator untuk menyiapkan course sekolah.</div>
        ) : tab === "materials" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
            <form onSubmit={createMaterial} className="h-fit space-y-4 rounded-2xl border border-[#DDEBE8] bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#1F2937]"><Plus size={20} className="text-orange-600" /> Tambah Materi</h3>
              <Field label="Mata pelajaran" id="material-course"><select id="material-course" required value={materialCourseId} onChange={(event) => { const courseId = event.target.value; setMaterialCourseId(courseId); const first = learningTree.find((course) => course.id === courseId)?.modules.flatMap((module) => module.lessons)[0]; setMaterialLessonId(first?.id || ""); }} className="form-control">{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></Field>
              <Field label="Lesson" id="material-lesson"><select id="material-lesson" required value={materialLessonId} onChange={(event) => setMaterialLessonId(event.target.value)} className="form-control"><option value="">Pilih lesson</option>{materialLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.moduleTitle} · {lesson.title}</option>)}</select></Field>
              <Field label="Judul materi" id="material-title"><input id="material-title" required minLength={3} maxLength={160} value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} className="form-control" placeholder="Contoh: Dasar membuat konten promosi" /></Field>
              <Field label="Jenis materi" id="material-type"><select id="material-type" value={materialType} onChange={(event) => setMaterialType(event.target.value)} className="form-control"><option value="TEXT">Teks</option><option value="VIDEO">Video</option><option value="LINK">Tautan</option><option value="DOC">Dokumen</option></select></Field>
              <Field label="Isi atau deskripsi" id="material-content"><textarea id="material-content" value={materialContent} onChange={(event) => setMaterialContent(event.target.value)} className="form-control min-h-28 resize-y" placeholder="Tuliskan ringkasan dan petunjuk belajar..." /></Field>
              <Field label="Tautan sumber (opsional)" id="material-url"><input id="material-url" type="url" value={materialUrl} onChange={(event) => setMaterialUrl(event.target.value)} className="form-control" placeholder="https://..." /></Field>
              <button disabled={saving || !materialCourseId || !materialLessonId} className="bg-sunrise flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} Publikasikan Materi</button>
            </form>
            <ContentList loading={loading} empty="Belum ada materi yang Anda buat.">
              {materials.map((material) => <article key={material.id} className="rounded-xl border border-[#DDEBE8] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">{material.course.code} · {materialKind(material)}</p><h3 className="mt-1 font-bold text-[#1F2937]">{material.title}</h3></div><BookOpen className="text-orange-500" size={20} /></div>{material.content && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#64748B]">{material.content}</p>}{material.fileUrl && <a href={material.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-orange-600 hover:underline">Buka sumber →</a>}</article>)}
            </ContentList>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <form onSubmit={createAssignment} className="h-fit space-y-4 rounded-2xl border border-[#DDEBE8] bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#1F2937]"><ClipboardPlus size={20} className="text-orange-600" /> Buat Tugas</h3>
              <Field label="Mata pelajaran" id="assignment-course"><select id="assignment-course" required value={assignmentCourseId} onChange={(event) => { const courseId = event.target.value; setAssignmentCourseId(courseId); setAssignmentModuleId(learningTree.find((course) => course.id === courseId)?.modules[0]?.id || ""); }} className="form-control">{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></Field>
              <Field label="Modul tugas" id="assignment-module"><select id="assignment-module" required value={assignmentModuleId} onChange={(event) => setAssignmentModuleId(event.target.value)} className="form-control"><option value="">Pilih modul</option>{assignmentModules.map((module) => <option key={module.id} value={module.id}>Modul {module.position} · {module.title}</option>)}</select></Field>
              <Field label="Judul tugas" id="assignment-title"><input id="assignment-title" required minLength={3} maxLength={160} value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} className="form-control" placeholder="Contoh: Video promosi produk lokal" /></Field>
              <Field label="Instruksi" id="assignment-description"><textarea id="assignment-description" value={assignmentDescription} onChange={(event) => setAssignmentDescription(event.target.value)} className="form-control min-h-24 resize-y" placeholder="Jelaskan hasil yang perlu dikumpulkan..." /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Jenis tugas" id="assignment-type"><select id="assignment-type" value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)} className="form-control"><option value="AFFILIATE">Affiliate</option><option value="STORE">Student Store</option><option value="WRITTEN">Tertulis</option><option value="PROJECT">Proyek</option><option value="QUIZ">Kuis</option></select></Field><Field label="Nilai maksimal" id="assignment-score"><input id="assignment-score" type="number" min={1} max={1000} value={assignmentMaxScore} onChange={(event) => setAssignmentMaxScore(Number(event.target.value))} className="form-control" /></Field></div>
              <Field label="Rubrik penilaian (opsional)" id="assignment-rubric"><select id="assignment-rubric" value={assignmentRubricId} onChange={(event) => setAssignmentRubricId(event.target.value)} className="form-control"><option value="">Tanpa rubrik</option>{rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{rubric.name}</option>)}</select></Field>
              {assignmentType === "STORE" && <Field label="Checklist toko" id="assignment-checklist"><select id="assignment-checklist" required value={assignmentChecklistId} onChange={(event) => setAssignmentChecklistId(event.target.value)} className="form-control"><option value="">Pilih checklist</option>{checklists.map((checklist) => <option key={checklist.id} value={checklist.id}>{checklist.name} · min. {checklist.minimumProducts} produk</option>)}</select></Field>}
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Mulai" id="assignment-start"><input id="assignment-start" type="datetime-local" required value={assignmentStart} onChange={(event) => setAssignmentStart(event.target.value)} className="form-control" /></Field><Field label="Deadline" id="assignment-end"><input id="assignment-end" type="datetime-local" required value={assignmentEnd} onChange={(event) => setAssignmentEnd(event.target.value)} className="form-control" /></Field></div>
              <label className="flex items-center gap-3 rounded-xl bg-[#FFFFFF] p-3 text-sm text-slate-700"><input type="checkbox" checked={assignmentPublished} onChange={(event) => setAssignmentPublished(event.target.checked)} className="size-4" /> Publikasikan langsung kepada siswa</label>
              <button disabled={saving || !assignmentCourseId || !assignmentModuleId} className="bg-sunrise flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <ClipboardPlus size={18} />} {assignmentPublished ? "Publikasikan Tugas" : "Simpan Draf"}</button>
            </form>
            <ContentList loading={loading} empty="Belum ada tugas yang Anda buat.">
              {assignments.map((assignment) => <article key={assignment.id} className="rounded-xl border border-[#DDEBE8] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">{assignment.course.code} · {assignment.type}</p><h3 className="mt-1 font-bold text-[#1F2937]">{assignment.title}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${assignment.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{assignment.isActive ? "Terbit" : "Draf"}</span></div>{assignment.description && <p className="mt-3 text-sm leading-6 text-[#64748B]">{assignment.description}</p>}<div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500"><span>Deadline {new Date(assignment.endDate).toLocaleString("id-ID")}</span><span>Nilai {assignment.maxScore}</span><span>{assignment._count?.submissions || 0} pengumpulan</span></div></article>)}
            </ContentList>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1 block text-xs font-bold text-[#1F2937]">{label}</label>{children}</div>;
}

function ContentList({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  if (loading) return <div className="rounded-xl border border-[#DDEBE8] bg-white p-8 text-sm font-semibold text-orange-600">Memuat data...</div>;
  if (!Array.isArray(children) || children.length === 0) return <div className="rounded-xl border border-[#DDEBE8] bg-white p-8 text-center text-sm text-[#64748B]">{empty}</div>;
  return <div className="grid content-start gap-4">{children}</div>;
}
