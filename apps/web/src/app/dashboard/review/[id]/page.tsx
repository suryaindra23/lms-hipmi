"use client";

import { useCallback, useEffect, useState, use } from "react";
import { CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrf";

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [submission, setSubmission] = useState<any>(null);
  const [score, setScore] = useState<number>(100);
  const [feedback, setFeedback] = useState("");
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"APPROVED" | "REVISION_REQUIRED" | "REJECTED">("APPROVED");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await fetch(`/api/backend/submissions/${id}`);
      const data = await res.json();
      setSubmission(data);
      const latestAiAssessment = data.aiAssessments?.[0] || null;
      setAiAssessment(latestAiAssessment);
      if (latestAiAssessment) {
        setScore(latestAiAssessment.totalScore);
        setFeedback(latestAiAssessment.feedback || "");
        setRubricScores(Object.fromEntries(latestAiAssessment.scores.map((item: any) => [item.criterionId, item.score])));
      } else {
        if (data.score) setScore(data.score);
        if (data.feedback) setFeedback(data.feedback);
        if (data.assignment?.rubric?.criteria?.length) setRubricScores(Object.fromEntries(data.assignment.rubric.criteria.map((criterion: any) => [criterion.id, criterion.maxScore])));
      }
    } catch (err) {
      console.error("Gagal ambil detail submission", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const createAiRecommendation = async () => {
    setAiBusy(true); setError("");
    try {
      const res = await csrfFetch(`/api/backend/submissions/${id}/ai-assessment`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Rekomendasi AI belum dapat dibuat");
      setAiAssessment(data);
      setScore(data.totalScore);
      setFeedback(data.feedback || "");
      setRubricScores(Object.fromEntries(data.scores.map((item: any) => [item.criterionId, item.score])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rekomendasi AI belum dapat dibuat");
    } finally { setAiBusy(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const res = await csrfFetch(`/api/backend/submissions/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: Number(score), feedback, status,
          ...(submission.assignment.rubric?.criteria?.length ? { scores: submission.assignment.rubric.criteria.map((criterion: any) => ({ criterionId: criterion.id, score: Number(rubricScores[criterion.id] || 0) })) } : {}),
        }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan penilaian");
      setSuccess(true);
      setTimeout(() => {
        router.replace("/dashboard/review");
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#FFFFFF] min-h-screen">
        <div className="text-[#377C78] font-semibold">Memuat detail tugas...</div>
      </div>
    );
  }

  if (!submission) return <div className="p-8 text-red-600">Submission tidak ditemukan</div>;

  return (
    <div className="p-8 bg-[#FFFFFF] min-h-screen max-w-4xl">
      <Link href="/dashboard/review" className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1F2937] mb-6">
        <ArrowLeft size={16} /> Kembali ke Antrean
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Detail Pengumpulan */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[#DDEBE8] p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#1F2937] mb-2">{submission.assignment.title}</h2>
            <p className="text-sm text-[#64748B] mb-4">Siswa: {submission.student.fullName}</p>

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-sm text-[#1F2937]">Detail Video Affiliate:</h4>
              {submission.affiliateVideos?.map((v: any) => (
                <div key={v.id} className="p-4 bg-[#FFFFFF] rounded-lg border border-[#DDEBE8] text-sm space-y-2">
                  <p>Platform: <span className="font-bold">{v.platform}</span></p>
                  <p>URL Video: <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[#377C78] hover:underline break-all">{v.videoUrl}</a></p>
                  <p>Produk: <span className="font-semibold">{v.productName || "-"}</span></p>
                  {v.productUrl && <p>Link Produk: <a href={v.productUrl} target="_blank" rel="noopener noreferrer" className="text-[#377C78] hover:underline break-all">{v.productUrl}</a></p>}
                  {v.campaignName && <p>Campaign: <span className="font-semibold">{v.campaignName}</span></p>}
                  {v.hook && <p>Hook: <span className="font-semibold">{v.hook}</span></p>}
                  {v.caption && <p>Caption: <span className="font-semibold">{v.caption}</span></p>}
                  {v.evidenceUrl && <p>Bukti publikasi: <a href={v.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-[#377C78] hover:underline break-all">Buka bukti</a></p>}
                  {v.insightsEvidenceUrl && <p>Bukti insight: <a href={v.insightsEvidenceUrl} target="_blank" rel="noopener noreferrer" className="text-[#377C78] hover:underline break-all">Buka insight</a></p>}
                  <p>Versi konten: <span className="font-semibold">{v.currentVersion}</span> · Status bukti: <span className="font-semibold">{v.verification}</span></p>
                  {v.metricSnapshots?.length > 0 && <div className="mt-3 rounded-lg bg-white p-3"><p className="font-semibold">Snapshot metrik terbaru</p>{v.metricSnapshots.map((metric: any) => <p key={metric.id} className="mt-1 text-xs">{new Date(metric.snapshotDate).toLocaleDateString("id-ID")}: {metric.views} views · {metric.clicks} klik · {metric.orders} pesanan · {metric.verification}</p>)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Penilaian */}
        <div className="bg-white rounded-xl border border-[#DDEBE8] p-6 shadow-sm h-fit">
          <h3 className="font-bold text-lg text-[#1F2937] mb-4">Penilaian Guru</h3>

          {success && (
            <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2 text-sm text-green-600 mb-4">
              <CheckCircle size={18} /> <span>Penilaian berhasil disimpan!</span>
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600 mb-4">
              <AlertCircle size={18} /> <span>{error}</span>
            </div>
          )}

          <section className="mb-5 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
            <div className="flex items-center justify-between gap-3"><div><p className="font-bold">Rekomendasi AI</p><p className="mt-1 text-xs text-violet-800">AI menilai isi teks sesuai rubrik. Guru tetap menentukan nilai resmi.</p></div><button type="button" onClick={() => void createAiRecommendation()} disabled={aiBusy} className="shrink-0 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{aiBusy ? "Menilai..." : "Buat rekomendasi AI"}</button></div>
            {aiAssessment && <div className="mt-3 border-t border-violet-200 pt-3"><p className="font-semibold">Rekomendasi: {aiAssessment.totalScore}/{submission.assignment.maxScore}</p>{aiAssessment.insufficientEvidence && <p className="mt-1 text-xs font-semibold text-amber-800">Bukti teks belum cukup — periksa file atau tautan secara manual.</p>}<ul className="mt-2 space-y-1 text-xs">{aiAssessment.scores.map((item: any) => <li key={item.id}>• {item.criterion.name}: {item.score}/{item.criterion.maxScore} — {item.reason}</li>)}</ul><p className="mt-2 text-xs text-violet-900">{aiAssessment.feedback}</p></div>}
          </section>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="review-status" className="block text-xs font-semibold text-[#1F2937] mb-1">Status Kelulusan</label>
              <select
                id="review-status"
                className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
              >
                <option value="APPROVED">Setujui (Approved)</option>
                <option value="REVISION_REQUIRED">Butuh Revisi</option>
                <option value="REJECTED">Tolak (Rejected)</option>
              </select>
            </div>

            {submission.assignment.rubric?.criteria?.length ? <div className="space-y-3">
              <p className="text-xs font-semibold text-[#1F2937]">Rubrik: {submission.assignment.rubric.name}</p>
              {submission.assignment.rubric.criteria.map((criterion: any) => <label key={criterion.id} className="block text-xs font-semibold text-[#1F2937]">{criterion.name} <span className="font-normal text-slate-500">({criterion.weight}%)</span><input type="number" min={0} max={criterion.maxScore} required value={rubricScores[criterion.id] ?? 0} onChange={(e) => setRubricScores({ ...rubricScores, [criterion.id]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"/></label>)}
            </div> : <div>
              <label htmlFor="review-score" className="block text-xs font-semibold text-[#1F2937] mb-1">Nilai Tugas (Max {submission.assignment.maxScore})</label>
              <input
                id="review-score"
                type="number"
                max={submission.assignment.maxScore}
                min={0}
                required
                className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </div>}

            <div>
              <label htmlFor="review-feedback" className="block text-xs font-semibold text-[#1F2937] mb-1">Feedback Guru</label>
              <textarea
                id="review-feedback"
                required
                placeholder="Tulis umpan balik..."
                className="w-full rounded-lg border border-[#64748B]/30 px-3 py-2 text-sm focus:border-[#377C78] focus:outline-none h-24 resize-none"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || success}
              className="w-full py-2.5 bg-gradient-to-r from-[#FBBF24] to-[#377C78] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Menyimpan..." : "Simpan Nilai"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
