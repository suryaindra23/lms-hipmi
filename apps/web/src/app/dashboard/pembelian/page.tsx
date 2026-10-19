"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, CreditCard, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import CopyValueButton from "@/components/CopyValueButton";
import { csrfFetch } from "@/lib/csrf";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalAmount: string;
  feeAmount: string;
  totalAmount: string;
  paymentExpiresAt: string | null;
  createdAt: string;
  items: Array<{ plan: { code: string; name: string }; offer: { name: string; accessDurationDays: number | null } }>;
  paymentInstructions: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    uniqueCode: number;
    transferAmount: string;
  } | null;
  nextAction: { message: string } | null;
};

const statusCopy: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draf", tone: "bg-slate-100 text-slate-700" },
  PENDING_PAYMENT: { label: "Menunggu pembayaran", tone: "bg-amber-50 text-amber-800" },
  PAID: { label: "Lunas", tone: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "Dibatalkan", tone: "bg-slate-100 text-slate-600" },
  EXPIRED: { label: "Kedaluwarsa", tone: "bg-red-50 text-red-700" },
  REFUNDED: { label: "Dikembalikan", tone: "bg-blue-50 text-blue-700" },
  FAILED: { label: "Gagal", tone: "bg-red-50 text-red-700" },
};

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
}

function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function PurchaseHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/backend/commerce/orders", { cache: "no-store" });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.message || "Riwayat pembelian belum dapat dimuat");
      setOrders(Array.isArray(data) ? data : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Riwayat pembelian belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function cancel(order: Order) {
    if (!window.confirm(`Batalkan pesanan ${order.orderNumber}?`)) return;
    setBusy(order.id);
    setError("");
    try {
      const response = await csrfFetch(`/api/backend/commerce/orders/${order.id}/cancel`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Pesanan belum dapat dibatalkan");
      setOrders((current) => current.map((item) => item.id === order.id ? data as Order : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pesanan belum dapat dibatalkan");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Pembelian & akses</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">Riwayat pesanan paket</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Pantau nomor pesanan, rekening tujuan, total transfer, dan status pembayaran.</p>
          </div>
          <Link href="/paket" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-extrabold text-white">Lihat paket <ArrowRight size={16} /></Link>
        </div>

        {error && <p role="alert" className="mt-6 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="mt-8 flex min-h-52 items-center justify-center gap-3 border-y border-slate-900/10 text-sm font-bold text-slate-500"><RefreshCw className="animate-spin" size={17} /> Memuat riwayat pesanan…</div>
        ) : orders.length === 0 ? (
          <section className="mt-8 grid min-h-64 place-items-center border-y border-slate-900/10 bg-white/40 p-8 text-center">
            <div><CreditCard className="mx-auto text-orange-700" size={28} /><h3 className="mt-4 font-extrabold text-slate-950">Belum ada pesanan</h3><p className="mt-2 text-sm text-slate-600">Pilih paket ketika Anda siap meningkatkan akses.</p></div>
          </section>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((order) => {
              const status = statusCopy[order.status] || { label: order.status, tone: "bg-slate-100 text-slate-700" };
              const item = order.items[0];
              return (
                <article key={order.id} className="border border-slate-900/10 bg-white p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-full bg-orange-50 text-orange-700"><ReceiptText size={18} /></span>
                        <div><p className="text-xs font-bold text-slate-500">{order.orderNumber}</p><h3 className="mt-0.5 font-extrabold text-slate-950">{item?.offer.name || item?.plan.name || "Paket akses"}</h3></div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${status.tone}`}>{status.label}</span>
                      </div>
                      <div className="mt-5 grid gap-4 border-t border-slate-900/10 pt-5 text-sm sm:grid-cols-3">
                        <div><p className="text-xs text-slate-500">Total transfer</p><p className="mt-1 font-extrabold text-slate-950">{money(order.totalAmount, order.currency)}</p></div>
                        <div><p className="text-xs text-slate-500">Dibuat</p><p className="mt-1 font-bold text-slate-700">{date(order.createdAt)}</p></div>
                        <div><p className="text-xs text-slate-500">Batas pembayaran</p><p className="mt-1 flex items-center gap-1.5 font-bold text-slate-700"><Clock3 size={14} /> {date(order.paymentExpiresAt)}</p></div>
                      </div>
                      {order.status === "PENDING_PAYMENT" && order.paymentInstructions && (
                        <section className="mt-5 border border-orange-200 bg-orange-50 p-4" aria-label="Instruksi transfer bank">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-bold text-slate-500">Rekening tujuan</p>
                              <p className="mt-1 font-extrabold text-slate-950">{order.paymentInstructions.bankName} · {order.paymentInstructions.accountNumber}</p>
                              <p className="mt-1 text-xs text-slate-600">a.n. {order.paymentInstructions.accountHolder}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-500">Transfer tepat</p>
                              <p className="mt-1 text-xl font-black text-slate-950">{money(order.paymentInstructions.transferAmount, order.currency)}</p>
                              <p className="mt-1 text-xs text-orange-800">Kode unik: {String(order.paymentInstructions.uniqueCode).padStart(3, "0")}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-orange-200 pt-4">
                            <CopyValueButton value={order.paymentInstructions.accountNumber} label="Salin rekening" />
                            <CopyValueButton value={String(Math.round(Number(order.paymentInstructions.transferAmount)))} label="Salin nominal" />
                          </div>
                        </section>
                      )}
                      {order.nextAction && !order.paymentInstructions && <p className="mt-5 border-l-2 border-orange-500 bg-orange-50 px-4 py-3 text-xs leading-6 text-slate-600">{order.nextAction.message}</p>}
                    </div>
                    {order.status === "PENDING_PAYMENT" && (
                      <div className="flex shrink-0 gap-2">
                        <Link href="/kontak" className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-xs font-extrabold text-white">Butuh bantuan?</Link>
                        <button type="button" disabled={busy === order.id} onClick={() => void cancel(order)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-900/15 px-4 text-xs font-extrabold text-slate-600 hover:text-red-700 disabled:opacity-50"><XCircle size={15} /> Batalkan</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
