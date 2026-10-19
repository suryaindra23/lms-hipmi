"use client";

import { Building2, Loader2 } from "lucide-react";

export type SchoolOption = {
  id: string;
  name: string;
  code: string;
  level: string;
  status: string;
  city?: string | null;
  province?: string | null;
};

type Props = {
  schools: SchoolOption[];
  selectedSchoolId: string | null;
  switching: boolean;
  onSelect: (schoolId: string) => void;
  compact?: boolean;
};

export default function SchoolPicker({
  schools,
  selectedSchoolId,
  switching,
  onSelect,
  compact = false,
}: Props) {
  const selected = schools.find((school) => school.id === selectedSchoolId);

  if (schools.length <= 1 && selected) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
          <Building2 size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          {!compact && (
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sekolah aktif
            </span>
          )}
          <span className="block truncate text-sm font-bold text-slate-800">
            {selected.name}
          </span>
        </span>
      </div>
    );
  }

  return (
    <label className="flex min-w-0 items-center gap-2 text-left">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
        {switching ? (
          <Loader2 className="animate-spin" size={18} aria-hidden="true" />
        ) : (
          <Building2 size={18} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {!compact && (
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Sekolah aktif
          </span>
        )}
        <select
          aria-label="Pilih sekolah aktif"
          value={selectedSchoolId || ""}
          disabled={switching || schools.length === 0}
          onChange={(event) => onSelect(event.target.value)}
          className="min-h-9 w-full max-w-64 rounded-lg border border-orange-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-orange-500 disabled:opacity-60"
        >
          <option value="" disabled>
            Pilih sekolah
          </option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name} ({school.code})
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function SchoolSelectionGate({
  schools,
  switching,
  error,
  onSelect,
}: {
  schools: SchoolOption[];
  switching: boolean;
  error: string;
  onSelect: (schoolId: string) => void;
}) {
  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center p-4 sm:p-8">
      <section className="w-full max-w-3xl rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
          <Building2 size={24} aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.16em] text-orange-600">
          Konteks sekolah
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-slate-900">
          Pilih sekolah untuk melanjutkan
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Akun Anda terhubung ke beberapa sekolah. Data dashboard, siswa, guru,
          kelas, dan laporan akan mengikuti sekolah yang dipilih.
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {schools.map((school) => {
            const location = [school.city, school.province].filter(Boolean).join(", ");
            return (
              <button
                key={school.id}
                type="button"
                disabled={switching}
                onClick={() => onSelect(school.id)}
                className="group flex min-h-28 items-start gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50 disabled:opacity-60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700 group-hover:bg-orange-200">
                  {switching ? <Loader2 className="animate-spin" size={19} /> : <Building2 size={19} />}
                </span>
                <span>
                  <span className="block font-extrabold text-slate-900">{school.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {school.code} · {school.level} · {school.status}
                  </span>
                  {location && <span className="mt-2 block text-xs text-slate-500">{location}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
