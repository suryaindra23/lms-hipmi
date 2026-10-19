"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Expand, X } from "lucide-react";

const photos = [
  { file: "turen-foto-bersama", title: "Bersama membangun masa depan.", alt: "Tujuh orang berfoto bersama di depan layar Kelas Inspirasi Digital di SMK Negeri 1 Turen" },
  { file: "turen-interaksi-kelas", title: "Diskusi yang menghidupkan kelas", alt: "Pemateri berinteraksi langsung dengan para murid di aula SMK Negeri 1 Turen" },
  { file: "turen-peserta-menyimak", title: "Menyimak, mencatat, belajar", alt: "Para murid menyimak sesi dengan buku catatan di meja masing-masing" },
  { file: "turen-kebersamaan-peserta", title: "Satu kelas, banyak harapan", alt: "Para murid, guru, dan pemateri berfoto bersama setelah kegiatan di aula" },
  { file: "turen-kelas-inspirasi", title: "Dari hobi digital jadi keterampilan", alt: "Suasana kelas dengan pemateri dan layar bertuliskan Dari Hobi Digital Jadi Skill Masa Depan" },
  { file: "turen-berbagi-pesan", title: "Pesan untuk langkah berikutnya", alt: "Seorang perempuan berseragam cokelat menyampaikan pesan dengan mikrofon di hadapan para murid" },
  { file: "turen-diskusi-sekolah", title: "Percakapan yang membuka peluang", alt: "Dua perempuan berseragam cokelat duduk di meja depan, salah satunya berbicara menggunakan mikrofon" },
  { file: "turen-pemateri-digital", title: "Berbagi pengalaman digital", alt: "Pemateri berkemeja biru menjelaskan materi sambil memegang mikrofon dan mengangkat tangan" },
  { file: "turen-sambutan-sekolah", title: "Sambutan penuh semangat", alt: "Seorang perempuan berhijab kuning memberikan sambutan di depan para murid" },
  { file: "kebersamaan-sekolah", title: "Satu ruang, banyak semangat.", alt: "Foto bersama di aula sekolah dengan para murid sebagai latar" },
  { file: "sesi-digital-marketing", title: "Mengenal dunia digital", alt: "Pemateri menjelaskan digital marketing di depan layar presentasi" },
  { file: "peserta-kegiatan", title: "Ruang untuk belajar bersama", alt: "Para murid menyimak kegiatan dari area tempat duduk di aula" },
  { file: "suasana-aula", title: "Cerita dari aula sekolah", alt: "Suasana aula yang dipenuhi murid saat sesi berlangsung" },
  { file: "sesi-berbagi", title: "Berbagi pengetahuan", alt: "Pemateri berbicara di panggung di hadapan para peserta" },
  { file: "belajar-bersama", title: "Belajar dalam kebersamaan", alt: "Para peserta mengikuti sesi bersama di aula sekolah" },
  { file: "momen-kegiatan", title: "Pertemuan yang berarti", alt: "Enam orang berfoto bersama di depan para murid peserta kegiatan" },
  { file: "senyum-bersama", title: "Ditutup dengan senyum", alt: "Momen ceria saat foto bersama dengan gestur tangan dan senyuman" },
  { file: "foto-bersama", title: "Kenangan dari sekolah", alt: "Foto bersama dengan suasana aula dan seluruh peserta di belakang" },
];

export default function ActivityGallery() {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = selected !== null;

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function movePhoto(direction: number) {
    setSelected((current) => current === null ? null : (current + direction + photos.length) % photos.length);
  }

  function photoCard(index: number, featured = false) {
    const photo = photos[index];
    return (
      <button
        key={photo.file}
        type="button"
        onClick={() => setSelected(index)}
        aria-label={`Perbesar foto: ${photo.title}`}
        aria-haspopup="dialog"
        className={`group relative isolate block w-full overflow-hidden rounded-[1.5rem] bg-slate-800 text-left ${featured ? "aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto" : "aspect-video"}`}
      >
        <Image
          src={`/images/activities/${photo.file}.webp`}
          alt={photo.alt}
          fill
          sizes={featured ? "(max-width: 640px) 100vw, (max-width: 1280px) 64vw, 800px" : "(max-width: 640px) 100vw, (max-width: 1280px) 32vw, 400px"}
          className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-sm transition-colors group-hover:bg-orange-700">
          <Expand aria-hidden="true" size={17} />
        </span>
        <span className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 text-white ${featured ? "p-6 sm:p-8" : "p-5"}`}>
          <span>
            {featured && <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200">Momen kebersamaan</span>}
            <span className={`block font-extrabold tracking-tight ${featured ? "max-w-sm text-2xl sm:text-3xl" : "text-base"}`}>{photo.title}</span>
          </span>
          <span aria-hidden="true" className="font-editorial text-2xl italic text-white/80">{String(index + 1).padStart(2, "0")}</span>
        </span>
      </button>
    );
  }

  return (
    <section id="galeri" aria-labelledby="gallery-heading" className="scroll-mt-20 border-b border-slate-900/10 bg-[#FFFFFF] py-16 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Galeri kegiatan</p>
            <h2 id="gallery-heading" className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl">Belajar bersama.<br /><span className="font-editorial font-normal italic text-orange-700">Cerita yang terasa nyata.</span></h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-slate-600">Cuplikan pertemuan, sesi berbagi, dan kebersamaan di sekolah. Kenali suasana kegiatan kami lebih dekat.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {photoCard(0, true)}
          {photoCard(1)}
          {photoCard(2)}
        </div>
        <div id="more-activity-photos" hidden={!expanded}>
          {expanded && <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-3 sm:gap-4">{photos.slice(3).map((_, index) => photoCard(index + 3))}</div>}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-900/15 pt-5">
          <p className="text-xs font-semibold text-slate-500">{photos.length} foto kegiatan · Klik foto untuk melihat lebih dekat</p>
          <button type="button" aria-expanded={expanded} aria-controls="more-activity-photos" onClick={() => setExpanded(!expanded)} className="inline-flex min-h-11 items-center gap-3 text-sm font-extrabold text-slate-900 hover:text-orange-700">
            {expanded ? "Tampilkan lebih sedikit" : "Lihat semua foto"}
            {expanded ? <ArrowUp aria-hidden="true" size={17} /> : <ArrowDown aria-hidden="true" size={17} />}
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="activity-photo-title"
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            movePhoto(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        className="fixed inset-0 m-auto max-h-[95dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto border border-white/20 bg-slate-950 p-0 text-white shadow-2xl backdrop:bg-slate-950/90 backdrop:backdrop-blur-sm"
      >
        {selected !== null && <>
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-200">Galeri kegiatan</p>
            <button type="button" aria-label="Tutup foto" onClick={() => setSelected(null)} className="grid size-11 place-items-center rounded-full hover:bg-white/10"><X aria-hidden="true" size={22} /></button>
          </div>
          <div className="relative aspect-video max-h-[62dvh] bg-black/20">
            <Image src={`/images/activities/${photos[selected].file}.webp`} alt={photos[selected].alt} fill sizes="(max-width: 1200px) 95vw, 1152px" className="object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-xs text-orange-200">{selected + 1} / {photos.length}</p>
              <h3 id="activity-photo-title" className="mt-1 text-base font-bold sm:text-xl">{photos[selected].title}</h3>
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label="Foto sebelumnya" onClick={() => movePhoto(-1)} className="grid size-12 place-items-center rounded-full border border-white/25 hover:bg-white/10"><ArrowLeft aria-hidden="true" size={20} /></button>
              <button type="button" aria-label="Foto berikutnya" onClick={() => movePhoto(1)} className="grid size-12 place-items-center rounded-full border border-white/25 hover:bg-white/10"><ArrowRight aria-hidden="true" size={20} /></button>
            </div>
          </div>
        </>}
      </dialog>
    </section>
  );
}
