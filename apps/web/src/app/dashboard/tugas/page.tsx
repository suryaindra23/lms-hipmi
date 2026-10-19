"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, BookOpen, CheckCircle, ChevronLeft, ChevronRight, Clock, Download, Presentation, X } from "lucide-react";
import TeacherLearningManager from "@/components/dashboard/TeacherLearningManager";
import { csrfFetch } from "@/lib/csrf";
import Link from "next/link";

function materialKind(material: { type: string; originalFileName?: string | null }) {
  return material.originalFileName?.toLowerCase().endsWith(".pptx") ? "PPTX" : material.type;
}

type LearningMaterial = {
  id: string;
  lessonId?: string | null;
  title: string;
  type: string;
  content?: string | null;
  fileUrl?: string | null;
  originalFileName?: string | null;
  course?: { code?: string };
};

type MaterialViewer = {
  material: LearningMaterial;
  slide: number;
  totalSlides: number;
  furthestSlide: number;
};

function pptxPreviewPath(material: LearningMaterial, slide: number) {
  return `/api/materials/${encodeURIComponent(material.id)}?slide=${slide}`;
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [learningTree, setLearningTree] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [platform, setPlatform] = useState("TIKTOK");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [viewer, setViewer] = useState<MaterialViewer | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState("");
  const [materialOpeningId, setMaterialOpeningId] = useState("");

  const fetchAssignments = useCallback(async () => {
    try {
      const [assignmentResponse, materialResponse, treeResponse] = await Promise.all([
        fetch("/api/backend/assignments"),
        fetch("/api/backend/learning/materials"),
        fetch("/api/backend/learning/tree"),
      ]);
      if (!assignmentResponse.ok || !materialResponse.ok || !treeResponse.ok) throw new Error("Materi dan tugas belum dapat dimuat");
      const [assignmentData, materialData, treeData] = await Promise.all([assignmentResponse.json(), materialResponse.json(), treeResponse.json()]);
      setAssignments(assignmentData.data || []);
      setMaterials(Array.isArray(materialData) ? materialData : []);
      setLearningTree(Array.isArray(treeData) ? treeData : []);
    } catch (err) {
      console.error("Gagal ambil tugas", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => {
        if (!response.ok) throw new Error("Sesi tidak valid");
        return response.json();
      })
      .then((session) => {
        setProfile(session);
        if (session.roles?.includes("student")) {
          void fetchAssignments();
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [fetchAssignments]);

  useEffect(() => {
    if (!viewer) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewer(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [viewer]);

  const lessonProgress = (lessonId?: string | null) => {
    if (!lessonId) return null;
    for (const course of learningTree) {
      for (const courseModule of course.modules || []) {
        const lesson = courseModule.lessons?.find((item: any) => item.id === lessonId);
        if (lesson) return lesson.progress?.[0] || null;
      }
    }
    return null;
  };

  const applyLocalProgress = (lessonId: string, progressPercent: number, lastPosition: number, state: string) => {
    setLearningTree((courses) => courses.map((course: any) => ({
      ...course,
      modules: course.modules?.map((courseModule: any) => ({
        ...courseModule,
        lessons: courseModule.lessons?.map((lesson: any) => {
          if (lesson.id !== lessonId) return lesson;
          const current = lesson.progress?.[0] || {};
          const nextProgress = Math.max(Number(current.progressPercent || 0), progressPercent);
          const nextPosition = Math.max(Number(current.lastPosition || 0), lastPosition);
          const nextState = current.state === "COMPLETED" || state === "COMPLETED" ? "COMPLETED" : state;
          return { ...lesson, progress: [{ ...current, progressPercent: nextProgress, lastPosition: nextPosition, state: nextState }] };
        }),
      })),
    })));
  };

  const saveSlideProgress = async (lessonId: string, materialId: string, position: number, totalSlides: number) => {
    const progressPercent = Math.round(position / totalSlides * 100);
    const state = position >= totalSlides ? "COMPLETED" : "IN_PROGRESS";
    setProgressSaving(true);
    setProgressError("");
    try {
      const response = await csrfFetch(`/api/backend/learning/lessons/${lessonId}/progress`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, progressPercent, lastPosition: position, materialId }),
      });
      if (!response.ok) throw new Error("Progres belum dapat disimpan. Coba kembali beberapa saat lagi.");
      applyLocalProgress(lessonId, progressPercent, position, state);
    } catch (reason) {
      setProgressError(reason instanceof Error ? reason.message : "Progres belum dapat disimpan.");
    } finally {
      setProgressSaving(false);
    }
  };

  const openMaterial = async (material: LearningMaterial) => {
    if (!material.lessonId || materialKind(material) !== "PPTX") return;
    setMaterialOpeningId(material.id);
    setProgressError("");
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(material.id)}`, { cache: "no-store" });
      const metadata = await response.json().catch(() => null) as { slideCount?: number; message?: string } | null;
      if (!response.ok || !metadata?.slideCount) throw new Error(metadata?.message || "Preview materi belum tersedia.");
      const saved = lessonProgress(material.lessonId);
      const savedPosition = Math.max(
        Number(saved?.lastPosition || 0),
        Math.ceil(Number(saved?.progressPercent || 0) / (100 / metadata.slideCount)),
        1,
      );
      const slide = Math.min(savedPosition, metadata.slideCount);
      setViewer({ material, slide, totalSlides: metadata.slideCount, furthestSlide: slide });
      if (!saved?.progressPercent) void saveSlideProgress(material.lessonId, material.id, slide, metadata.slideCount);
    } catch (reason) {
      setProgressError(reason instanceof Error ? reason.message : "Preview materi belum tersedia.");
    } finally {
      setMaterialOpeningId("");
    }
  };

  const changeViewerSlide = (nextSlide: number) => {
    if (!viewer || !viewer.material.lessonId) return;
    const slide = Math.min(Math.max(nextSlide, 1), viewer.totalSlides);
    const furthestSlide = Math.max(viewer.furthestSlide, slide);
    setViewer({ ...viewer, slide, furthestSlide });
    if (furthestSlide > viewer.furthestSlide) {
      void saveSlideProgress(viewer.material.lessonId, viewer.material.id, furthestSlide, viewer.totalSlides);
    }
  };

  if (loading) {
    return <div className="mx-auto min-h-screen max-w-[1500px] p-4 font-semibold text-orange-700 sm:p-6 lg:p-8">Memuat materi dan tugas…</div>;
  }

  if (profile?.roles?.includes("teacher")) {
    return <TeacherLearningManager />;
  }

  if (!profile?.roles?.includes("student")) {
    return <div className="mx-auto min-h-screen max-w-[1500px] p-4 sm:p-6 lg:p-8"><div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Halaman ini tersedia untuk guru dan murid.</div></div>;
  }

  const handleOpenModal = (assignment: any) => {
    setSelectedAssignment(assignment);
    setError("");
    setSuccess(false);
    setVideoUrl("");
    setPlatform("TIKTOK");
    setProductName("");
    setProductUrl("");
    setNotes("");
  };

  const handleCloseModal = () => {
    setSelectedAssignment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      // 1. Buat Draft / Update Submission
      const subRes = await csrfFetch("/api/backend/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          content: selectedAssignment.type === "AFFILIATE" ? undefined : notes,
          notes,
        }),
      });

      const subData = await subRes.json();
      if (!subRes.ok) throw new Error(subData.message || "Gagal membuat draf pengumpulan");

      if (selectedAssignment.type === "AFFILIATE") {
        const videoRes = await csrfFetch(`/api/backend/submissions/${subData.id}/videos`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, videoUrl, publishedAt: new Date().toISOString(), productName, productUrl }),
        });
        const videoData = await videoRes.json();
        if (!videoRes.ok) throw new Error(videoData.message || "Tautan video duplikat atau format salah");
      }

      // 3. Final Submit Tugas
      const finalRes = await csrfFetch(`/api/backend/submissions/${subData.id}/submit`, {
        method: "POST",
      });

      if (!finalRes.ok) throw new Error("Gagal melakukan submit final");

      setSuccess(true);
      setTimeout(() => {
        handleCloseModal();
        fetchAssignments(); // Refresh list tugas
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pengumpulan belum dapat diproses");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <div className="mb-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-700">Ruang belajar</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Materi & Tugas</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Ikuti jalur belajar secara berurutan, pahami materinya, lalu kumpulkan tugas sebelum tenggat.</p>
      </div>

      <section className="mb-8" aria-labelledby="learning-path-heading">
        <h3 id="learning-path-heading" className="mb-4 text-lg font-bold text-[#1F2937]">Jalur Belajar & Progres</h3>
        <div className="grid gap-4">
          {learningTree.map((course) => (
            <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-bold uppercase text-orange-600">{course.program?.name || "Program belajar"} · {course.code}</p>
              <h4 className="mt-1 font-bold text-slate-800">{course.name}</h4>
              <div className="mt-3 space-y-3">
                {course.modules?.map((courseModule: any) => (
                  <div key={courseModule.id} className={`rounded-xl p-3 sm:p-4 ${courseModule.locked ? "border border-slate-200 bg-slate-50" : "bg-orange-50/60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-700">Modul {courseModule.position} · {courseModule.title}</p>
                      {courseModule.locked && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">Terkunci · {courseModule.minimumPlan}</span>}
                    </div>
                    {courseModule.locked ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                        <span>{courseModule.lockReason === "PLAN_MODULE_LIMIT" ? "Batas modul paket aktif telah tercapai." : `Modul ini memerlukan paket ${courseModule.minimumPlan}.`}</span>
                        <Link href="/paket" className="rounded-lg bg-orange-600 px-3 py-2 font-bold text-white">Lihat paket</Link>
                      </div>
                    ) : courseModule.lessons?.map((lesson: any) => {
                      const progress = lesson.progress?.[0];
                      const progressPercent = Number(progress?.progressPercent || 0);
                      return (
                        <div key={lesson.id} className="mt-2 rounded-lg bg-white/80 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-slate-700">{progress?.state === "COMPLETED" ? "✓" : "○"} {lesson.title} <span className="text-xs text-slate-400">· {lesson.estimatedMinutes || "—"} menit</span></span>
                            <span className="text-xs font-bold text-orange-700">{progressPercent}% dipelajari</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-100" aria-label={`Progres ${lesson.title} ${progressPercent}%`}>
                            <div className="h-full rounded-full bg-orange-500 transition-[width]" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8" aria-labelledby="student-materials-heading">
        <h3 id="student-materials-heading" className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1F2937]"><BookOpen size={20} className="text-orange-600" /> Materi Belajar</h3>
        {materials.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-[#64748B]">Belum ada materi yang dipublikasikan.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {materials.map((material) => {
              const progress = lessonProgress(material.lessonId);
              const progressPercent = Number(progress?.progressPercent || 0);
              const previewable = materialKind(material) === "PPTX" && Boolean(material.lessonId && material.originalFileName);
              return (
                <article key={material.id} className="flex flex-col rounded-2xl border border-[#DDEBE8] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-orange-600">{material.course?.code} · {materialKind(material)}</p>
                      <h4 className="mt-1 font-bold text-[#1F2937]">{material.title}</h4>
                    </div>
                    {previewable && <Presentation className="shrink-0 text-orange-500" size={22} aria-hidden="true" />}
                  </div>
                  {material.content && <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#64748B]">{material.content}</p>}
                  {previewable && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-500">Progres membaca</span><span className="font-bold text-orange-700">{progressPercent}%</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-orange-500 transition-[width]" style={{ width: `${progressPercent}%` }} /></div>
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    {previewable ? (
                      <button type="button" onClick={() => void openMaterial(material)} disabled={materialOpeningId === material.id} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60">
                        <BookOpen size={17} /> {materialOpeningId === material.id ? "Menyiapkan…" : progressPercent > 0 ? "Lanjutkan materi" : "Lihat materi"}
                      </button>
                    ) : material.fileUrl ? (
                      <a href={material.fileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-bold text-white">Buka materi</a>
                    ) : null}
                    {materialKind(material) === "PPTX" && <a href={`/api/materials/${encodeURIComponent(material.id)}?download=1`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 px-3 text-sm font-bold text-orange-700 hover:bg-orange-50"><Download size={16} /> Unduh</a>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <h3 className="mb-4 text-lg font-bold text-[#1F2937]">Daftar Tugas Praktik</h3>

      {(
        <div className="grid gap-4">
          {assignments.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-[#64748B]">Belum ada tugas aktif yang tersedia.</div>
          ) : (
            assignments.map((a) => (
              <article key={a.id} className="flex flex-col items-stretch justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-[#1F2937]">{a.title}</h3>
                  <p className="text-sm text-[#64748B] mt-1">{a.description}</p>
                  <div className="flex gap-4 mt-3 text-xs text-[#286864] font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> Deadline: {new Date(a.endDate).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                </div>
                {a.type === "STORE" ? <Link href={`/dashboard/toko?assignmentId=${a.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#FBBF24] to-[#377C78] px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90">Buka Student Store</Link> : a.type === "AFFILIATE" ? <Link href={`/dashboard/affiliate?assignmentId=${a.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#FBBF24] to-[#377C78] px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90">Buka Affiliate</Link> : <button onClick={() => handleOpenModal(a)} className="min-h-11 shrink-0 rounded-xl bg-gradient-to-r from-[#FBBF24] to-[#377C78] px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90">Kumpulkan</button>}
              </article>
            ))
          )}
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="material-viewer-title">
          <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Materi langsung · Slide {viewer.slide} dari {viewer.totalSlides}</p>
                <h3 id="material-viewer-title" className="truncate text-base font-extrabold text-slate-900 sm:text-lg">{viewer.material.title}</h3>
              </div>
              <button type="button" onClick={() => setViewer(null)} aria-label="Tutup materi" className="grid size-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X size={21} /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">
              <div className="mx-auto max-w-5xl overflow-hidden rounded-xl bg-white shadow-lg">
                <Image
                  key={`${viewer.material.id}-${viewer.slide}`}
                  src={pptxPreviewPath(viewer.material, viewer.slide)}
                  alt={`Slide ${viewer.slide} dari ${viewer.material.title}`}
                  width={1280}
                  height={720}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
            </div>

            <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-500">{progressSaving ? "Menyimpan progres…" : `Progres tersimpan ${Math.round(viewer.furthestSlide / viewer.totalSlides * 100)}%`}</span>
                {progressError && <span role="alert" className="text-right font-semibold text-red-600">{progressError}</span>}
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500 transition-[width]" style={{ width: `${viewer.furthestSlide / viewer.totalSlides * 100}%` }} /></div>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => changeViewerSlide(viewer.slide - 1)} disabled={viewer.slide === 1} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={18} /> Sebelumnya</button>
                <div className="hidden items-center gap-1.5 sm:flex" aria-label="Posisi slide">
                  {Array.from({ length: viewer.totalSlides }, (_, index) => index + 1).map((slide) => {
                    const unavailable = slide > viewer.furthestSlide + 1;
                    return <button type="button" key={slide} onClick={() => changeViewerSlide(slide)} disabled={unavailable} aria-current={slide === viewer.slide ? "step" : undefined} aria-label={`Buka slide ${slide}`} className={`size-2.5 rounded-full ${slide === viewer.slide ? "bg-orange-600" : slide <= viewer.furthestSlide ? "bg-orange-300" : "bg-slate-200"} disabled:cursor-not-allowed`} />;
                  })}
                </div>
                {viewer.slide < viewer.totalSlides ? (
                  <button type="button" onClick={() => changeViewerSlide(viewer.slide + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700">Berikutnya <ChevronRight size={18} /></button>
                ) : (
                  <button type="button" onClick={() => setViewer(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><CheckCircle size={18} /> Selesai</button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Form Pengumpulan */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#DDEBE8] relative">
            <button
              type="button"
              aria-label="Tutup formulir pengumpulan"
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-gray-100 text-[#64748B]"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-[#1F2937] mb-2">Kumpulkan Tugas</h3>
            <p className="text-sm text-[#64748B] mb-6">{selectedAssignment.title}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle size={18} />
                  <span>Tugas berhasil dikumpulkan!</span>
                </div>
              )}

              {selectedAssignment.type === "AFFILIATE" && <><div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="submission-platform" className="block text-xs font-semibold text-[#1F2937] mb-1">Platform Video</label>
                  <select
                    id="submission-platform"
                    className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option value="TIKTOK">TikTok</option>
                    <option value="SHOPEE">Shopee Video</option>
                    <option value="INSTAGRAM">Instagram Reels</option>
                    <option value="YOUTUBE">YouTube Shorts</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="submission-video-url" className="block text-xs font-semibold text-[#1F2937] mb-1">Tautan Video</label>
                  <input
                    id="submission-video-url"
                    type="url"
                    required
                    placeholder="https://tiktok.com/..."
                    className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="submission-product-name" className="block text-xs font-semibold text-[#1F2937] mb-1">Nama Produk Terkait</label>
                  <input
                    id="submission-product-name"
                    type="text"
                    placeholder="Contoh: Kemeja Flanel Uniqlo"
                    className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="submission-product-url" className="block text-xs font-semibold text-[#1F2937] mb-1">Tautan Keranjang/Produk</label>
                  <input
                    id="submission-product-url"
                    type="url"
                    placeholder="https://shopee.co.id/..."
                    className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                  />
                </div>
              </div></>}

              <div>
                <label htmlFor="submission-notes" className="block text-xs font-semibold text-[#1F2937] mb-1">{selectedAssignment.type === "AFFILIATE" ? "Catatan Tambahan (Opsional)" : "Jawaban / hasil tugas"}</label>
                <textarea
                  id="submission-notes"
                  required={selectedAssignment.type !== "AFFILIATE"}
                  placeholder={selectedAssignment.type === "AFFILIATE" ? "Tulis catatan jika ada..." : "Tuliskan jawaban, hasil, atau tautan pendukung..."}
                  className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none h-20 resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-gray-50 text-[#64748B]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || success}
                  className="px-5 py-2 bg-gradient-to-r from-[#FBBF24] to-[#377C78] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Mengirim..." : "Kumpulkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
