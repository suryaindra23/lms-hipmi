import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  FileCheck2,
  LockKeyhole,
  MessageSquareText,
  School,
  ShieldCheck,
  Store,
  UserRound,
  Users,
} from "lucide-react";

const steps = [
  ["01", "Tentukan ruang lingkup", "Sekolah memilih peserta, kelas, peran pengguna, dan target program."],
  ["02", "Siapkan pembelajaran", "Guru menyusun materi, brief, checklist, rubrik, dan tenggat yang jelas."],
  ["03", "Jalankan proyek", "Murid mengerjakan, menyimpan draf, mengirim bukti, lalu menerima review."],
  ["04", "Baca perkembangannya", "Sekolah melihat progres, beban review, dan kebutuhan pendampingan."],
];

const audiences = [
  { icon: UserRound, title: "Murid", body: "Tahu apa yang harus dikerjakan, apa yang belum lengkap, dan bagaimana memperbaikinya." },
  { icon: Users, title: "Guru", body: "Menyusun pekerjaan, mereview dengan rubrik, dan mendampingi tanpa berpindah-pindah alat." },
  { icon: ShieldCheck, title: "Orang tua", body: "Melihat ringkasan perkembangan anak tanpa mendapat akses ke data murid lain." },
  { icon: School, title: "Instansi", body: "Memantau jalannya program lintas kelas melalui data yang sudah diringkas." },
];

const protections = [
  "Hak akses mengikuti peran dan sekolah",
  "Data antarorganisasi tetap terpisah",
  "Dokumen identitas disimpan privat",
  "NIK tidak ditampilkan kepada guru",
  "Persetujuan orang tua tercatat",
  "Akses dan perubahan penting diaudit",
];

export default function ProductSections() {
  return (
    <>
      <section id="how-it-works" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Alur program</p>
            <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">Teknologi mengikuti cara sekolah bekerja.</h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">Mulai kecil dari satu kelas atau langsung lintas sekolah. Struktur programnya tetap terbaca oleh semua pihak.</p>
          </div>

          <ol className="mt-14 grid border-y border-slate-900/15 md:grid-cols-2 xl:grid-cols-4">
            {steps.map(([number, title, description], index) => (
              <li key={number} className={`relative min-h-64 p-6 sm:p-8 ${index > 0 ? "border-t border-slate-900/15 md:border-l md:border-t-0 xl:border-l" : ""} ${index === 2 ? "md:border-l-0 xl:border-l" : ""}`}>
                <span className="font-editorial text-4xl italic text-orange-700">{number}</span>
                <h3 className="mt-12 text-lg font-extrabold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white sm:py-28">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:gap-20">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-400">Satu program, pandangan berbeda</p>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">Setiap orang melihat bagian yang memang menjadi tanggung jawabnya.</h2>
            </div>
            <div className="grid border-t border-white/20 sm:grid-cols-2">
              {audiences.map(({ icon: Icon, title, body }, index) => (
                <article key={title} className={`border-b border-white/20 py-7 sm:p-7 ${index % 2 === 1 ? "sm:border-l" : ""}`}>
                  <div className="flex items-center gap-3"><Icon aria-hidden="true" className="text-orange-400" size={20} /><h3 className="font-extrabold">{title}</h3></div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#FFFFFF] py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-14 px-4 sm:px-6 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:px-10">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Contoh proyek</p>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl">Membangun toko digital, langkah demi langkah.</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">Murid tidak diminta sekadar mengirim foto hasil akhir. Guru dapat melihat bagaimana profil toko, produk, operasional, dan bukti kerjanya disusun.</p>

            <div className="mt-9 border-y border-slate-900/15">
              {["Brief dan pilihan platform", "Profil toko dan produk", "Bukti operasional", "Review dan kesempatan revisi"].map((item, index) => (
                <div key={item} className="flex items-center gap-4 border-b border-slate-900/10 py-4 last:border-b-0">
                  <span className="text-[10px] font-extrabold text-orange-700">0{index + 1}</span><p className="text-sm font-bold text-slate-800">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -bottom-4 -right-4 left-4 top-4 border border-slate-900/15 bg-[#D3E5E1]" />
            <div className="relative border border-slate-900/15 bg-white">
              <div className="flex items-center justify-between border-b border-slate-900/10 px-5 py-4 sm:px-7">
                <div className="flex items-center gap-3"><Store className="text-orange-700" size={20} /><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tugas praktik</p><h3 className="font-extrabold text-slate-950">Toko produk lokal</h3></div></div>
                <span className="text-xs font-bold text-slate-500">Draf</span>
              </div>
              <div className="p-5 sm:p-7">
                <div className="flex items-end justify-between gap-4"><div><p className="text-xs text-slate-500">Kelengkapan</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">8 dari 10</p></div><p className="max-w-36 text-right text-[11px] leading-4 text-slate-500">Dua bagian perlu dilengkapi sebelum dikirim.</p></div>
                <div className="mt-5 h-2 bg-slate-100"><div className="h-full w-4/5 bg-orange-600" /></div>

                <div className="mt-7 divide-y divide-slate-900/10 border-y border-slate-900/10">
                  <ChecklistRow label="URL toko dapat dibuka" status="Selesai" done />
                  <ChecklistRow label="Minimal lima produk aktif" status="Selesai" done />
                  <ChecklistRow label="Bukti pengiriman pertama" status="Belum ada" />
                </div>

                <div className="mt-6 flex items-start gap-3 border-l-2 border-slate-950 pl-4">
                  <MessageSquareText className="mt-0.5 shrink-0 text-orange-700" size={17} />
                  <p className="text-xs leading-5 text-slate-600"><strong className="text-slate-900">Catatan guru:</strong> foto produk sudah konsisten. Tambahkan kebijakan pengiriman sebelum mengirim versi final.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-12 border-y border-slate-900/15 py-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20 lg:py-16">
            <div>
              <LockKeyhole className="text-orange-700" size={28} />
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Data seperlunya</p>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">Aman bukan berarti rumit bagi pengguna.</h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">Kontrol keamanan berjalan di belakang layar, sementara setiap peran tetap mendapat pengalaman yang sederhana.</p>
            </div>
            <ul className="grid content-start gap-x-8 sm:grid-cols-2">
              {protections.map((item) => (
                <li key={item} className="flex items-start gap-3 border-b border-slate-900/10 py-5 text-sm font-bold leading-6 text-slate-700">
                  <FileCheck2 aria-hidden="true" className="mt-0.5 shrink-0 text-orange-700" size={18} />{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-orange-100 py-16 text-slate-950 sm:py-20">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Mulai dari kebutuhan nyata</p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Ceritakan program yang ingin sekolah Anda jalankan.</h2>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link href="/#register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange-600 px-6 text-sm font-extrabold text-white transition hover:bg-orange-700">Hubungi tim kami <ArrowRight size={17} /></Link>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center px-5 text-sm font-extrabold text-slate-950 underline decoration-slate-950/35 underline-offset-4">Sudah punya akun? Masuk</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ChecklistRow({ label, status, done = false }: { label: string; status: string; done?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 text-xs">
      <span className="flex items-center gap-3 font-bold text-slate-700">{done ? <CircleCheck className="text-emerald-600" size={17} /> : <span className="grid size-[17px] place-items-center rounded-full border border-slate-300 text-[9px] text-slate-400">·</span>}{label}</span>
      <span className={done ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>{status}</span>
    </div>
  );
}
