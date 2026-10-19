import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import LeadForm from "@/components/landing/LeadForm";

type PageContent = { title: string; eyebrow: string; description: string; sections: { title: string; body: string }[] };

const pages: Record<string, PageContent> = {
  tentang: { title: "Membawa praktik ekonomi digital ke ruang belajar", eyebrow: "Tentang Program", description: "Sunrise Academy membantu sekolah menjalankan pembelajaran digital yang terstruktur, aman, dan berbasis bukti karya.", sections: [{ title: "Belajar melalui karya", body: "Materi terhubung langsung dengan tugas praktik, rubrik, feedback, revisi, dan pencapaian siswa." }, { title: "Pendampingan lintas peran", body: "Siswa, guru, orang tua, dan sekolah memperoleh tampilan yang relevan tanpa membuka data di luar kewenangan." }, { title: "Pertumbuhan yang terukur", body: "Riwayat pembelajaran, submission, review, dan snapshot performa dipertahankan agar proses dapat dievaluasi." }] },
  fitur: { title: "Satu platform untuk belajar, praktik, dan berkembang", eyebrow: "Fitur Platform", description: "Fondasi LMS dipadukan dengan workflow toko digital, konten affiliate, penilaian, monitoring, serta pelaporan.", sections: [{ title: "Pembelajaran", body: "Course, modul, materi, tugas, rubrik, deadline, progres, dan nilai dalam alur yang konsisten." }, { title: "Praktik digital", body: "Submission toko dan konten affiliate memuat data terstruktur, bukti, checklist, serta riwayat revisi." }, { title: "Monitoring", body: "Dashboard per peran, early warning suportif, laporan, dan audit membantu sekolah mengambil tindakan." }] },
  "cara-kerja": { title: "Alur yang jelas untuk seluruh warga sekolah", eyebrow: "Cara Kerja", description: "Sekolah mengonfigurasi program, mengundang pengguna, menjalankan tugas praktik, dan memantau perkembangan sesuai kewenangan.", sections: [{ title: "1. Konfigurasi sekolah", body: "Program, periode, kelas, pengguna, akses, dan kebijakan disiapkan sebelum pembelajaran dimulai." }, { title: "2. Belajar dan praktik", body: "Guru membagikan materi serta brief; siswa menyimpan draf, melengkapi bukti, lalu mengirim karya." }, { title: "3. Review dan pendampingan", body: "Feedback, revisi, nilai, serta kebutuhan pendampingan tercatat dan dapat ditindaklanjuti." }] },
  "untuk-sekolah": { title: "Program digital yang dapat dipantau sekolah", eyebrow: "Untuk Sekolah", description: "Kelola adopsi program, progres kelas, antrean review, kelengkapan data, dan laporan dari satu tempat.", sections: [{ title: "Onboarding terarah", body: "Struktur organisasi, sekolah, tahun ajaran, kelas, dan peran pengguna disiapkan secara bertahap." }, { title: "Kontrol sesuai kewenangan", body: "Data dan aksi dibatasi oleh organisasi, sekolah, peran, permission, dan relasi pengguna." }, { title: "Laporan yang bertanggung jawab", body: "Agregasi dan export mengikuti periode, ruang lingkup, serta redaksi data sensitif." }] },
  keamanan: { title: "Keamanan data siswa menjadi prioritas", eyebrow: "Keamanan & Privasi", description: "Kontrol teknis dan tata kelola diterapkan berlapis dengan prinsip minimisasi data, isolasi tenant, dan auditabilitas.", sections: [{ title: "Akses terkontrol", body: "Role, permission, tenant, dan relasi pengguna menentukan data serta tindakan yang tersedia." }, { title: "Data sensitif dipisahkan", body: "NIK dienkripsi, dokumen berada di penyimpanan privat, dan akses identitas diaudit secara khusus." }, { title: "Kebijakan yang dapat ditinjau", body: "Consent, retensi, koreksi, penghapusan, dan export membutuhkan kebijakan organisasi serta review hukum yang sesuai." }] },
  faq: { title: "Pertanyaan umum tentang platform", eyebrow: "FAQ", description: "Temukan jawaban singkat mengenai pengguna, smartphone, marketplace, keamanan, monitoring, pelaporan, dan revisi tugas.", sections: [{ title: "Apakah perlu password marketplace?", body: "Tidak. Platform tidak boleh meminta atau menyimpan password, PIN, OTP, cookie, atau token akun siswa." }, { title: "Apakah orang tua melihat siswa lain?", body: "Tidak. Orang tua hanya dapat melihat anak yang terhubung melalui relasi wali yang sah." }, { title: "Apakah tugas dapat direvisi?", body: "Ya. Resubmission membuat versi baru sehingga hasil sebelumnya tidak tertimpa." }] },
  kontak: { title: "Mari bicarakan kebutuhan sekolah Anda", eyebrow: "Kontak", description: "Gunakan formulir pendaftaran untuk meminta tindak lanjut dari tim program. Informasi kontak resmi dapat dikonfigurasi pengelola.", sections: [{ title: "Permintaan demo", body: "Sampaikan jenjang, jumlah siswa, dan fokus program agar pembahasan awal lebih terarah." }, { title: "Dukungan pengguna", body: "Pengguna aktif dapat menghubungi admin sekolah untuk akses akun dan kebutuhan operasional." }] },
  "daftar-sekolah": { title: "Daftarkan sekolah untuk memulai percakapan", eyebrow: "Pendaftaran Sekolah", description: "Ceritakan kebutuhan dan cakupan program Anda. Data akan diverifikasi sebelum onboarding atau pembuatan tenant dilakukan.", sections: [{ title: "Isi informasi sekolah", body: "Lengkapi jenjang, lokasi, penanggung jawab, jumlah siswa, dan program yang diminati." }, { title: "Verifikasi oleh tim", body: "Permintaan ditinjau untuk memastikan kebutuhan, kewenangan, dan kesiapan pelaksanaan program." }, { title: "Rancang onboarding", body: "Setelah disetujui, tim menyusun langkah konfigurasi, pengguna, kelas, serta pendampingan." }] },
  "kebijakan-privasi": { title: "Kebijakan Privasi", eyebrow: "Dokumen Kebijakan", description: "Template awal mengenai cara platform mengumpulkan, menggunakan, melindungi, dan mengelola data. Dokumen ini harus ditinjau penasihat hukum sebelum publikasi final.", sections: [{ title: "Data yang diproses", body: "Platform memproses data akun, akademik, submission, performa, dan data identitas terbatas sesuai tujuan program serta kewenangan." }, { title: "Tujuan dan dasar pemrosesan", body: "Data digunakan untuk operasional pembelajaran, keamanan, pelaporan, dukungan, serta kewajiban yang ditetapkan kebijakan organisasi." }, { title: "Hak dan permintaan data", body: "Alur akses, koreksi, pembatasan, penghapusan, export, dan penarikan consent disediakan sesuai kebijakan retensi dan kewajiban yang berlaku." }] },
  "syarat-ketentuan": { title: "Syarat & Ketentuan", eyebrow: "Dokumen Kebijakan", description: "Template aturan penggunaan platform yang memerlukan review hukum dan persetujuan pengelola sebelum berlaku.", sections: [{ title: "Penggunaan yang diperbolehkan", body: "Akun digunakan hanya oleh pemiliknya untuk aktivitas pembelajaran dan administrasi sesuai kewenangan." }, { title: "Keamanan akun", body: "Pengguna wajib menjaga kredensial, tidak membagikan OTP, dan segera melaporkan aktivitas yang mencurigakan." }, { title: "Karya dan marketplace", body: "Pengguna wajib mematuhi brief, hak cipta, disclosure, serta kebijakan platform marketplace yang digunakan." }] },
  "kebijakan-data-anak": { title: "Kebijakan Data Anak", eyebrow: "Dokumen Kebijakan", description: "Template khusus untuk perlindungan data anak, consent wali, minimisasi data, dan pembatasan akses. Wajib ditinjau secara hukum sebelum diberlakukan.", sections: [{ title: "Minimisasi data", body: "Hanya data yang diperlukan untuk tujuan pembelajaran, keamanan, dan administrasi yang diproses." }, { title: "Consent dan publikasi", body: "Consent wali, penggunaan platform, serta publikasi karya atau foto dikelola secara terpisah dan memiliki riwayat." }, { title: "Akses sensitif", body: "Guru akademik tidak memperoleh akses default ke NIK atau dokumen identitas; akses sensitif memerlukan izin khusus dan audit." }] },
  "lupa-password": { title: "Pemulihan akses akun", eyebrow: "Lupa Kata Sandi", description: "Hubungi admin sekolah untuk memulai pemulihan akun. Tautan reset sekali pakai dan pengiriman email akan diaktifkan setelah layanan email dikonfigurasi.", sections: [{ title: "Jangan bagikan kredensial", body: "Admin atau tim dukungan tidak akan meminta password lama, PIN, OTP, atau kode pemulihan Anda." }, { title: "Gunakan jalur resmi", body: "Pastikan permintaan pemulihan dilakukan melalui admin sekolah dan alamat layanan resmi yang telah dikonfigurasi." }] },
};

export function generateStaticParams() { return Object.keys(pages).map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const page = pages[slug];
  if (!page) return {};
  return { title: page.title, description: page.description, alternates: { canonical: `/${slug}` }, robots: slug === "lupa-password" ? { index: false, follow: false } : undefined };
}

export default async function PublicInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  const showForm = slug === "daftar-sekolah" || slug === "kontak";

  return (
    <div className="public-site min-h-screen bg-white">
      <Header />
      <main id="main-content">
        <section className="px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-12">
          <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[1.18fr_.82fr] lg:items-end lg:gap-20">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">{page.eyebrow}</p>
              <h1 className="mt-6 max-w-5xl text-[clamp(2.8rem,5vw,5.75rem)] font-extrabold leading-[1.02] tracking-[-0.06em] text-slate-950">{page.title}</h1>
            </div>
            <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{page.description}</p>
          </div>
        </section>
        <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
          <div className="mx-auto grid max-w-[1440px] gap-8 border-t border-slate-200 pt-10 md:grid-cols-3 md:gap-12">
            {page.sections.map((section, index) => (
              <article key={section.title} className="border-b border-slate-200 pb-8 md:border-b-0">
                <p className="text-sm font-extrabold text-orange-700">{String(index + 1).padStart(2, "0")}</p>
                <CheckCircle2 aria-hidden="true" className="mt-7 text-orange-700" size={25} />
                <h2 className="mt-5 max-w-sm text-2xl font-extrabold leading-tight tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
          {!showForm && <div className="mx-auto mt-12 max-w-[1440px]"><Link href="/#register" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-orange-600 px-6 text-sm font-bold text-white transition hover:bg-orange-700">Daftarkan sekolah <ArrowRight aria-hidden="true" size={17} /></Link></div>}
        </section>
        {showForm && <LeadForm />}
      </main>
      <Footer />
    </div>
  );
}
