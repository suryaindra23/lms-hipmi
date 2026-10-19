import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const navigation = [
  ["Tentang Program", "/tentang"], ["Fitur", "/fitur"], ["Tim", "/#team"], ["Galeri Kegiatan", "/#galeri"], ["Paket", "/paket"], ["Cara Kerja", "/cara-kerja"], ["Untuk Sekolah", "/untuk-sekolah"], ["Keamanan", "/keamanan"], ["FAQ", "/faq"],
];

const legal = [
  ["Kebijakan Privasi", "/kebijakan-privasi"], ["Syarat & Ketentuan", "/syarat-ketentuan"], ["Kebijakan Data Anak", "/kebijakan-data-anak"], ["Pusat Bantuan", "/kontak"],
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-950">
      <div className="mx-auto max-w-[1440px] px-5 pb-9 pt-16 sm:px-8 sm:pt-20 lg:px-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.05fr] lg:gap-10">
          <div className="max-w-sm">
            <Link href="/" aria-label="Sunrise Academy — Beranda" className="inline-block"><BrandLogo className="text-xl" /></Link>
            <h2 className="mt-7 text-2xl font-extrabold tracking-tight">Belajar. Berkarya. Bertumbuh.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Platform pembelajaran digital dan kewirausahaan berbasis praktik untuk sekolah Indonesia.</p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Jelajahi</h2>
            <ul className="mt-5 space-y-3">{navigation.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-slate-600 transition hover:text-orange-700">{label}</Link></li>)}</ul>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Informasi</h2>
            <ul className="mt-5 space-y-3">{legal.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-slate-600 transition hover:text-orange-700">{label}</Link></li>)}</ul>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Mari terhubung</h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">Punya pertanyaan tentang kesiapan sekolah atau alur program?</p>
            <Link href="/#register" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-600 px-5 text-sm font-bold text-white transition hover:bg-orange-700"><Mail size={16} /> Ceritakan kebutuhan</Link>
            <Link href="/login" className="mt-5 flex items-center gap-1.5 text-sm font-bold text-orange-700 hover:underline">Masuk ke platform <ArrowUpRight size={16} /></Link>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-slate-200 pt-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sunrise Academy. Hak cipta dilindungi.</p>
          <p>Pendidikan inklusif adaptif untuk wirausaha digital.</p>
        </div>
      </div>
    </footer>
  );
}
