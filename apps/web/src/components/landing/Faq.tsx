"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  ["Apa fungsi utama Sunrise Academy?", "Platform ini menyatukan pembelajaran, praktik toko digital, submission konten affiliate, review, penilaian, dan monitoring perkembangan siswa dalam satu alur."],
  ["Siapa saja yang dapat menggunakan platform?", "Siswa, guru, orang tua, admin sekolah, kepala sekolah, reviewer, dan pengelola program mendapat tampilan serta akses sesuai kewenangannya."],
  ["Apakah dapat digunakan melalui smartphone?", "Ya. Antarmuka dirancang mobile-first agar materi, draf, checklist, submission, feedback, dan monitoring tetap nyaman digunakan di layar kecil."],
  ["Marketplace apa saja yang dapat didukung?", "Program dapat mengonfigurasi platform seperti Shopee, TikTok Shop, Tokopedia, Lazada, Instagram Shop, WhatsApp Business, atau website toko sendiri."],
  ["Apakah siswa harus memberikan password toko?", "Tidak. Password, PIN, OTP, cookie, token, dan kredensial marketplace tidak boleh diminta atau disimpan oleh platform."],
  ["Bagaimana sekolah memantau perkembangan siswa?", "Sekolah melihat data agregat seperti progres pembelajaran, status submission, antrean review, dan kebutuhan pendampingan sesuai ruang lingkup izinnya."],
  ["Apa yang dapat dilihat orang tua?", "Orang tua hanya melihat ringkasan progres, tugas, feedback yang diizinkan, dan nilai anak yang telah terhubung melalui relasi wali yang sah."],
  ["Bagaimana data siswa dilindungi?", "Akses berbasis peran, isolasi antar sekolah, enkripsi data sensitif, penyimpanan file privat, audit aktivitas, consent, dan redaksi export diterapkan secara berlapis."],
  ["Apakah guru dapat melihat NIK atau dokumen identitas?", "Tidak secara default. Verifikasi identitas dipisahkan dari peran akademik dan memerlukan izin sensitif tersendiri."],
  ["Bagaimana sekolah mendaftar?", "Isi formulir pendaftaran di halaman ini. Data masuk sebagai lead untuk diverifikasi; platform tidak otomatis membuat tenant sebelum proses peninjauan."],
  ["Apakah tugas dapat disesuaikan?", "Ya. Guru dapat mengatur brief, platform, checklist, bukti, target, rubrik, deadline, dan jumlah percobaan sesuai program."],
  ["Apakah laporan bisa diekspor?", "Laporan dapat disaring dan diekspor sesuai peran, tenant, serta kebijakan redaksi data sensitif."],
  ["Apakah siswa dapat memperbaiki tugas?", "Ya. Guru dapat meminta revisi dan setiap pengiriman ulang disimpan sebagai versi baru agar riwayat proses tetap utuh."],
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#FFFFFF] py-20 sm:py-28">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-6 lg:grid-cols-[.68fr_1.32fr] lg:gap-20 lg:px-10">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Pertanyaan umum</p><h2 className="text-balance mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">Hal yang biasanya ditanyakan sebelum sekolah memulai.</h2><p className="mt-5 leading-7 text-slate-600">Belum menemukan jawabannya? Gunakan formulir di atas dan tulis pertanyaan pada bagian pesan.</p></div>
        <div className="divide-y divide-slate-900/15 border-y border-slate-900/15">
          {faqs.map(([question, answer], index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;
            return <div key={question}><button type="button" onClick={() => setOpenIndex(isOpen ? null : index)} className="grid min-h-16 w-full grid-cols-[28px_1fr_20px] items-center gap-3 py-4 text-left text-sm font-extrabold text-slate-900 hover:text-orange-700" aria-expanded={isOpen} aria-controls={answerId}><span className="text-[10px] text-slate-400">{String(index + 1).padStart(2, "0")}</span><span>{question}</span><ChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? "rotate-180 text-orange-700" : "text-slate-400"}`} size={18} /></button>{isOpen && <div id={answerId} className="pb-6 pl-10 pr-8 text-sm leading-7 text-slate-600">{answer}</div>}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
