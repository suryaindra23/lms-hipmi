"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  ChartNoAxesCombined,
  CheckSquare,
  ChevronRight,
  CreditCard,
  Database,
  FileSpreadsheet,
  Headphones,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrf";
import PwaShell from "@/components/PwaShell";
import BrandLogo from "@/components/BrandLogo";
import SchoolPicker, { SchoolOption, SchoolSelectionGate } from "@/components/dashboard/SchoolPicker";

type Permission = { resource?: string; action?: string };
type SessionProfile = {
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  permissions?: Permission[];
  schoolId?: string | null;
};

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type NavGroup = { label: string; items: NavItem[] };

const roleCopy: Record<string, string> = {
  "super-admin": "Super Admin",
  "program-manager": "Pengelola Program",
  "school-admin": "Admin Sekolah",
  principal: "Pimpinan Sekolah",
  teacher: "Guru",
  student: "Murid",
  parent: "Orang Tua / Wali",
  support: "Tim Dukungan",
};

const routeCopy = [
  { path: "/dashboard/toko/review", title: "Review Student Store", eyebrow: "Pembelajaran" },
  { path: "/dashboard/affiliate/review", title: "Verifikasi Affiliate", eyebrow: "Pembelajaran" },
  { path: "/dashboard/identitas/verifikasi", title: "Verifikasi Identitas", eyebrow: "Operasional sekolah" },
  { path: "/dashboard/master-data", title: "Data Sekolah", eyebrow: "Operasional sekolah" },
  { path: "/dashboard/monitoring", title: "Pendampingan Murid", eyebrow: "Operasional sekolah" },
  { path: "/dashboard/pengelolaan", title: "Pengelolaan Instansi", eyebrow: "Operasional sekolah" },
  { path: "/dashboard/laporan", title: "Laporan & Ekspor", eyebrow: "Operasional sekolah" },
  { path: "/dashboard/kurikulum", title: "Struktur & Rubrik", eyebrow: "Pembelajaran" },
  { path: "/dashboard/review", title: "Antrean Review", eyebrow: "Pembelajaran" },
  { path: "/dashboard/tugas", title: "Materi & Tugas", eyebrow: "Pembelajaran" },
  { path: "/dashboard/affiliate", title: "Affiliate Saya", eyebrow: "Praktik digital" },
  { path: "/dashboard/toko", title: "Student Store", eyebrow: "Praktik digital" },
  { path: "/dashboard/identitas", title: "Identitas Saya", eyebrow: "Akun" },
  { path: "/dashboard/dukungan", title: "Bantuan & Sertifikat", eyebrow: "Bantuan" },
  { path: "/dashboard/privasi", title: "Privasi & Persetujuan", eyebrow: "Akun" },
  { path: "/dashboard/keamanan", title: "Keamanan Akun", eyebrow: "Akun" },
  { path: "/dashboard/pembelian/approval", title: "Approval Pembayaran", eyebrow: "Operasional instansi" },
  { path: "/dashboard/pembelian", title: "Pembelian & Akses", eyebrow: "Akun" },
  { path: "/dashboard", title: "Ringkasan", eyebrow: "Beranda" },
];

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function Navigation({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigasi utama" className="space-y-6">
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`nav-${group.label.toLowerCase().replaceAll(" ", "-")}`}>
          <h2 id={`nav-${group.label.toLowerCase().replaceAll(" ", "-")}`} className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
            {group.label}
          </h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`group flex min-h-12 items-center gap-3 rounded-full px-3 py-2.5 transition ${
                    active
                      ? "bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full transition ${active ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"}`}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-5">{item.label}</span>
                    <span className={`block truncate text-[11px] leading-4 ${active ? "text-orange-700" : "text-slate-400"}`}>{item.description}</span>
                  </span>
                  {active && <ChevronRight className="size-4 shrink-0 text-orange-600" aria-hidden="true" />}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function UserSummary({ profile, roleLabel }: { profile: SessionProfile; roleLabel: string }) {
  const initial = (profile.firstName || profile.email || "P").trim().charAt(0).toUpperCase();
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email?.split("@")[0] || "Pengguna";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-600 text-sm font-extrabold text-white">{initial}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-slate-900">{displayName}</span>
        <span className="block truncate text-[11px] font-medium text-slate-500">{roleLabel}</span>
      </span>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [switchingSchool, setSwitchingSchool] = useState(false);
  const [schoolError, setSchoolError] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    Promise.all([fetch("/api/session"), fetch("/api/backend/auth/schools")])
      .then(async ([sessionResponse, schoolResponse]) => {
        if (!sessionResponse.ok) throw new Error("Sesi tidak valid");
        const session = await sessionResponse.json() as SessionProfile;
        const schoolContext = schoolResponse.ok
          ? await schoolResponse.json()
          : { schools: [], selectedSchoolId: session.schoolId || null };
        return { session, schoolContext };
      })
      .then(({ session, schoolContext }) => {
        setProfile(session);
        setSchools(Array.isArray(schoolContext.schools) ? schoolContext.schools : []);
        setSelectedSchoolId(schoolContext.selectedSchoolId || session.schoolId || null);
        setLoading(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
  const canManageSchool = roles.some((role) => ["super-admin", "school-admin", "principal", "program-manager"].includes(role));
  const canVerifyIdentity = roles.includes("super-admin") || permissions.some((permission) => permission.resource === "identity" && permission.action === "verify");
  const canViewReports = roles.includes("super-admin") || permissions.some((permission) => permission.resource === "reports" && permission.action === "read");
  const canManageWarnings = roles.includes("super-admin") || permissions.some((permission) => permission.resource === "monitoring" && permission.action === "manage");
  const canManageAccess = roles.includes("super-admin") || permissions.some((permission) => permission.resource === "access-grants" && permission.action === "manage");
  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("teacher");

  const navGroups = useMemo<NavGroup[]>(() => {
    const learning: NavItem[] = [];
    const institution: NavItem[] = [];

    if (isStudent || isTeacher) learning.push({ href: "/dashboard/tugas", label: "Materi & Tugas", description: isStudent ? "Belajar dan kumpulkan tugas" : "Kelola materi pembelajaran", icon: BookOpen });
    if (isTeacher) {
      learning.push(
        { href: "/dashboard/review", label: "Antrean Review", description: "Nilai tugas yang masuk", icon: CheckSquare },
        { href: "/dashboard/kurikulum", label: "Struktur & Rubrik", description: "Atur jalur dan penilaian", icon: ListTree },
        { href: "/dashboard/toko/review", label: "Review Toko", description: "Periksa praktik toko murid", icon: Store },
        { href: "/dashboard/affiliate/review", label: "Verifikasi Affiliate", description: "Validasi konten affiliate", icon: BadgeCheck },
      );
    }
    if (isStudent) {
      learning.push(
        { href: "/dashboard/toko", label: "Student Store", description: "Kelola praktik toko", icon: Store },
        { href: "/dashboard/affiliate", label: "Affiliate Saya", description: "Pantau konten dan hasil", icon: ChartNoAxesCombined },
        { href: "/dashboard/identitas", label: "Identitas Saya", description: "Lengkapi data dengan aman", icon: UserRound },
      );
    }

    if (canManageSchool) institution.push({ href: "/dashboard/master-data", label: "Data Sekolah", description: "Murid, guru, kelas, dan pengguna", icon: Database });
    if (canVerifyIdentity) institution.push({ href: "/dashboard/identitas/verifikasi", label: "Verifikasi Identitas", description: "Tinjau pengajuan identitas", icon: BadgeCheck });
    if (canManageWarnings) institution.push({ href: "/dashboard/monitoring", label: "Pendampingan Murid", description: "Tindak lanjuti sinyal bantuan", icon: AlertTriangle });
    if (canViewReports) institution.push({ href: "/dashboard/laporan", label: "Laporan & Ekspor", description: "Ringkasan untuk instansi", icon: FileSpreadsheet });
    if (canManageAccess) institution.push({ href: "/dashboard/pembelian/approval", label: "Approval Pembayaran", description: "Verifikasi dan aktifkan paket siswa", icon: BadgeCheck });
    if (canManageSchool) institution.push({ href: "/dashboard/pengelolaan", label: "Pengelolaan", description: "Konten, sertifikat, dan lead", icon: Settings });

    return [
      { label: "Utama", items: [{ href: "/dashboard", label: "Ringkasan", description: isStudent ? "Lihat progres belajarmu" : "Pantau kondisi terbaru", icon: LayoutDashboard }] },
      ...(learning.length ? [{ label: isStudent ? "Belajar & Berkarya" : "Pembelajaran", items: learning }] : []),
      ...(institution.length ? [{ label: "Operasional Instansi", items: institution }] : []),
      { label: "Bantuan & Akun", items: [
        { href: "/dashboard/pembelian", label: "Pembelian & Akses", description: "Pesanan dan status paket", icon: CreditCard },
        { href: "/dashboard/dukungan", label: "Bantuan & Sertifikat", description: "Pusat bantuan dan dokumen", icon: Headphones },
        { href: "/dashboard/privasi", label: "Privasi", description: "Persetujuan penggunaan data", icon: Scale },
        { href: "/dashboard/keamanan", label: "Keamanan Akun", description: "Kata sandi dan verifikasi", icon: ShieldCheck },
      ] },
    ];
  }, [canManageAccess, canManageSchool, canManageWarnings, canVerifyIdentity, canViewReports, isStudent, isTeacher]);

  const selectSchool = async (schoolId: string) => {
    if (!schoolId || schoolId === selectedSchoolId) return;
    setSwitchingSchool(true);
    setSchoolError("");
    try {
      const response = await csrfFetch("/api/school-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Sekolah belum dapat dipilih");
      window.location.reload();
    } catch (caught) {
      setSchoolError(caught instanceof Error ? caught.message : "Sekolah belum dapat dipilih");
      setSwitchingSchool(false);
    }
  };

  const handleLogout = async () => {
    try {
      await csrfFetch("/api/session", { method: "DELETE" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  if (loading || !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FFFFFF]">
        <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white px-5 py-4 text-sm font-bold text-orange-700 shadow-sm">
          <span className="size-2.5 animate-pulse rounded-full bg-orange-500" />
          Menyiapkan ruang belajar…
        </div>
      </div>
    );
  }

  const requiresSchoolSelection = schools.length > 1 && !selectedSchoolId;
  const roleLabel = roles.map((role) => roleCopy[role] || role).join(" · ") || "Pengguna";
  const currentPage = routeCopy.find((item) => isActiveRoute(pathname, item.path)) || routeCopy.at(-1)!;

  return (
    <div className="dashboard-shell min-h-screen bg-white text-slate-900">
      <a href="#dashboard-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-bold text-orange-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten utama</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[284px] flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-[76px] items-center border-b border-slate-100 px-6">
          <Link href="/dashboard" aria-label="Sunrise Academy — Ringkasan"><BrandLogo className="text-xl" priority /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin]">
          <Navigation groups={navGroups} pathname={pathname} />
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 rounded-2xl bg-orange-50 p-3"><UserSummary profile={profile} roleLabel={roleLabel} /></div>
          <button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-red-600 transition hover:bg-red-50">
            <LogOut className="size-[18px]" aria-hidden="true" /> Keluar
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <aside className="relative flex h-full w-[min(88vw,340px)] flex-col bg-white shadow-2xl">
            <div className="flex min-h-[72px] items-center justify-between border-b border-slate-100 px-5">
              <BrandLogo className="text-lg" priority />
              <button type="button" aria-label="Tutup menu navigasi" onClick={() => setMobileMenuOpen(false)} className="grid size-11 place-items-center rounded-xl text-slate-600 hover:bg-slate-100"><X className="size-5" /></button>
            </div>
            <div className="border-b border-slate-100 p-4">
              <div className="rounded-2xl bg-slate-50 p-3"><UserSummary profile={profile} roleLabel={roleLabel} /></div>
              {schools.length > 0 && <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-3"><SchoolPicker schools={schools} selectedSchoolId={selectedSchoolId} switching={switchingSchool} onSelect={selectSchool} compact /></div>}
              {schoolError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{schoolError}</p>}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5"><Navigation groups={navGroups} pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} /></div>
            <div className="border-t border-slate-100 p-4">
              <button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-red-600 hover:bg-red-50"><LogOut className="size-[18px]" /> Keluar dari akun</button>
            </div>
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-[284px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" aria-label="Buka menu navigasi" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"><Menu className="size-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-700">{currentPage.eyebrow}</p>
              <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">{currentPage.title}</h1>
            </div>
            <div className="hidden min-w-0 xl:block">
              <SchoolPicker schools={schools} selectedSchoolId={selectedSchoolId} switching={switchingSchool} onSelect={selectSchool} />
              {schoolError && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{schoolError}</p>}
            </div>
            <PwaShell />
          </div>
          {schools.length > 0 && <div className="border-t border-slate-100 px-4 py-2.5 sm:px-6 xl:hidden"><SchoolPicker schools={schools} selectedSchoolId={selectedSchoolId} switching={switchingSchool} onSelect={selectSchool} compact />{schoolError && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{schoolError}</p>}</div>}
        </header>

        <div id="dashboard-content" tabIndex={-1}>
          {requiresSchoolSelection ? (
            <SchoolSelectionGate schools={schools} switching={switchingSchool} error={schoolError} onSelect={selectSchool} />
          ) : children}
        </div>
      </div>
    </div>
  );
}
