import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, CreateLessonDto, CreateMaterialDto, CreateModuleDto, CreateProgramDto, EnrollClassDto, UpdateProgressDto } from './learning.controller';
import { AccessContext, AccessService } from '../access/access.service';
import { isPublishedModuleAccessible } from '../access/access-policy';

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  getCourses(schoolId: string, studentId?: string) {
    return this.prisma.course.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(studentId ? { enrollments: { some: { studentId, status: 'ACTIVE' } } } : {}),
      },
      select: { id: true, name: true, code: true, description: true, program: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getLearningTree(schoolId: string, studentId?: string, accessContext?: AccessContext) {
    const courses = await this.prisma.course.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(studentId ? { enrollments: { some: { studentId, status: 'ACTIVE' } } } : {}),
      },
      select: {
        id: true, code: true, name: true, description: true,
        program: { select: { id: true, code: true, name: true } },
        modules: {
          where: studentId ? { isPublished: true } : {},
          orderBy: { position: 'asc' },
          select: {
            id: true, title: true, description: true, position: true, isPublished: true,
            planAccess: { select: { minimumPlan: { select: { rank: true, code: true } } } },
            lessons: {
              where: studentId ? { isPublished: true } : {},
              orderBy: { position: 'asc' },
              select: {
                id: true, title: true, summary: true, position: true, estimatedMinutes: true, isPublished: true,
                materials: { where: { isActive: true }, select: { id: true, title: true, type: true, content: true, fileUrl: true } },
                ...(studentId ? { progress: { where: { studentId }, select: { state: true, progressPercent: true, lastPosition: true, completedAt: true } } } : {}),
              },
            },
          },
        },
        ...(studentId ? { enrollments: { where: { studentId }, select: { status: true, enrolledAt: true, completedAt: true } } } : {}),
      },
      orderBy: { name: 'asc' },
    });
    if (!studentId || !accessContext) return courses;

    await this.access.assertEntitlement(accessContext, 'learning.materials.read', 'Materi belajar tidak termasuk dalam paket aktif');
    const effective = await this.access.resolveEffectiveAccess(accessContext) as any;
    return courses.map((course) => ({
      ...course,
      accessPlan: { code: effective.plan.code, moduleLimit: effective.plan.moduleLimit },
      modules: course.modules.map((courseModule, index) => {
        const minimumPlanRank = courseModule.planAccess?.minimumPlan.rank ?? 0;
        const accessible = isPublishedModuleAccessible(
          index + 1,
          Number(effective.plan.moduleLimit),
          Number(effective.plan.rank),
          minimumPlanRank,
        );
        const { planAccess, ...safeModule } = courseModule;
        return {
          ...safeModule,
          lessons: accessible ? safeModule.lessons : [],
          locked: !accessible,
          lockReason: accessible
            ? null
            : index + 1 > Number(effective.plan.moduleLimit)
              ? 'PLAN_MODULE_LIMIT'
              : 'MINIMUM_PLAN_REQUIRED',
          minimumPlan: planAccess?.minimumPlan.code ?? 'FREE',
        };
      }),
    }));
  }

  getPrograms(schoolId: string) {
    return this.prisma.program.findMany({
      where: { schoolId, isActive: true },
      include: { _count: { select: { courses: true } } },
      orderBy: { name: 'asc' },
    });
  }

  getClasses(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, code: true, name: true, grade: true },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
    });
  }

  async createProgram(schoolId: string, organizationId: string, userId: string, dto: CreateProgramDto) {
    return this.prisma.program.create({
      data: { schoolId, organizationId, createdById: userId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), description: dto.description?.trim() || null },
    });
  }

  async createCourse(schoolId: string, organizationId: string, dto: CreateCourseDto) {
    if (dto.programId) {
      const program = await this.prisma.program.count({ where: { id: dto.programId, schoolId, organizationId, isActive: true } });
      if (!program) throw new BadRequestException('Program tidak ditemukan pada sekolah ini');
    }
    return this.prisma.course.create({
      data: { schoolId, organizationId, programId: dto.programId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), description: dto.description?.trim() || null },
    });
  }

  async createModule(courseId: string, schoolId: string, userId: string, dto: CreateModuleDto) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, schoolId, isActive: true }, select: { id: true } });
    if (!course) throw new BadRequestException('Course tidak ditemukan pada sekolah ini');
    const position = dto.position || (await this.prisma.courseModule.count({ where: { courseId } })) + 1;
    return this.prisma.courseModule.create({ data: { courseId, createdById: userId, title: dto.title.trim(), description: dto.description?.trim() || null, position, isPublished: dto.isPublished ?? false } });
  }

  async createLesson(moduleId: string, schoolId: string, userId: string, dto: CreateLessonDto) {
    const courseModule = await this.prisma.courseModule.findFirst({ where: { id: moduleId, course: { schoolId } }, select: { id: true } });
    if (!courseModule) throw new BadRequestException('Modul tidak ditemukan pada sekolah ini');
    const position = dto.position || (await this.prisma.lesson.count({ where: { moduleId } })) + 1;
    return this.prisma.lesson.create({ data: { moduleId, createdById: userId, title: dto.title.trim(), summary: dto.summary?.trim() || null, position, estimatedMinutes: dto.estimatedMinutes, isPublished: dto.isPublished ?? false } });
  }

  async enrollClass(schoolId: string, dto: EnrollClassDto) {
    const [course, targetClass] = await Promise.all([
      this.prisma.course.findFirst({ where: { id: dto.courseId, schoolId, isActive: true } }),
      this.prisma.class.findFirst({ where: { id: dto.classId, schoolId, isActive: true } }),
    ]);
    if (!course || !targetClass) throw new BadRequestException('Course atau kelas tidak ditemukan');
    const students = await this.prisma.student.findMany({
      where: { schoolId, classEnrollments: { some: { classId: dto.classId, status: 'ACTIVE' } } },
      select: { id: true },
    });
    await this.prisma.$transaction(students.map((student) => this.prisma.courseEnrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      update: { status: 'ACTIVE', completedAt: null },
      create: { courseId: course.id, studentId: student.id, schoolId },
    })));
    return { courseId: course.id, classId: targetClass.id, enrolledStudents: students.length };
  }

  async updateProgress(
    lessonId: string,
    schoolId: string,
    studentId: string,
    dto: UpdateProgressDto,
    accessContext: AccessContext,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, isPublished: true, module: { isPublished: true, course: { schoolId, enrollments: { some: { studentId, status: 'ACTIVE' } } } } },
      select: { id: true, moduleId: true },
    });
    if (!lesson) throw new ForbiddenException('Lesson tidak tersedia dalam enrollment siswa');
    await this.access.assertPublishedModuleAccess(accessContext, lesson.moduleId);
    const [existing, material] = await Promise.all([
      this.prisma.lessonProgress.findUnique({
        where: { lessonId_studentId: { lessonId, studentId } },
        select: { state: true, progressPercent: true, lastPosition: true, startedAt: true, completedAt: true },
      }),
      dto.materialId ? this.prisma.material.findFirst({
        where: { id: dto.materialId, lessonId, isActive: true },
        select: { previewSlideCount: true },
      }) : Promise.resolve(null),
    ]);
    if (dto.materialId && (!material?.previewSlideCount || !dto.lastPosition)) {
      throw new BadRequestException('Materi tidak memiliki urutan slide yang valid');
    }
    if (material?.previewSlideCount && dto.lastPosition) {
      if (dto.lastPosition > material.previewSlideCount) throw new BadRequestException('Posisi slide berada di luar materi');
      const inferredExistingPosition = existing?.lastPosition
        || Math.floor((existing?.progressPercent || 0) / (100 / material.previewSlideCount));
      if (existing?.state !== 'COMPLETED' && dto.lastPosition > inferredExistingPosition + 1) {
        throw new BadRequestException('Buka materi secara berurutan sebelum melanjutkan');
      }
    }
    const requestedProgress = material?.previewSlideCount && dto.lastPosition
      ? Math.round(dto.lastPosition / material.previewSlideCount * 100)
      : dto.state === 'COMPLETED' ? 100 : dto.progressPercent;
    const progressPercent = Math.max(existing?.progressPercent || 0, requestedProgress);
    const lastPosition = Math.max(existing?.lastPosition || 0, dto.lastPosition || 0) || null;
    const completed = existing?.state === 'COMPLETED' || dto.state === 'COMPLETED' || progressPercent >= 100;
    const state = completed ? 'COMPLETED' : progressPercent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
    const startedAt = existing?.startedAt || (state !== 'NOT_STARTED' ? new Date() : null);
    const completedAt = completed ? existing?.completedAt || new Date() : null;
    return this.prisma.lessonProgress.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      update: { state, progressPercent, lastPosition, startedAt, completedAt },
      create: { lessonId, studentId, state, progressPercent, lastPosition, startedAt, completedAt },
    });
  }

  async getMaterials(
    schoolId: string,
    teacherId?: string,
    studentId?: string,
    courseId?: string,
    accessContext?: AccessContext,
  ) {
    if (studentId && accessContext) {
      await this.access.assertEntitlement(accessContext, 'learning.materials.read', 'Materi belajar tidak termasuk dalam paket aktif');
    }
    const materials = await this.prisma.material.findMany({
      where: {
        course: { schoolId, ...(studentId ? { enrollments: { some: { studentId, status: 'ACTIVE' } } } : {}) },
        ...(teacherId ? { teacherId } : { isActive: true }),
        ...(studentId ? { lesson: { isPublished: true, module: { isPublished: true } } } : {}),
        ...(courseId ? { courseId } : {}),
      },
      include: {
        course: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        lesson: {
          select: {
            moduleId: true,
            position: true,
            module: { select: { courseId: true, position: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (!studentId || !accessContext) return materials;

    const courseIds = [...new Set(materials.map((material) => material.lesson?.module.courseId).filter((id): id is string => Boolean(id)))];
    const accessibleModuleIds = courseIds.length
      ? await this.access.getAccessiblePublishedModuleIds(accessContext, courseIds)
      : new Set<string>();
    return materials
      .filter((material) => Boolean(material.lesson) && accessibleModuleIds.has(material.lesson!.moduleId))
      .sort((left, right) => {
        const moduleOrder = (left.lesson?.module.position ?? 0) - (right.lesson?.module.position ?? 0);
        return moduleOrder || (left.lesson?.position ?? 0) - (right.lesson?.position ?? 0);
      })
      .map(({ lesson: _lesson, ...material }) => material);
  }

  async getMaterialFileAccess(
    materialId: string,
    schoolId: string,
    teacherId?: string,
    studentId?: string,
    accessContext?: AccessContext,
  ) {
    const material = await this.prisma.material.findFirst({
      where: {
        id: materialId,
        isActive: true,
        ...(teacherId ? { teacherId } : {}),
        course: {
          schoolId,
          isActive: true,
          ...(studentId ? { enrollments: { some: { studentId, status: 'ACTIVE' } } } : {}),
        },
        ...(studentId ? { lesson: { isPublished: true, module: { isPublished: true } } } : {}),
      },
      select: {
        id: true,
        title: true,
        lessonId: true,
        originalFileName: true,
        mimeType: true,
        previewSlideCount: true,
        lesson: { select: { moduleId: true } },
      },
    });
    if (!material?.originalFileName) throw new BadRequestException('File materi tidak tersedia');
    if (studentId) {
      if (!accessContext || !material.lesson?.moduleId) throw new ForbiddenException('Materi tidak tersedia untuk siswa');
      await this.access.assertEntitlement(accessContext, 'learning.materials.read', 'Materi belajar tidak termasuk dalam paket aktif');
      await this.access.assertPublishedModuleAccess(accessContext, material.lesson.moduleId);
    }
    return {
      id: material.id,
      title: material.title,
      lessonId: material.lessonId,
      originalFileName: material.originalFileName,
      mimeType: material.mimeType,
      previewSlideCount: material.previewSlideCount,
    };
  }

  async createMaterial(schoolId: string, teacherId: string, dto: CreateMaterialDto) {
    const [course, teacher, lesson] = await Promise.all([
      this.prisma.course.findFirst({ where: { id: dto.courseId, schoolId, isActive: true } }),
      this.prisma.teacher.findFirst({ where: { id: teacherId, schoolId, isActive: true } }),
      this.prisma.lesson.findFirst({ where: { id: dto.lessonId, module: { course: { id: dto.courseId, schoolId } } } }),
    ]);

    if (!teacher) throw new ForbiddenException('Profil guru tidak berada pada sekolah aktif');
    if (!course) throw new BadRequestException('Mata pelajaran tidak ditemukan pada sekolah ini');
    if (!lesson) throw new BadRequestException('Lesson tidak berada pada course ini');
    if (dto.type !== 'TEXT' && !dto.fileUrl && !dto.content) {
      throw new BadRequestException('Tambahkan isi materi atau tautan sumber');
    }

    return this.prisma.material.create({
      data: {
        courseId: course.id,
        teacherId: teacher.id,
        lessonId: lesson?.id,
        title: dto.title.trim(),
        content: dto.content?.trim() || null,
        fileUrl: dto.fileUrl?.trim() || null,
        type: dto.type,
        isActive: true,
      },
      include: {
        course: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
      },
    });
  }
}
