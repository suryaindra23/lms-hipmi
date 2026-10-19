"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2, Clock3, RefreshCw, School, Search, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type Identity = {
  userId: string;
  email: string;
  fullName: string;
  studentNumber: string | null;
  schoolId: string | null;
  schoolName: string | null;
  isStudent: boolean;
};

type StudentOption = {
  id: string;
  userId: string;
  fullName: string;
  studentNumber: string;
  email: string;
  schoolName: string;
};

type ApprovalOrder = {
  id: string;
  orderNumber: string;
  status: "PENDING_PAYMENT" | "PAID" | "FAILED" | "EXPIRED";
  currency: string;
  subtotalAmount: string;
  feeAmount: string;
  totalAmount: string;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  pricingUnit: "PER_STUDENT";
  purchaser: Identity | null;
  beneficiary: Identity | null;
  items: Array<{
    plan: { code: string; name: string; moduleLimit: number };
    offer: { name: string; accessDurationDays: number | null };
  }>;
};

const statusCopy = {
  PENDING_PAYMENT: { label: "Perlu ditinjau", className: "bg-amber-50 text-amber-800" },
  PAID: { label: "Disetujui", className: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Ditolak", className: "bg-red-50 text-red-700" },
  EXPIRED: { label: "Kedaluwarsa", className: "bg-slate-100 text-slate-600" },
};

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
}

function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function PaymentApprovalPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"ALL" | ApprovalOrder["status"]>("PENDING_PAYMENT");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ordersResponse, studentsResponse] = await Promise.all([
        fetch("/api/backend/commerce/admin/orders", { cache: "no-store" }),
        fetch("/api/backend/commerce/admin/students", { cache: "no-store" }),
      ]);
      const [orderData, studentData] = await Promise.all([
        ordersResponse.json().catch(() => []),
        studentsResponse.json().catch(() => []),
      ]);
      if (!ordersResponse.ok) throw new Error(orderData.message || "Antrean approval belum dapat dimuat");
      if (!studentsResponse.ok) throw new Error(studentData.message || "Daftar siswa belum dapat dimuat");
      const nextOrders = Array.isArray(orderData) ? orderData as ApprovalOrder[] : [];
      setOrders(nextOrders);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setSelectedStudents((current) => Object.fromEntries(nextOrders.map((order) => [
        order.id,
        current[order.id] || (order.beneficiary?.isStudent ? order.beneficiary.userId : ""),
      ])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Antrean approval belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const authorize = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const session = response.ok ? await response.json() as { roles?: string[]; permissions?: Array<{ resource: string; action: string }> } : null;
        const canManageAccess = Boolean(session?.roles?.includes("super-admin") || session?.permissions?.some((permission) => permission.resource === "access-grants" && permission.action === "manage"));
        if (!canManageAccess) {
          if (active) setAuthorized(false);
          router.replace("/dashboard");
          return;
        }
        if (active) setAuthorized(true);
        await load();
      } catch {
        if (active) setAuthorized(false);
        router.replace("/dashboard");
      }
    };
    void authorize();
    return () => { active = false; };
  }, [load, router]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (filter !== "ALL" && order.status !== filter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [order.orderNumber, order.purchaser?.fullName, order.purchaser?.email, order.beneficiary?.fullName, order.items[0]?.offer.name]
      .some((value) => value?.toLowerCase().includes(query));
  }), [filter, orders, search]);

  async function approve(order: ApprovalOrder) {
    const beneficiaryUserId = selectedStudents[order.id];
    const paymentReference = references[order.id]?.trim() || "";
    const note = notes[order.id]?.trim() || "";
    if (!beneficiaryUserId) {
      setError("Pilih satu siswa penerima akses terlebih dahulu.");
      return;
    }
    if (paymentReference.length < 3) {
      setError("Isi referensi mutasi atau transfer sebelum menyetujui pembayaran.");
      return;
    }
    if (note.length < 5) {
      setError("Isi catatan hasil pemeriksaan minimal 5 karakter.");
      return;
    }
    const student = students.find((item) => item.userId === beneficiaryUserId);
    if (!window.confirm(`Setujui pembayaran ${order.orderNumber} dan aktifkan ${order.items[0]?.plan.name} untuk ${student?.fullName || "siswa ini"}?`)) return;
    setBusy(order.id);
    setError("");
    setNotice("");
    try {
      const response = await csrfFetch(`/api/backend/commerce/admin/orders/${order.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          beneficiaryUserId,
          paymentReference,
          note,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Pembayaran belum dapat disetujui");
      setNotice(`Pembayaran ${order.orderNumber} disetujui. Akses siswa sudah aktif.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pembayaran belum dapat disetujui");
    } finally {
      setBusy("");
    }
  }

  async function reject(order: ApprovalOrder) {
    const reason = window.prompt(`Alasan menolak pembayaran ${order.orderNumber}:`);
    if (!reason) return;
    if (reason.trim().length < 5) {
      setError("Alasan penolakan minimal 5 karakter.");
      return;
    }
    setBusy(order.id);
    setError("");
    setNotice("");
    try {
      const response = await csrfFetch(`/api/backend/commerce/admin/orders/${order.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Pembayaran belum dapat ditolak");
      setNotice(`Pembayaran ${order.orderNumber} ditolak dan akses tidak diberikan.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pembayaran belum dapat ditolak");
    } finally {
      setBusy("");
    }
  }

  const pendingCount = orders.filter((order) => order.status === "PENDING_PAYMENT").length;
  const paidCount = orders.filter((order) => order.status === "PAID").length;

  if (authorized !== true) {
    return <main className="grid min-h-[40vh] place-items-center p-6"><div className="flex items-center gap-3 rounded-xl border border-orange-100 bg-white px-5 py-4 text-sm font-bold text-slate-600"><RefreshCw className="animate-spin text-orange-600" size={17} /> Memeriksa kewenangan akun…</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Pembayaran & akses</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-950">Approval paket siswa</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Cocokkan nominal transfer, pilih satu siswa penerima, lalu aktifkan paket. Setiap pembayaran berbayar hanya berlaku untuk satu siswa.</p>
          </div>
          <div className="flex gap-3">
            <Metric label="Perlu ditinjau" value={pendingCount} tone="text-amber-700" />
            <Metric label="Sudah aktif" value={paidCount} tone="text-emerald-700" />
          </div>
        </div>

        <section className="mt-7 grid gap-4 border border-emerald-200 bg-emerald-50 p-5 md:grid-cols-[auto_1fr]" aria-label="Aturan akses paket">
          <span className="grid size-11 place-items-center rounded-full bg-white text-emerald-700"><School size={21} /></span>
          <div><h3 className="font-extrabold text-emerald-950">Paket Gratis tidak menunggu approval</h3><p className="mt-1 text-sm leading-6 text-emerald-800">Modul pada paket Gratis otomatis terbuka sebagai akses dasar sekolah dan seluruh siswanya. Approval ini khusus paket Medium dan Advanced yang dihitung per siswa.</p></div>
        </section>

        {(error || notice) && <div className={`mt-5 border-l-2 px-4 py-3 text-sm ${error ? "border-red-600 bg-red-50 text-red-700" : "border-emerald-600 bg-emerald-50 text-emerald-800"}`}>{error || notice}</div>}

        <div className="mt-7 flex flex-col gap-3 border-y border-slate-900/10 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["PENDING_PAYMENT", "PAID", "FAILED", "EXPIRED", "ALL"] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`min-h-10 rounded-md px-4 text-xs font-extrabold ${filter === value ? "bg-slate-950 text-white" : "border border-slate-900/10 bg-white text-slate-600"}`}>
                {value === "PENDING_PAYMENT" ? "Perlu ditinjau" : value === "PAID" ? "Disetujui" : value === "FAILED" ? "Ditolak" : value === "EXPIRED" ? "Kedaluwarsa" : "Semua"}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-80"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><span className="sr-only">Cari pesanan</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor, pembeli, atau siswa" className="min-h-10 w-full rounded-md border border-slate-900/15 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-500" /></label>
        </div>

        {loading ? (
          <div className="mt-7 flex min-h-56 items-center justify-center gap-3 border border-slate-900/10 bg-white text-sm font-bold text-slate-500"><RefreshCw className="animate-spin" size={17} /> Memuat antrean approval…</div>
        ) : visibleOrders.length === 0 ? (
          <div className="mt-7 grid min-h-56 place-items-center border border-slate-900/10 bg-white p-8 text-center"><div><CheckCircle2 className="mx-auto text-emerald-600" size={28} /><h3 className="mt-3 font-extrabold text-slate-950">Tidak ada pesanan pada tampilan ini</h3><p className="mt-2 text-sm text-slate-500">Antrean baru akan muncul setelah siswa membuat pesanan.</p></div></div>
        ) : (
          <div className="mt-7 space-y-5">
            {visibleOrders.map((order) => {
              const status = statusCopy[order.status];
              const item = order.items[0];
              return (
                <article key={order.id} className="border border-slate-900/10 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-full bg-orange-50 text-orange-700"><BadgeCheck size={19} /></span>
                        <div><p className="text-xs font-bold text-slate-500">{order.orderNumber}</p><h3 className="mt-0.5 text-lg font-extrabold text-slate-950">{item?.offer.name || item?.plan.name}</h3></div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${status.className}`}>{status.label}</span>
                      </div>
                      <div className="mt-5 grid gap-4 border-t border-slate-900/10 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <Info label="Transfer tepat" value={money(order.totalAmount, order.currency)} strong />
                        <Info label="Harga + kode unik" value={`${money(order.subtotalAmount, order.currency)} + ${String(Number(order.feeAmount)).padStart(3, "0")}`} />
                        <Info label="Pembeli" value={order.purchaser?.fullName || order.purchaser?.email || "Tidak diketahui"} />
                        <Info label={order.status === "PAID" ? "Disetujui" : "Batas pembayaran"} value={date(order.paidAt || order.paymentExpiresAt)} icon={<Clock3 size={14} />} />
                      </div>
                    </div>
                  </div>

                  {order.status === "PENDING_PAYMENT" ? (
                    <div className="mt-6 grid gap-5 border-t border-slate-900/10 pt-6 lg:grid-cols-[1.25fr_.75fr]">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-xs font-extrabold text-slate-700 sm:col-span-2">Siswa penerima akses<select value={selectedStudents[order.id] || ""} onChange={(event) => setSelectedStudents((current) => ({ ...current, [order.id]: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-slate-900/15 bg-white px-3 text-sm font-bold outline-none focus:border-orange-500"><option value="">Pilih satu siswa…</option>{students.map((student) => <option key={student.userId} value={student.userId}>{student.fullName} · {student.studentNumber} · {student.schoolName}</option>)}</select></label>
                        <label className="text-xs font-extrabold text-slate-700">Referensi transfer <span className="text-red-600">*</span><input required minLength={3} maxLength={120} value={references[order.id] || ""} onChange={(event) => setReferences((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Contoh: mutasi 23/09 14:10" className="mt-2 min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></label>
                        <label className="text-xs font-extrabold text-slate-700">Catatan pemeriksaan <span className="text-red-600">*</span><input required minLength={5} maxLength={500} value={notes[order.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Nominal dan pengirim sesuai" className="mt-2 min-h-11 w-full rounded-md border border-slate-900/15 px-3 text-sm font-normal outline-none focus:border-orange-500" /></label>
                      </div>
                      <div className="flex flex-col justify-end gap-3 border-l-0 border-slate-900/10 lg:border-l lg:pl-5">
                        <p className="flex gap-2 text-xs leading-6 text-slate-500"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={15} /> Persetujuan mengaktifkan maksimal {item?.plan.moduleLimit || "-"} modul untuk satu siswa selama {item?.offer.accessDurationDays || "masa penawaran"} hari.</p>
                        <button disabled={busy === order.id || !selectedStudents[order.id] || (references[order.id]?.trim().length || 0) < 3 || (notes[order.id]?.trim().length || 0) < 5} onClick={() => void approve(order)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-extrabold text-white disabled:opacity-45"><CheckCircle2 size={17} /> Setujui & aktifkan</button>
                        <button disabled={busy === order.id} onClick={() => void reject(order)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-xs font-extrabold text-red-700 disabled:opacity-45"><XCircle size={15} /> Tolak pembayaran</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`mt-6 flex flex-col gap-3 border-l-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${order.status === "PAID" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : order.status === "EXPIRED" ? "border-slate-400 bg-slate-50 text-slate-700" : "border-red-600 bg-red-50 text-red-700"}`}>
                      <p className="flex items-center gap-2 font-bold">{order.status === "PAID" ? <CheckCircle2 size={17} /> : order.status === "EXPIRED" ? <Clock3 size={17} /> : <XCircle size={17} />}{order.status === "PAID" ? "Paket telah aktif untuk siswa." : order.status === "EXPIRED" ? "Batas pembayaran telah lewat; siswa perlu membuat pesanan baru." : "Pembayaran ditolak; akses tidak diberikan."}</p>
                      {order.beneficiary && <p className="flex items-center gap-2"><UserRound size={15} /> {order.beneficiary.fullName} · {order.beneficiary.schoolName}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="min-w-28 border border-slate-900/10 bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p></div>;
}

function Info({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: React.ReactNode }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 flex items-center gap-1.5 ${strong ? "font-black text-slate-950" : "font-bold text-slate-700"}`}>{icon}{value}</p></div>;
}
