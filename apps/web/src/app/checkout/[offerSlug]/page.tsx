"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ReceiptText, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import CopyValueButton from "@/components/CopyValueButton";
import { csrfFetch } from "@/lib/csrf";

type PublicPlan = {
  code: string;
  name: string;
  moduleLimit: number;
  offers: Array<{
    slug: string;
    name: string;
    accessDurationDays: number | null;
    prices: Array<{ currency: string; amount: string; compareAtAmount: string | null }>;
  }>;
};

type OrderResult = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalAmount: string;
  feeAmount: string;
  totalAmount: string;
  paymentExpiresAt: string | null;
  items: Array<{ plan: { code: string; name: string; moduleLimit: number }; offer: { name: string; accessDurationDays: number | null } }>;
  paymentInstructions: {
    method: "BANK_TRANSFER";
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    baseAmount: string;
    uniqueCode: number;
    transferAmount: string;
    expiresAt: string | null;
  } | null;
  nextAction: { type: string; message: string } | null;
};

function money(amount: string | number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
}

function formatDate(value: string | null) {
  if (!value) return "batas waktu yang tertera";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function CheckoutPage() {
  const params = useParams<{ offerSlug: string }>();
  const offerSlug = params.offerSlug;
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    Promise.all([
      fetch("/api/backend/access/plans", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : []),
      fetch("/api/session", { cache: "no-store" }).then((response) => response.ok),
    ])
      .then(([planData, sessionActive]) => {
        setPlans(Array.isArray(planData) ? planData : []);
        setAuthenticated(sessionActive);
      })
      .catch(() => setError("Detail paket belum dapat dimuat. Coba lagi beberapa saat."))
      .finally(() => setLoading(false));
  }, []);

  const selected = (() => {
    for (const plan of plans) {
      const offer = plan.offers.find((item) => item.slug === offerSlug);
      if (offer) return { plan, offer, price: offer.prices[0] };
    }
    return null;
  })();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !accepted || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await csrfFetch("/api/backend/commerce/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerSlug, idempotencyKey, acceptTerms: accepted }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Pesanan belum dapat dibuat");
      setOrder(data as OrderResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pesanan belum dapat dibuat");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CheckoutState text="Menyiapkan detail pembelian…" />;

  if (!selected) {
    return (
      <CheckoutState text="Paket tidak tersedia." description="Penawaran mungkin sudah berakhir atau belum aktif.">
        <Link href="/paket" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-extrabold text-white"><ArrowLeft size={16} /> Kembali ke paket</Link>
      </CheckoutState>
    );
  }

  if (authenticated === false) {
    return (
      <CheckoutState text="Masuk untuk melanjutkan pembelian." description="Pesanan perlu ditautkan ke akun yang akan menerima akses.">
        <Link href={`/login?offer=${encodeURIComponent(offerSlug)}`} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-extrabold text-white">Masuk ke akun <ArrowRight size={16} /></Link>
      </CheckoutState>
    );
  }

  if (order) {
    const payment = order.paymentInstructions;
    return (
      <main className="min-h-screen bg-[#FFFFFF] px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <BrandLogo className="text-xl" />
          <section className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-9" aria-labelledby="order-success-title">
            <CheckCircle2 className="text-emerald-600" size={34} aria-hidden="true" />
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Pesanan tercatat</p>
            <h1 id="order-success-title" className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl">Selesaikan pembayaran melalui transfer bank.</h1>
            <dl className="mt-8 divide-y divide-slate-900/10 border-y border-slate-900/10 text-sm">
              <OrderRow label="Nomor pesanan" value={order.orderNumber} strong />
              <OrderRow label="Paket" value={order.items[0]?.plan.name || selected.plan.name} />
              <OrderRow label="Harga paket" value={money(order.subtotalAmount, order.currency)} />
              <OrderRow label="Kode unik" value={String(payment?.uniqueCode ?? Number(order.feeAmount)).padStart(3, "0")} />
              <OrderRow label="Total transfer" value={money(order.totalAmount, order.currency)} strong />
              <OrderRow label="Status" value="Menunggu pembayaran" />
            </dl>
            {payment && (
              <section className="mt-7 border border-orange-200 bg-orange-50 p-5" aria-labelledby="bank-transfer-title">
                <p id="bank-transfer-title" className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-700">Rekening tujuan</p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-950">{payment.bankName} · {payment.accountNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">a.n. {payment.accountHolder}</p>
                  </div>
                  <CopyValueButton value={payment.accountNumber} label="Salin rekening" />
                </div>
                <div className="mt-5 border-t border-orange-200 pt-5">
                  <p className="text-xs font-bold text-slate-500">Nominal yang harus ditransfer</p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-3xl font-black tracking-tight text-slate-950">{money(payment.transferAmount, order.currency)}</p>
                    <CopyValueButton value={String(Math.round(Number(payment.transferAmount)))} label="Salin nominal" />
                  </div>
                  <p className="mt-3 text-xs font-bold leading-5 text-orange-800">Transfer tepat sampai 3 digit terakhir. Jangan membulatkan nominal agar pembayaran mudah dicocokkan.</p>
                </div>
              </section>
            )}
            <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-slate-600"><Clock3 className="mt-0.5 shrink-0 text-orange-700" size={15} /> Selesaikan pembayaran sebelum {formatDate(order.paymentExpiresAt)}. Akses aktif setelah pembayaran diverifikasi.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/pembelian" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-extrabold text-white">Lihat riwayat pesanan <ArrowRight size={16} /></Link>
              <Link href="/kontak" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-900/15 px-5 text-sm font-extrabold text-slate-800">Butuh bantuan?</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const price = selected.price;
  return (
    <main className="min-h-screen bg-[#FFFFFF] text-slate-950">
      <header>
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-4 sm:h-24 sm:px-6">
          <Link href="/"><BrandLogo className="text-xl" /></Link>
          <Link href="/paket" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600 hover:text-orange-700"><ArrowLeft size={16} /> Kembali ke paket</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-20">
        <section>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Ringkasan pilihan</p>
          <h1 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">{selected.plan.name}</h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-slate-600">Akses paket ini berlaku untuk satu siswa, bukan satu sekolah.</p>

          <div className="mt-9 border-y border-slate-900/15 py-6">
            {price?.compareAtAmount && <del className="text-sm font-bold text-slate-400">{money(price.compareAtAmount, price.currency)}</del>}
            <p className="mt-2 text-4xl font-black tracking-tight">{price ? money(price.amount, price.currency) : "Harga belum tersedia"}</p>
            <p className="mt-2 text-sm text-slate-500">Harga per siswa · akses {selected.offer.accessDurationDays || "sesuai penawaran"} hari</p>
          </div>

          <ul className="mt-8 space-y-4 text-sm text-slate-700">
            <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-emerald-600" size={18} /> Maksimal {selected.plan.moduleLimit} modul terbit</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-orange-700" size={18} /> Akses hanya aktif setelah pembayaran terverifikasi</li>
            <li className="flex gap-3"><ReceiptText className="mt-0.5 shrink-0 text-orange-700" size={18} /> Kode unik 3 digit ditambahkan pada nominal transfer</li>
            <li className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-orange-700" size={18} /> Pesanan berlaku 24 jam</li>
          </ul>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-9" aria-labelledby="checkout-title">
          <div className="flex items-center gap-3"><ReceiptText className="text-orange-700" size={23} /><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Konfirmasi pesanan</p></div>
          <h2 id="checkout-title" className="mt-6 text-3xl font-extrabold tracking-[-0.04em]">Periksa sebelum membuat pesanan.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Tahap ini belum memotong saldo. Setelah pesanan dibuat, rekening BCA dan total transfer akan langsung ditampilkan.</p>

          <dl className="mt-8 divide-y divide-slate-900/10 border-y border-slate-900/10 text-sm">
            <OrderRow label="Paket" value={selected.offer.name} />
            <OrderRow label="Penerima" value="1 siswa" />
            <OrderRow label="Durasi" value={`${selected.offer.accessDurationDays || "-"} hari`} />
            <OrderRow label="Harga paket" value={price ? money(price.amount, price.currency) : "-"} strong />
            <OrderRow label="Kode unik" value="Ditentukan setelah pesanan dibuat" />
          </dl>

          <p className="mt-4 border-l-2 border-orange-500 bg-orange-50 px-4 py-3 text-xs leading-6 text-slate-600">Total transfer adalah harga paket ditambah kode unik 3 digit sebesar Rp1–Rp999.</p>

          <form onSubmit={submit} className="mt-7">
            {error && <p role="alert" className="mb-5 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <label className="flex cursor-pointer items-start gap-3 border border-slate-900/10 bg-white p-4 text-xs leading-6 text-slate-600">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 size-4 accent-orange-600" />
              <span>Saya memahami detail paket dan menyetujui <Link href="/syarat-ketentuan" className="font-bold text-orange-700 underline">Syarat & Ketentuan</Link> serta kebijakan pembayaran yang berlaku.</span>
            </label>
            <button disabled={!accepted || submitting || !price} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-slate-950 px-5 text-sm font-extrabold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-45">
              {submitting ? "Membuat pesanan…" : "Buat pesanan"} {!submitting && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 shrink-0" size={15} /> Harga disalin ke pesanan sehingga perubahan harga berikutnya tidak mengubah pesanan ini.</p>
        </section>
      </div>
    </main>
  );
}

function CheckoutState({ text, description, children }: { text: string; description?: string; children?: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFFFF] px-4">
      <section className="w-full max-w-lg rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center">
        <BrandLogo className="mx-auto text-xl" />
        <h1 className="mt-8 text-2xl font-extrabold text-slate-950">{text}</h1>
        {description && <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>}
        {children}
      </section>
    </main>
  );
}

function OrderRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-6 py-4"><dt className="text-slate-500">{label}</dt><dd className={`text-right ${strong ? "font-extrabold text-slate-950" : "font-bold text-slate-700"}`}>{value}</dd></div>;
}
