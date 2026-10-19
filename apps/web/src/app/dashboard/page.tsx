"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  MousePointerClick,
  RefreshCw,
  School,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type Metric = { key: string; count: number };
type TrendPoint = { date: string; views: number; clicks: number; orders: number };
type Warning = {
  id: string;
  studentId: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  triggeredAt: string;
};
type StudentActivity = {
  id: string;
  fullName: string;
  studentNumber: string;
  className: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  submissionCompleted: number;
  warningCount: number;
  lastActivity: string | null;
};
type StudentLearningDetail = {
  student: { id: string; fullName: string; studentNumber: string; schoolName: string; className: string };
  modules: Array<{
    id: string;
    title: string;
    position: number;
    course: { id: string; code: string; name: string };
    lessons: Array<{
      id: string;
      title: string;
      position: number;
      estimatedMinutes: number | null;
      progress: { state: string; progressPercent: number; lastPosition: number | null; updatedAt: string | null };
    }>;
  }>;
};
type SchoolComparison = {
  schoolId: string;
  schoolName: string;
  studentCount: number;
  activeRate: number;
  averageProgress: number;
  approvedSubmissionRate: number;
};
type Overview = {
  audience: "STUDENT" | "PARENT" | "TEACHER" | "SCHOOL" | "PROGRAM";
  period: { days: number; start: string; end: string; timezone: string };
  lastUpdated: string;
  definitions: Record<string, string>;
  kpi: Record<string, number | null>;
  distributions: {
    submissions: Metric[];
    stores: Metric[];
    storePlatforms: Metric[];
    affiliateContent: Metric[];
    warnings: Metric[];
    grades: Metric[];
    imports: Metric[];
    identityVerification: Metric[];
  };
  trends: { affiliate: TrendPoint[] };
  warnings: Warning[];
  students: StudentActivity[];
  schools: SchoolComparison[];
};

type BasicDashboardData = {
  studentInfo?: { fullName: string; className: string };
  kpi?: {
    views?: number;
    clicks?: number;
    orders?: number;
    totalStudents?: number;
    pendingReviewsCount?: number;
    activeAssignmentsCount?: number;
  };
  stats?: { totalStudents?: number; totalTeachers?: number; totalClasses?: number };
  activeAssignmentsCount?: number;
  pendingTasksCount?: number;
  recentVideosCount?: number;
};

type SessionProfile = {
  roles: string[];
  schoolId?: string | null;
  permissions: Array<{ resource: string; action: string }>;
};

type EffectiveAccess = {
  entitlements?: Record<string, unknown>;
};

const audienceCopy = {
  STUDENT: { title: "Ringkasan perkembangan saya", subtitle: "Pantau pembelajaran, tugas praktik, dan performa affiliate dari data terbaru." },
  PARENT: { title: "Perkembangan anak terhubung", subtitle: "Informasi aman untuk mendampingi progres belajar tanpa menampilkan data sensitif." },
  TEACHER: { title: "Monitoring kelas dan pendampingan", subtitle: "Temukan antrean kerja, progres siswa, serta sinyal yang membutuhkan perhatian." },
  SCHOOL: { title: "Kinerja program sekolah", subtitle: "Pantau adopsi, penyelesaian tugas, praktik digital, dan kualitas data sekolah." },
  PROGRAM: { title: "Monitoring program lintas sekolah", subtitle: "Lihat agregat partisipasi dan hasil program sesuai ruang lingkup organisasi." },
};

function valueOf(kpi: Overview["kpi"], key: string) {
  return Number(kpi[key] || 0);
}

function percent(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function number(value: number) {
  return new Intl.NumberFormat("id-ID", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Belum ada aktivitas";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function dashboardAudience(session: SessionProfile): Overview["audience"] {
  const roles = Array.isArray(session.roles) ? session.roles : [];
  if (roles.includes("student")) return "STUDENT";
  if (roles.includes("parent")) return "PARENT";
  if (roles.includes("teacher")) return "TEACHER";
  if (roles.some((role) => ["school-admin", "principal"].includes(role))) return "SCHOOL";
  return "PROGRAM";
}

async function loadBasicDashboard(session: SessionProfile) {
  const audience = dashboardAudience(session);
  const endpoint = audience === "STUDENT"
    ? "/api/backend/dashboard/student"
    : audience === "TEACHER"
      ? "/api/backend/dashboard/teacher"
      : session.schoolId
        ? "/api/backend/dashboard/school"
        : null;
  let data: BasicDashboardData | null = null;
  if (endpoint) {
    const basicResponse = await fetch(endpoint, { cache: "no-store" });
    if (basicResponse.ok) data = await basicResponse.json() as BasicDashboardData;
  }
  return { audience, data };
}

function MetricCard({ label, value, helper, icon: Icon, tone = "orange" }: { label: string; value: string; helper: string; icon: typeof Users; tone?: "orange" | "blue" | "green" | "amber" }) {
  const tones = {
    orange: { icon: "bg-orange-50 text-orange-700", line: "bg-orange-500" },
    blue: { icon: "bg-blue-50 text-blue-700", line: "bg-blue-500" },
    green: { icon: "bg-emerald-50 text-emerald-700", line: "bg-emerald-500" },
    amber: { icon: "bg-amber-50 text-amber-700", line: "bg-amber-500" },
  };
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={`absolute inset-x-0 top-0 h-1 ${tones[tone].line}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`rounded-xl p-3 ${tones[tone].icon}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

const actionsByAudience: Record<Overview["audience"], Array<{ href: string; label: string; helper: string; icon: typeof Users; tone: string }>> = {
  STUDENT: [
    { href: "/dashboard/tugas", label: "Lanjut belajar", helper: "Buka materi dan tugas", icon: BookOpenCheck, tone: "bg-blue-50 text-blue-700" },
    { href: "/dashboard/toko", label: "Kelola toko", helper: "Lengkapi praktik tokomu", icon: ShoppingBag, tone: "bg-orange-50 text-orange-700" },
    { href: "/dashboard/affiliate", label: "Cek affiliate", helper: "Lihat konten dan performa", icon: MousePointerClick, tone: "bg-emerald-50 text-emerald-700" },
  ],
  PARENT: [
    { href: "/dashboard/dukungan", label: "Pusat bantuan", helper: "Cari panduan pendampingan", icon: CheckCircle2, tone: "bg-blue-50 text-blue-700" },
    { href: "/dashboard/privasi", label: "Privasi anak", helper: "Tinjau persetujuan data", icon: Eye, tone: "bg-orange-50 text-orange-700" },
  ],
  TEACHER: [
    { href: "/dashboard/review", label: "Review tugas", helper: "Buka antrean penilaian", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { href: "/dashboard/tugas", label: "Kelola materi", helper: "Perbarui materi dan tugas", icon: BookOpenCheck, tone: "bg-blue-50 text-blue-700" },
    { href: "/dashboard/kurikulum", label: "Atur rubrik", helper: "Kelola struktur penilaian", icon: GraduationCap, tone: "bg-orange-50 text-orange-700" },
  ],
  SCHOOL: [
    { href: "/dashboard/master-data", label: "Data sekolah", helper: "Kelola murid, guru, dan kelas", icon: Database, tone: "bg-blue-50 text-blue-700" },
    { href: "/dashboard/monitoring", label: "Pendampingan", helper: "Tinjau murid yang perlu dukungan", icon: AlertTriangle, tone: "bg-amber-50 text-amber-700" },
    { href: "/dashboard/laporan", label: "Unduh laporan", helper: "Siapkan data untuk instansi", icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-700" },
  ],
  PROGRAM: [
    { href: "/dashboard/master-data", label: "Data sekolah", helper: "Kelola data lintas sekolah", icon: Database, tone: "bg-blue-50 text-blue-700" },
    { href: "/dashboard/monitoring", label: "Monitoring program", helper: "Tinjau sinyal pendampingan", icon: AlertTriangle, tone: "bg-amber-50 text-amber-700" },
    { href: "/dashboard/laporan", label: "Laporan program", helper: "Ekspor ringkasan instansi", icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-700" },
  ],
};

function QuickActions({ audience }: { audience: Overview["audience"] }) {
  const actions = actionsByAudience[audience];
  return (
    <section className="mt-6" aria-labelledby="quick-actions-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-700">Akses cepat</p>
          <h2 id="quick-actions-heading" className="mt-1 text-lg font-extrabold text-slate-950">Mau mengerjakan apa?</h2>
        </div>
        <p className="hidden text-xs text-slate-500 sm:block">Pilih tujuan untuk langsung mulai</p>
      </div>
      <div className={`grid gap-3 ${actions.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${action.tone}`}><Icon className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block font-extrabold text-slate-900">{action.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{action.helper}</span></span>
              <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-600" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function BasicDashboard({ audience, data }: { audience: Overview["audience"]; data: BasicDashboardData | null }) {
  const copy = audienceCopy[audience];
  const cards = audience === "STUDENT" ? [
    { label: "Tugas aktif", value: number(data?.activeAssignmentsCount || 0), helper: "Tugas yang masih berada dalam periode pengerjaan", icon: BookOpenCheck, tone: "blue" as const },
    { label: "Perlu dikerjakan", value: number(data?.pendingTasksCount || 0), helper: "Tugas aktif yang belum dikumpulkan", icon: Clock3, tone: "amber" as const },
    { label: "Konten affiliate", value: number(data?.recentVideosCount || 0), helper: "Konten yang tercatat pada akunmu", icon: MousePointerClick, tone: "green" as const },
    { label: "Tayangan terverifikasi", value: number(data?.kpi?.views || 0), helper: "Snapshot performa terbaru yang sudah diverifikasi", icon: Eye, tone: "orange" as const },
  ] : audience === "TEACHER" ? [
    { label: "Siswa dampingan", value: number(data?.kpi?.totalStudents || 0), helper: "Siswa dalam kelas dan course yang Anda ampu", icon: Users, tone: "blue" as const },
    { label: "Antrean review", value: number(data?.kpi?.pendingReviewsCount || 0), helper: "Tugas yang menunggu penilaian", icon: CheckCircle2, tone: "green" as const },
    { label: "Tugas aktif", value: number(data?.kpi?.activeAssignmentsCount || 0), helper: "Tugas yang masih berjalan", icon: BookOpenCheck, tone: "orange" as const },
  ] : audience === "SCHOOL" || audience === "PROGRAM" ? [
    { label: "Siswa", value: number(data?.stats?.totalStudents || 0), helper: "Siswa pada sekolah aktif", icon: Users, tone: "blue" as const },
    { label: "Guru", value: number(data?.stats?.totalTeachers || 0), helper: "Guru pada sekolah aktif", icon: GraduationCap, tone: "green" as const },
    { label: "Kelas", value: number(data?.stats?.totalClasses || 0), helper: "Kelas yang tercatat", icon: School, tone: "orange" as const },
  ] : [];

  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-sm lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-36 size-80 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300">Akses dasar aktif</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl">{copy.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{copy.subtitle}</p>
        </div>
      </header>

      <QuickActions audience={audience} />

      {cards.length > 0 && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <MetricCard key={card.label} {...card} />)}
        </section>
      )}

      <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Fitur utama siap digunakan</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Materi, tugas, praktik toko, affiliate, dan penilaian tetap mengikuti akses sekolah. Analitik lanjutan serta ekspor tersedia sesuai paket.</p>
        </div>
        <Link href="/paket" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-orange-700">Lihat detail paket <ArrowRight className="size-4" /></Link>
      </section>
    </main>
  );
}

function DistributionBars({ title, items, emptyText }: { title: string; items: Metric[]; emptyText: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <section className="rounded-2xl border border-[#E4F1EE] bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">{title}</h3>
      {items.length === 0 ? <p className="mt-5 text-sm text-slate-500">{emptyText}</p> : (
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <div key={item.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-600">{item.key.replaceAll("_", " ")}</span>
                <span className="font-bold text-slate-900">{number(item.count)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AffiliateTrend({ points }: { points: TrendPoint[] }) {
  const width = 720;
  const height = 220;
  const max = Math.max(...points.map((point) => point.views), 1);
  const polyline = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point.views / max) * (height - 28) - 14;
    return `${x},${y}`;
  }).join(" ");
  return (
    <section className="rounded-2xl border border-[#E4F1EE] bg-white p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">Riwayat performa affiliate</h3>
          <p className="mt-1 text-xs text-slate-500">Views dari snapshot terverifikasi pada periode terpilih.</p>
        </div>
        <div className="flex gap-4 text-xs text-slate-500">
          <span><strong className="text-slate-900">{number(points.reduce((sum, point) => sum + point.clicks, 0))}</strong> clicks</span>
          <span><strong className="text-slate-900">{number(points.reduce((sum, point) => sum + point.orders, 0))}</strong> orders</span>
        </div>
      </div>
      {points.length === 0 ? (
        <div className="mt-5 flex min-h-52 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Belum ada snapshot performa pada periode ini.</div>
      ) : (
        <div className="mt-5 overflow-x-auto" role="img" aria-label="Grafik tren views affiliate">
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full" aria-hidden="true">
            {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height - ratio * (height - 28) - 14} y2={height - ratio * (height - 28) - 14} stroke="#E2E8F0" strokeWidth="1" />)}
            <polyline fill="none" stroke="#377C78" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
            {points.map((point, index) => {
              const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
              const y = height - (point.views / max) * (height - 28) - 14;
              return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="5" fill="#FFF" stroke="#286864" strokeWidth="3"><title>{`${point.date}: ${point.views} views`}</title></circle>;
            })}
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400"><span>{points[0]?.date}</span><span>{points.at(-1)?.date}</span></div>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [basicOverview, setBasicOverview] = useState<{ audience: Overview["audience"]; data: BasicDashboardData | null } | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [studentDetail, setStudentDetail] = useState<StudentLearningDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setBasicOverview(null);
    try {
      const sessionResponse = await fetch("/api/session", { cache: "no-store" });
      if (!sessionResponse.ok) throw new Error("Sesi pengguna belum dapat dimuat. Silakan coba lagi.");
      const session = await sessionResponse.json() as SessionProfile;
      setProfile(session);

      const canReadMonitoring = session.roles.includes("super-admin")
        || session.permissions.some((item) => item.resource === "monitoring" && item.action === "read");
      const accessResponse = await fetch("/api/backend/access/effective", { cache: "no-store" });
      const access = accessResponse.ok ? await accessResponse.json() as EffectiveAccess : null;
      const advancedDashboard = access?.entitlements?.["dashboards.advanced.read"];
      if (!canReadMonitoring || advancedDashboard === false || advancedDashboard === "false") {
        setBasicOverview(await loadBasicDashboard(session));
        return;
      }

      const overviewResponse = await fetch(`/api/backend/monitoring/overview?periodDays=${periodDays}`, { cache: "no-store" });
      if (!overviewResponse.ok) {
        const problem = await overviewResponse.json().catch(() => null) as { message?: string } | null;
        const packageLimited = overviewResponse.status === 403 && problem?.message?.toLowerCase().includes("paket");
        if (packageLimited) {
          setBasicOverview(await loadBasicDashboard(session));
          return;
        }
        throw new Error(problem?.message || "Dashboard belum dapat dimuat. Silakan coba lagi.");
      }
      setOverview(await overviewResponse.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => { void load(); }, [load]);

  const canManageWarnings = useMemo(() => profile?.roles.includes("super-admin") || profile?.permissions.some((item) => item.resource === "monitoring" && item.action === "manage"), [profile]);

  const evaluateWarnings = async () => {
    setActionLoading(true);
    setNotice("");
    try {
      const response = await csrfFetch("/api/backend/monitoring/early-warnings/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ periodDays }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Evaluasi belum berhasil");
      setNotice(`Evaluasi selesai untuk ${result.evaluatedStudents} siswa: ${result.created} sinyal baru, ${result.autoResolved} terselesaikan otomatis.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evaluasi belum berhasil");
    } finally {
      setActionLoading(false);
    }
  };

  const openStudentDetail = async (studentId: string) => {
    setDetailLoadingId(studentId);
    setError("");
    try {
      const response = await fetch(`/api/backend/monitoring/students/${encodeURIComponent(studentId)}/learning-progress`, { cache: "no-store" });
      const body = await response.json().catch(() => null) as StudentLearningDetail & { message?: string } | null;
      if (!response.ok || !body?.student) throw new Error(body?.message || "Detail progres siswa belum dapat dimuat.");
      setStudentDetail(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Detail progres siswa belum dapat dimuat.");
    } finally {
      setDetailLoadingId("");
    }
  };

  if (loading && !overview && !basicOverview) return <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"><div className="animate-pulse rounded-2xl border border-orange-100 bg-white p-8 text-sm font-semibold text-orange-700">Menyiapkan ringkasan dari data terbaru…</div></div>;

  if (error && !overview) return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="font-semibold text-amber-900">{error}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void load()} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white">Coba lagi</button>{error.toLowerCase().includes("paket") && <Link href="/paket" className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800">Lihat paket</Link>}</div></div></div>
  );

  if (basicOverview) return <BasicDashboard audience={basicOverview.audience} data={basicOverview.data} />;
  if (!overview) return null;
  const copy = audienceCopy[overview.audience];
  const kpi = overview.kpi;
  const isIndividual = overview.audience === "STUDENT" || overview.audience === "PARENT";
  const cards = isIndividual ? [
    { label: "Progress belajar", value: percent(valueOf(kpi, "averageLearningProgress")), helper: overview.definitions.learningProgress, icon: GraduationCap, tone: "blue" as const },
    { label: "Tugas disetujui", value: number(valueOf(kpi, "approvedSubmissions")), helper: `${number(valueOf(kpi, "pendingReviews"))} sedang menunggu review`, icon: CheckCircle2, tone: "green" as const },
    { label: "Student Store", value: number(valueOf(kpi, "storeApproved")), helper: "Submission toko yang sudah disetujui", icon: ShoppingBag, tone: "orange" as const },
    { label: "Sinyal pendampingan", value: number(valueOf(kpi, "openWarnings")), helper: "Gunakan sebagai panduan dukungan, bukan hukuman", icon: AlertTriangle, tone: "amber" as const },
  ] : [
    { label: "Siswa aktif", value: `${number(valueOf(kpi, "activeStudents"))}/${number(valueOf(kpi, "totalStudents"))}`, helper: overview.definitions.activeStudents, icon: Users, tone: "blue" as const },
    { label: "Progress belajar", value: percent(valueOf(kpi, "averageLearningProgress")), helper: overview.definitions.learningProgress, icon: BookOpenCheck, tone: "green" as const },
    { label: "Antrean review", value: number(valueOf(kpi, "pendingReviews")), helper: `${number(valueOf(kpi, "revisionRequired"))} memerlukan revisi`, icon: Clock3, tone: "orange" as const },
    { label: "Early warning terbuka", value: number(valueOf(kpi, "openWarnings")), helper: overview.definitions.earlyWarning, icon: AlertTriangle, tone: "amber" as const },
  ];

  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-sm lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-36 size-80 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-64 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300">Ringkasan terbaru</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl">{copy.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
            <label htmlFor="period" className="pl-2 text-xs font-semibold text-slate-300">Periode</label>
            <select id="period" value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-400">
              <option value={30}>30 hari</option><option value={90}>90 hari</option><option value={180}>180 hari</option><option value={365}>1 tahun</option>
            </select>
            <button onClick={() => void load()} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-extrabold text-white transition hover:bg-orange-400 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Perbarui</button>
          </div>
        </div>
        <p className="relative mt-6 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-300">Diperbarui {formatDate(overview.lastUpdated)} · {overview.period.timezone}</p>
      </header>

      {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <QuickActions audience={overview.audience} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <MetricCard key={card.label} {...card} />)}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <AffiliateTrend points={overview.trends.affiliate} />
        <section className="rounded-2xl border border-[#E4F1EE] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="font-bold text-slate-900">Sinyal pendampingan</h3><p className="mt-1 text-xs leading-5 text-slate-500">Bahasa dan tindakan harus suportif.</p></div>
            {canManageWarnings && <button onClick={evaluateWarnings} disabled={actionLoading} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-60">{actionLoading ? "Mengevaluasi…" : "Evaluasi"}</button>}
          </div>
          <div className="mt-4 space-y-3">
            {overview.warnings.length === 0 ? <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mb-2 h-5 w-5" />Tidak ada sinyal terbuka pada ruang lingkup ini.</div> : overview.warnings.slice(0, 6).map((warning) => (
              <article key={warning.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-900">{warning.title}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-700">{warning.severity}</span></div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{warning.message}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <DistributionBars title="Status submission" items={overview.distributions.submissions} emptyText="Belum ada submission pada ruang lingkup ini." />
        <DistributionBars title="Student Store" items={overview.distributions.stores} emptyText="Belum ada submission toko." />
        <DistributionBars title="Distribusi nilai" items={overview.distributions.grades} emptyText="Belum ada nilai yang dipublikasikan." />
      </section>

      {overview.audience === "PROGRAM" && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E4F1EE] bg-white shadow-sm">
          <div className="border-b border-orange-100 px-5 py-4"><h3 className="font-bold text-slate-900">Ringkasan sekolah</h3><p className="mt-1 text-xs text-slate-500">Perbandingan dinormalisasi berdasarkan jumlah siswa atau kewajiban tugas, dan disusun alfabetis tanpa peringkat.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Sekolah</th><th className="px-5 py-3">Siswa</th><th className="px-5 py-3">Aktif</th><th className="px-5 py-3">Progress rata-rata</th><th className="px-5 py-3">Tugas disetujui</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {overview.schools.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Belum ada data sekolah pada ruang lingkup ini.</td></tr> : overview.schools.map((school) => (
                  <tr key={school.schoolId} className="text-slate-700"><td className="px-5 py-4 font-semibold text-slate-900">{school.schoolName}</td><td className="px-5 py-4">{number(school.studentCount)}</td><td className="px-5 py-4">{percent(school.activeRate)}</td><td className="px-5 py-4">{percent(school.averageProgress)}</td><td className="px-5 py-4">{percent(school.approvedSubmissionRate)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!isIndividual && overview.audience !== "PROGRAM" && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E4F1EE] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Siswa yang perlu dipantau</h3><p className="mt-1 text-xs text-slate-500">Diurutkan berdasarkan jumlah sinyal, tanpa leaderboard performa.</p></div><Activity className="h-5 w-5 text-orange-600" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Siswa</th><th className="px-5 py-3">Kelas</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3">Tugas selesai</th><th className="px-5 py-3">Sinyal</th><th className="px-5 py-3">Aktivitas terakhir</th><th className="px-5 py-3"><span className="sr-only">Detail</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {overview.students.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Belum ada siswa pada filter ini.</td></tr> : overview.students.map((student) => (
                  <tr key={student.id} className="text-slate-700"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{student.fullName}</p><p className="text-xs text-slate-500">{student.studentNumber}</p></td><td className="px-5 py-4">{student.className}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><div className="h-2 w-20 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(student.progressPercent, 100)}%` }} /></div><span>{student.progressPercent}%</span></div><p className="mt-1 text-[11px] text-slate-500">{student.completedLessons}/{student.totalLessons} materi selesai</p></td><td className="px-5 py-4">{student.submissionCompleted}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${student.warningCount ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{student.warningCount}</span></td><td className="px-5 py-4 text-xs">{formatDate(student.lastActivity)}</td><td className="px-5 py-4"><button type="button" onClick={() => void openStudentDetail(student.id)} disabled={detailLoadingId === student.id} className="min-h-10 rounded-lg border border-orange-200 px-3 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60">{detailLoadingId === student.id ? "Memuat…" : "Lihat materi"}</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {studentDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="student-progress-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setStudentDetail(null); }}>
          <section className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <header className="flex items-start justify-between gap-4 border-b border-orange-100 px-5 py-4 sm:px-6">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Detail pembelajaran</p><h2 id="student-progress-title" className="mt-1 text-xl font-extrabold text-slate-950">{studentDetail.student.fullName}</h2><p className="mt-1 text-xs text-slate-500">{studentDetail.student.studentNumber} · {studentDetail.student.className} · {studentDetail.student.schoolName}</p></div>
              <button type="button" onClick={() => setStudentDetail(null)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Tutup detail progres"><X className="size-5" /></button>
            </header>
            <div className="max-h-[calc(92vh-105px)] space-y-4 overflow-y-auto p-5 sm:p-6">
              {studentDetail.modules.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Belum ada materi yang dapat diakses siswa ini.</p> : studentDetail.modules.map((courseModule) => (
                <article key={courseModule.id} className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="bg-slate-50 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">{courseModule.course.code} · Modul {courseModule.position}</p><h3 className="mt-1 font-bold text-slate-900">{courseModule.title}</h3></div>
                  <div className="divide-y divide-slate-100">{courseModule.lessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-4 px-4 py-3"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${lesson.progress.state === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : lesson.progress.progressPercent > 0 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}>{lesson.progress.progressPercent}%</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{lesson.title}</p><p className="mt-0.5 text-xs text-slate-500">{lesson.progress.state === "COMPLETED" ? "Selesai" : lesson.progress.progressPercent > 0 ? `Sedang dipelajari · posisi ${lesson.progress.lastPosition || 1}` : "Belum dimulai"}{lesson.progress.updatedAt ? ` · ${formatDate(lesson.progress.updatedAt)}` : ""}</p></div></div>
                  ))}</div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="mt-6 grid gap-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-sm text-slate-600 md:grid-cols-3">
        <div className="flex gap-3"><Eye className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><p><strong className="block text-slate-900">{number(valueOf(kpi, "views"))} views</strong>Snapshot terverifikasi terbaru per konten.</p></div>
        <div className="flex gap-3"><MousePointerClick className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><p><strong className="block text-slate-900">{number(valueOf(kpi, "clicks"))} clicks</strong>Data sesuai periode terpilih.</p></div>
        <div className="flex gap-3"><School className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><p><strong className="block text-slate-900">{number(valueOf(kpi, "totalClasses"))} kelas</strong>Agregasi mengikuti izin pengguna.</p></div>
      </section>
    </main>
  );
}
