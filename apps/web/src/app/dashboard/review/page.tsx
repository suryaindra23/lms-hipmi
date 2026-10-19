"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Eye } from "lucide-react";

export default function ReviewQueuePage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch("/api/backend/submissions?status=SUBMITTED");
        const data = await res.json();
        setSubmissions(data.data || []);
      } catch (err) {
        console.error("Gagal ambil antrean review", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, []);

  return (
    <div className="p-8 bg-[#FFFFFF] min-h-screen">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Antrean Penilaian Tugas</h2>

      {loading ? (
        <div className="text-[#377C78] font-semibold">Memuat antrean...</div>
      ) : (
        <div className="grid gap-4">
          {submissions.length === 0 ? (
            <div className="p-8 bg-white border rounded-xl text-center text-[#64748B]">
              Tidak ada tugas yang menunggu penilaian.
            </div>
          ) : (
            submissions.map((sub) => (
              <div key={sub.id} className="p-6 bg-white rounded-xl border border-[#DDEBE8] shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-[#1F2937]">{sub.assignment.title}</h3>
                  <p className="text-sm text-[#64748B] mt-1">Siswa: {sub.student.fullName} ({sub.student.studentNumber})</p>
                  <div className="flex gap-4 mt-3 text-xs text-[#286864] font-semibold">
                    <span className="flex items-center gap-1"><Clock size={14}/> Dikumpul: {new Date(sub.createdAt).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
                <Link
                  href={`/dashboard/review/${sub.id}`}
                  className="px-5 py-2.5 bg-[#377C78] text-white rounded-lg font-semibold hover:bg-[#286864] transition-colors flex items-center gap-2"
                >
                  <Eye size={18} /> Review
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
