import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type LearningModuleSeed = {
  position: number;
  slug: string;
  title: string;
  description: string;
  lessonTitle: string;
  summary: string;
  minutes: number;
  minimumPlan: 'FREE' | 'MEDIUM' | 'ADVANCED';
};

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Materi contoh tidak boleh diisikan otomatis pada production');
  }

  const modules = JSON.parse(
    await readFile(join(__dirname, 'learning-modules.json'), 'utf8'),
  ) as LearningModuleSeed[];
  const course = await prisma.course.findFirst({
    where: { code: 'DMA-101', isActive: true },
    include: { school: true },
  });
  if (!course) throw new Error('Course DMA-101 belum tersedia. Jalankan seed utama terlebih dahulu.');

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId: course.schoolId, isActive: true },
    include: { user: true },
  });
  if (!teacher) throw new Error('Guru aktif belum tersedia pada sekolah course DMA-101.');

  const plans = await prisma.accessPlan.findMany({
    where: { code: { in: ['FREE', 'MEDIUM', 'ADVANCED'] } },
  });
  const planByCode = new Map(plans.map((plan) => [plan.code, plan]));

  for (const item of modules) {
    const courseModule = await prisma.courseModule.upsert({
      where: { courseId_position: { courseId: course.id, position: item.position } },
      update: {
        title: item.title,
        description: item.description,
        isPublished: true,
        createdById: teacher.userId,
      },
      create: {
        courseId: course.id,
        createdById: teacher.userId,
        title: item.title,
        description: item.description,
        position: item.position,
        isPublished: true,
      },
    });

    const lesson = await prisma.lesson.upsert({
      where: { moduleId_position: { moduleId: courseModule.id, position: 1 } },
      update: {
        title: item.lessonTitle,
        summary: item.summary,
        estimatedMinutes: item.minutes,
        isPublished: true,
        createdById: teacher.userId,
      },
      create: {
        moduleId: courseModule.id,
        createdById: teacher.userId,
        title: item.lessonTitle,
        summary: item.summary,
        position: 1,
        estimatedMinutes: item.minutes,
        isPublished: true,
      },
    });

    const minimumPlan = planByCode.get(item.minimumPlan);
    if (!minimumPlan) throw new Error(`Paket ${item.minimumPlan} belum tersedia.`);
    await prisma.modulePlanAccess.upsert({
      where: { moduleId: courseModule.id },
      update: {
        minimumPlanId: minimumPlan.id,
        overrideReason: `Kurikulum 12 modul: akses ${item.minimumPlan}`,
        configuredBy: teacher.userId,
      },
      create: {
        moduleId: courseModule.id,
        minimumPlanId: minimumPlan.id,
        overrideReason: `Kurikulum 12 modul: akses ${item.minimumPlan}`,
        configuredBy: teacher.userId,
      },
    });

    const fileName = `modul-${String(item.position).padStart(2, '0')}-${item.slug}-v1.pptx`;
    const existingMaterial = await prisma.material.findFirst({
      where: { lessonId: lesson.id, originalFileName: fileName },
    });
    const materialData = {
      courseId: course.id,
      teacherId: teacher.id,
      lessonId: lesson.id,
      title: `Materi PPTX · ${item.title}`,
      content: item.summary,
      fileUrl: `/materials/${fileName}`,
      storageKey: fileName,
      originalFileName: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      previewSlideCount: 5,
      type: 'DOC',
      isActive: true,
    };
    let materialId: string;
    if (existingMaterial) {
      const updated = await prisma.material.update({ where: { id: existingMaterial.id }, data: materialData });
      materialId = updated.id;
    } else {
      const created = await prisma.material.create({ data: materialData });
      materialId = created.id;
    }
    await prisma.material.update({
      where: { id: materialId },
      data: { fileUrl: `/api/materials/${materialId}?download=1` },
    });
  }

  console.log(`✅ ${modules.length} modul dan materi PPTX telah diisikan untuk ${course.school.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
