import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6"><div className="max-w-md rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm"><WifiOff className="mx-auto text-orange-600" size={40} /><h1 className="mt-5 text-2xl font-extrabold text-slate-900">Anda sedang offline</h1><p className="mt-3 text-sm leading-6 text-slate-600">Halaman publik yang pernah dibuka tetap tersedia. Data akun, dashboard, dan API tidak pernah disimpan di cache publik. Draf lokal akan disinkronkan saat koneksi kembali.</p><Link href="/" className="bg-sunrise mt-6 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold text-white">Kembali ke beranda</Link></div></main>;
}
