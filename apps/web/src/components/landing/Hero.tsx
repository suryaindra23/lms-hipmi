import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

const programNotes = [
  { number: "01", title: "Belajar", description: "Materi dan tugas disusun dalam alur yang jelas." },
  { number: "02", title: "Praktik", description: "Murid membangun karya digital dengan pendampingan guru." },
  { number: "03", title: "Bertumbuh", description: "Perkembangan terlihat oleh pihak yang berwenang." },
];

export default function Hero() {
  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-20 pt-8 sm:px-8 sm:pb-28 lg:min-h-[calc(100vh-6rem)] lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:gap-16 lg:px-12 lg:pb-24 lg:pt-10">
        <div className="relative min-h-[380px] overflow-hidden rounded-[2rem] bg-slate-100 sm:min-h-[540px] lg:h-[min(72vh,720px)]">
          <Image
            src="/images/activities/sesi-digital-marketing.webp"
            alt="Pemateri dan murid belajar bisnis digital bersama di aula sekolah"
            fill
            sizes="(max-width: 1024px) 100vw, 46vw"
            preload
            className="object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-950/75 to-transparent" aria-hidden="true" />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 text-white sm:bottom-9 sm:left-9 sm:right-9">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">Cerita dari sekolah</p>
              <p className="mt-2 max-w-xs text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">Pengetahuan tumbuh saat dipraktikkan.</p>
            </div>
            <Link href="/#galeri" aria-label="Lihat galeri kegiatan" className="grid size-11 shrink-0 place-items-center rounded-full border border-white/70 text-white transition hover:bg-white hover:text-slate-950">
              <ArrowUpRight aria-hidden="true" size={20} />
            </Link>
          </div>
        </div>

        <div className="pb-1 lg:py-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Program praktik digital untuk sekolah</p>
          <h1 className="mt-7 max-w-3xl text-[clamp(3rem,6vw,6.4rem)] font-extrabold leading-[.96] tracking-[-0.068em] text-slate-950">
            Belajar bisnis <span className="text-orange-700">digital,</span>
            <span className="block">benar-benar dipraktikkan.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Sunrise Academy membantu guru menjalankan pembelajaran berbasis proyek, dari materi dan praktik toko hingga review serta laporan perkembangan murid.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/#register" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-orange-600 px-6 text-sm font-bold text-white transition hover:bg-orange-700">
              Ceritakan kebutuhan sekolah <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link href="/#how-it-works" className="inline-flex min-h-12 items-center gap-2 px-2 text-sm font-bold text-slate-700 transition hover:text-orange-700">
              Pelajari alurnya <ArrowDownRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <div className="mt-12 border-t border-slate-200">
            {programNotes.map((note) => (
              <div key={note.number} className="grid grid-cols-[2.5rem_7rem_1fr] gap-2 border-b border-slate-200 py-4 text-sm sm:grid-cols-[3rem_8rem_1fr]">
                <span className="font-extrabold text-orange-700">{note.number}</span>
                <strong className="text-slate-950">{note.title}</strong>
                <span className="leading-6 text-slate-600">{note.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
