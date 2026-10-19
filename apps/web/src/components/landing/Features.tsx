import { ArrowDownRight, BookOpen, ChartNoAxesCombined, ClipboardCheck, FileText, ShieldCheck, Users } from "lucide-react";

const phases = [
  { number: "01", title: "Pahami dasarnya", description: "Materi singkat dan contoh yang dekat dengan keseharian murid. Tidak perlu menebak harus mulai dari mana." },
  { number: "02", title: "Kerjakan proyeknya", description: "Murid membuat toko, produk, atau konten. Draf dan bukti kerja tersimpan sepanjang proses." },
  { number: "03", title: "Perbaiki dengan arahan", description: "Guru memberi catatan berbasis rubrik. Murid tahu apa yang sudah baik dan apa yang perlu diulang." },
];

const capabilities = [
  { icon: BookOpen, title: "Ruang belajar", description: "Modul, materi, tugas, tenggat, dan progres berada dalam urutan yang mudah diikuti." },
  { icon: ClipboardCheck, title: "Pekerjaan murid", description: "Toko digital dan konten affiliate dinilai sebagai proses, bukan satu tangkapan layar." },
  { icon: Users, title: "Review guru", description: "Rubrik, komentar, revisi, dan nilai memiliki riwayat yang jelas untuk kedua pihak." },
  { icon: ChartNoAxesCombined, title: "Pandangan instansi", description: "Sekolah melihat partisipasi, progres kelas, dan kebutuhan pendampingan secara ringkas." },
  { icon: FileText, title: "Laporan yang siap dipakai", description: "Data dapat disaring berdasarkan sekolah, kelas, periode, dan kewenangan pengguna." },
  { icon: ShieldCheck, title: "Akses sesuai peran", description: "Murid, guru, orang tua, dan pengelola hanya melihat informasi yang memang dibutuhkan." },
];

export default function Features() {
  return (
    <>
      <section id="about" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Pendekatan kami</p>
              <h2 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Keterampilan tumbuh dari pekerjaan yang selesai, bukan materi yang lewat.
              </h2>
            </div>
            <div className="lg:pt-8">
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Program digital sering berhenti di webinar dan sertifikat. Sunrise Academy mengubahnya menjadi rutinitas belajar: ada brief, hasil kerja, review, revisi, dan perkembangan yang bisa dibaca bersama.
              </p>
              <div className="mt-9 flex items-center gap-3 text-sm font-extrabold text-slate-900">
                <span className="grid size-9 place-items-center rounded-full border border-slate-900/15"><ArrowDownRight size={16} /></span>
                Tiga tahap yang terus berulang
              </div>
            </div>
          </div>

          <div className="mt-14 grid border-y border-slate-900/15 md:grid-cols-3">
            {phases.map((phase, index) => (
              <article key={phase.number} className={`py-8 md:px-8 md:py-10 ${index > 0 ? "border-t border-slate-900/15 md:border-l md:border-t-0" : ""}`}>
                <p className="font-editorial text-3xl italic text-orange-700">{phase.number}</p>
                <h3 className="mt-8 text-xl font-extrabold text-slate-950">{phase.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{phase.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-slate-900/10 bg-[#FFFFFF] py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Yang dikelola</p>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">Cukup lengkap untuk program sekolah. Tetap sederhana untuk dipakai setiap hari.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">Setiap bagian punya alasan untuk ada. Tidak ada fitur yang sekadar memenuhi dashboard.</p>
            </div>

            <div className="border-t border-slate-900/15">
              {capabilities.map(({ icon: Icon, title, description }, index) => (
                <article key={title} className="grid grid-cols-[36px_1fr] gap-4 border-b border-slate-900/15 py-6 sm:grid-cols-[44px_180px_1fr] sm:items-start sm:gap-6">
                  <span className="grid size-9 place-items-center rounded-full border border-slate-900/15 bg-white text-orange-700 sm:size-11"><Icon aria-hidden="true" size={18} /></span>
                  <div className="flex items-baseline gap-2"><span className="text-[10px] font-bold text-slate-400">0{index + 1}</span><h3 className="text-base font-extrabold text-slate-950">{title}</h3></div>
                  <p className="col-start-2 text-sm leading-7 text-slate-600 sm:col-start-auto">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
