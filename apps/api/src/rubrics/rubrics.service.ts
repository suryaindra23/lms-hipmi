import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessContext, AccessService } from '../access/access.service';

export type RubricCriterionInput = {
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  position: number;
  levels?: Record<string, unknown>;
};

@Injectable()
export class RubricsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}

  async list(organizationId: string, context?: AccessContext) {
    if (context) await this.access.assertEntitlement(context, 'assignments.standard.read', 'Rubrik tidak termasuk dalam paket aktif');
    const studentScope = context?.studentId ? await this.studentAssignmentScope(context) : undefined;
    return this.prisma.rubric.findMany({
      where: { organizationId, ...(studentScope ? { assignments: { some: studentScope } } : {}) },
      include: { criteria: { orderBy: { position: 'asc' } }, _count: { select: { assignments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, data: { name: string; description?: string; criteria: RubricCriterionInput[] }) {
    if (data.criteria.length === 0) throw new BadRequestException('Rubrik membutuhkan minimal satu kriteria');
    const totalWeight = data.criteria.reduce((total, criterion) => total + criterion.weight, 0);
    if (totalWeight !== 100) throw new BadRequestException('Total bobot kriteria harus tepat 100%');
    return this.prisma.rubric.create({
      data: {
        organizationId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        criteria: {
          create: data.criteria.map((criterion, index) => ({
            name: criterion.name.trim(),
            description: criterion.description?.trim() || null,
            weight: criterion.weight,
            maxScore: criterion.maxScore,
            position: criterion.position || index + 1,
            levels: criterion.levels as any,
          })),
        },
      },
      include: { criteria: { orderBy: { position: 'asc' } } },
    });
  }

  async createForContext(context: AccessContext, data: { name: string; description?: string; criteria: RubricCriterionInput[] }) {
    await this.access.assertEntitlement(context, 'assignments.standard.submit', 'Rubrik tidak termasuk dalam paket aktif');
    return this.create(context.organizationId, data);
  }

  /** Creates the three independent MGMP rubrics once per organization. */
  async createMgmpTemplates(context: AccessContext) {
    await this.access.assertEntitlement(context, 'assignments.standard.submit', 'Rubrik tidak termasuk dalam paket aktif');
    const { organizationId } = context;
    const templates: Array<{ name: string; description: string; criteria: Array<{ name: string; description: string }> }> = [
      { name: 'MGMP KIK — Proyek Kewirausahaan', description: 'Rekomendasi AI untuk kompetensi KIK. Nilai tetap harus ditinjau guru MGMP KIK sebelum dipublikasikan.', criteria: [
        { name: 'Ide dan inovasi produk', description: 'Nilai orisinalitas, relevansi masalah, dan nilai jual ide.' }, { name: 'Perencanaan bisnis', description: 'Nilai target pasar, harga, modal, dan kelayakan rencana.' }, { name: 'Strategi pemasaran', description: 'Nilai kecocokan strategi dengan target pasar dan media yang dipilih.' }, { name: 'Presentasi dan bukti', description: 'Nilai kejelasan penjelasan serta kelengkapan bukti karya.' },
      ] },
      { name: 'MGMP Bahasa Inggris — Komunikasi Proyek', description: 'Rekomendasi AI untuk kemampuan berbahasa Inggris pada karya atau presentasi tertulis. Guru Bahasa Inggris memvalidasi hasilnya.', criteria: [
        { name: 'Grammar dan struktur kalimat', description: 'Nilai ketepatan tata bahasa serta kejelasan struktur kalimat.' }, { name: 'Vocabulary', description: 'Nilai ketepatan dan variasi kosakata sesuai konteks proyek.' }, { name: 'Kejelasan komunikasi', description: 'Nilai keterbacaan dan kelancaran penyampaian dalam bukti teks.' }, { name: 'Organisasi penyampaian', description: 'Nilai keruntutan pembukaan, isi, dan penutup.' },
      ] },
      { name: 'MGMP Informatika — Produk Digital', description: 'Rekomendasi AI untuk kompetensi Informatika. Penilaian hanya memakai bukti teks yang dikirim; guru memeriksa artefak digital sebelum menyetujui.', criteria: [
        { name: 'Ketepatan penggunaan teknologi', description: 'Nilai kesesuaian aplikasi atau teknologi yang digunakan dengan tujuan tugas.' }, { name: 'Kualitas produk digital', description: 'Nilai fungsi, kerapian, dan kesiapan produk digital berdasarkan bukti.' }, { name: 'Pengolahan informasi atau data', description: 'Nilai akurasi, struktur, dan keterbacaan data atau informasi.' }, { name: 'Dokumentasi proses kerja', description: 'Nilai kelengkapan langkah kerja dan bukti proses.' },
      ] },
    ];
    const existing = await this.prisma.rubric.findMany({ where: { organizationId, name: { in: templates.map((template) => template.name) } }, select: { name: true } });
    const existingNames = new Set(existing.map((rubric) => rubric.name));
    const missing = templates.filter((template) => !existingNames.has(template.name));
    if (!missing.length) return this.list(organizationId, context);
    await this.prisma.$transaction(missing.map((template) => this.prisma.rubric.create({ data: {
      organizationId, name: template.name, description: template.description,
      criteria: { create: template.criteria.map((criterion, index) => ({ ...criterion, weight: 25, maxScore: 100, position: index + 1, levels: { sangatBaik: 'Bukti lengkap, tepat, dan konsisten.', baik: 'Bukti cukup tepat dengan perbaikan kecil.', cukup: 'Bukti terbatas atau belum konsisten.', perluPerbaikan: 'Bukti tidak cukup atau tidak relevan.' } })) },
    } })));
    return this.list(organizationId, context);
  }

  async findOne(id: string, organizationId: string, context?: AccessContext) {
    if (context) await this.access.assertEntitlement(context, 'assignments.standard.read', 'Rubrik tidak termasuk dalam paket aktif');
    const studentScope = context?.studentId ? await this.studentAssignmentScope(context) : undefined;
    const rubric = await this.prisma.rubric.findFirst({
      where: { id, organizationId, ...(studentScope ? { assignments: { some: studentScope } } : {}) },
      include: { criteria: { orderBy: { position: 'asc' } } },
    });
    if (!rubric) throw new NotFoundException('Rubrik tidak ditemukan');
    return rubric;
  }

  private async studentAssignmentScope(context: AccessContext) {
    const [moduleIds, types] = await Promise.all([
      this.access.getAccessiblePublishedModuleIds(context),
      this.access.getEnabledAssignmentTypes(context, 'READ'),
    ]);
    return {
      moduleId: { in: [...moduleIds] },
      type: { in: types },
      isActive: true,
      publishedAt: { not: null, lte: new Date() },
      course: { schoolId: context.schoolId, enrollments: { some: { studentId: context.studentId, status: 'ACTIVE' as const } } },
    };
  }
}
