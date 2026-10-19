import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Assignment, Prisma } from '@prisma/client';
import { IsString, IsOptional, IsDateString, IsInt, IsBoolean, IsIn, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SupportingService } from '../supporting/supporting.service';
import { AccessContext, AccessService } from '../access/access.service';

export class CreateAssignmentDto {
  @IsString() courseId: string;
  @IsString() moduleId: string;
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsIn(['AFFILIATE', 'WRITTEN', 'QUIZ', 'PROJECT', 'STORE']) type?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) maxScore?: number;
  @IsOptional() @IsString() rubricId?: string;
  @IsOptional() @IsString() checklistTemplateId?: string;
  // Affiliate targets
  @IsOptional() @IsInt() targetViews?: number;
  @IsOptional() @IsInt() targetClicks?: number;
  @IsOptional() @IsInt() targetOrders?: number;
  @IsOptional() targetGmv?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAssignmentDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsInt() maxScore?: number;
  @IsOptional() @IsInt() targetViews?: number;
  @IsOptional() @IsInt() targetClicks?: number;
  @IsOptional() @IsInt() targetOrders?: number;
  @IsOptional() targetGmv?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() moduleId?: string;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private supporting: SupportingService,
    private access: AccessService,
  ) {}

  async findAll(params: {
    courseId?: string;
    teacherId?: string;
    schoolId?: string;
    activeOnly?: boolean;
    studentId?: string;
    skip?: number;
    take?: number;
    where?: Prisma.AssignmentWhereInput;
    orderBy?: Prisma.AssignmentOrderByWithRelationInput;
    accessContext?: AccessContext;
  }): Promise<{ data: Assignment[]; total: number }> {
    const { courseId, teacherId, schoolId, activeOnly, studentId, skip = 0, take = 50, where, orderBy, accessContext } = params;

    let studentScope: Prisma.AssignmentWhereInput = {};
    if (studentId) {
      if (!accessContext) throw new ForbiddenException('Konteks akses siswa diperlukan');
      const [moduleIds, types] = await Promise.all([
        this.access.getAccessiblePublishedModuleIds(accessContext),
        this.access.getEnabledAssignmentTypes(accessContext, 'READ'),
      ]);
      studentScope = {
        moduleId: { in: [...moduleIds] },
        type: { in: types },
        publishedAt: { not: null, lte: new Date() },
      };
    } else if (accessContext) {
      studentScope = { type: { in: await this.access.getEnabledAssignmentTypes(accessContext, 'READ') } };
    }

    const combinedWhere: Prisma.AssignmentWhereInput = {
      ...where,
      ...studentScope,
      ...(courseId && { courseId }),
      ...(teacherId && { teacherId }),
      ...(schoolId && { course: { schoolId, ...(studentId ? { enrollments: { some: { studentId, status: 'ACTIVE' } } } : {}) } }),
      ...(activeOnly ? { isActive: true } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where: combinedWhere,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          course: { select: { id: true, name: true, code: true } },
          module: { select: { id: true, title: true, position: true } },
          teacher: { select: { id: true, fullName: true } },
          rubric: { select: { id: true, name: true } },
          checklistTemplate: { select: { id: true, name: true, minimumProducts: true } },
          _count: { select: { submissions: studentId ? { where: { studentId } } : true } },
        },
      }),
      this.prisma.assignment.count({ where: combinedWhere }),
    ]);

    return { data, total };
  }

  async findOne(id: string, schoolId: string, teacherId?: string, activeOnly = false, accessContext?: AccessContext): Promise<Assignment> {
    if (accessContext?.studentId) await this.access.assertAssignmentAccess(accessContext, id, 'READ');
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, course: { schoolId }, ...(teacherId ? { teacherId } : {}), ...(activeOnly ? { isActive: true } : {}) },
      include: {
        course: true,
        module: true,
        teacher: true,
        rubric: { include: { criteria: true } },
        submissions: {
          ...(accessContext?.studentId ? { where: { studentId: accessContext.studentId } } : {}),
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            student: { select: { id: true, fullName: true, studentNumber: true } },
          },
        },
        _count: { select: { submissions: accessContext?.studentId ? { where: { studentId: accessContext.studentId } } : true } },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (accessContext && !accessContext.studentId) await this.access.assertAssignmentFeatureEntitlement(accessContext, assignment.type, 'READ');

    return assignment;
  }

  async create(dto: CreateAssignmentDto, schoolId: string, teacherId: string, accessContext: AccessContext): Promise<Assignment> {
    await this.access.assertAssignmentFeatureEntitlement(accessContext, dto.type || 'AFFILIATE', 'SUBMIT');
    const [course, teacher, checklistTemplate, courseModule] = await Promise.all([
      this.prisma.course.findFirst({ where: { id: dto.courseId, schoolId, isActive: true } }),
      this.prisma.teacher.findFirst({ where: { id: teacherId, schoolId, isActive: true } }),
      dto.checklistTemplateId ? this.prisma.storeChecklistTemplate.findFirst({ where: { id: dto.checklistTemplateId, schoolId, isActive: true } }) : Promise.resolve(null),
      this.prisma.courseModule.findFirst({ where: { id: dto.moduleId, courseId: dto.courseId, course: { schoolId } } }),
    ]);
    if (!teacher) throw new ForbiddenException('Profil guru tidak berada pada sekolah aktif');
    if (!course) throw new BadRequestException('Mata pelajaran tidak ditemukan pada sekolah ini');
    if (!courseModule) throw new BadRequestException('Modul tugas tidak berada pada mata pelajaran ini');
    if ((dto.isActive ?? true) && !courseModule.isPublished) throw new BadRequestException('Modul harus diterbitkan sebelum tugas dipublikasikan');
    if (dto.rubricId) {
      const scopedRubric = await this.prisma.rubric.count({ where: { id: dto.rubricId, organizationId: course.organizationId } });
      if (!scopedRubric) throw new BadRequestException('Rubrik tidak tersedia dalam organisasi ini');
    }
    if (dto.checklistTemplateId && !checklistTemplate) throw new BadRequestException('Checklist toko tidak tersedia dalam sekolah ini');
    if ((dto.type || 'AFFILIATE') === 'STORE' && !dto.checklistTemplateId) throw new BadRequestException('Tugas toko membutuhkan checklist');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new BadRequestException('Deadline harus setelah waktu mulai');

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          courseId: course.id,
          moduleId: courseModule.id,
          teacherId: teacher.id,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          type: dto.type || 'AFFILIATE',
          startDate,
          endDate,
          maxScore: dto.maxScore || 100,
          rubricId: dto.rubricId,
          checklistTemplateId: dto.checklistTemplateId,
          targetViews: dto.targetViews,
          targetClicks: dto.targetClicks,
          targetOrders: dto.targetOrders,
          targetGmv: dto.targetGmv,
          isActive: dto.isActive ?? true,
          publishedAt: dto.isActive === false ? null : new Date(),
        },
        include: {
          course: { select: { id: true, name: true, code: true } },
          module: { select: { id: true, title: true, position: true } },
          teacher: { select: { id: true, fullName: true } },
        },
      });
      await tx.assignmentVersion.create({
        data: { assignmentId: created.id, version: created.version, changedById: teacher.userId, snapshotData: this.assignmentSnapshot(created) },
      });
      return created;
    });
    if (assignment.isActive) {
      const recipients = await this.prisma.courseEnrollment.findMany({
        where: { status: 'ACTIVE', courseId: course.id },
        select: { student: { select: { id: true, userId: true } } },
      });
      await Promise.all(recipients.map(async ({ student }) => {
        const context = { organizationId: course.organizationId, schoolId, userId: student.userId, studentId: student.id };
        const canRead = await this.access.assertAssignmentAccess(context, assignment.id, 'READ').then(() => true).catch(() => false);
        if (!canRead) return;
        await this.supporting.createNotification({
          organizationId: course.organizationId,
          schoolId,
          userId: student.userId,
          eventType: 'ASSIGNMENT_PUBLISHED',
          title: `Tugas baru: ${assignment.title}`,
          body: `Tugas baru tersedia dengan tenggat ${endDate.toLocaleDateString('id-ID')}.`,
          actionUrl: '/dashboard/tugas',
          idempotencyKey: `assignment-published:${assignment.id}:${student.userId}`,
        });
      }));
    }
    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto, schoolId: string, teacherId: string | undefined, actorId: string, accessContext: AccessContext): Promise<Assignment> {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, course: { schoolId }, ...(teacherId ? { teacherId } : {}) },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    await this.access.assertAssignmentFeatureEntitlement(accessContext, assignment.type, 'SUBMIT');
    const startDate = dto.startDate ? new Date(dto.startDate) : assignment.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : assignment.endDate;
    if (endDate <= startDate) throw new BadRequestException('Deadline harus setelah waktu mulai');
    const moduleId = dto.moduleId ?? assignment.moduleId;
    const courseModule = await this.prisma.courseModule.findFirst({ where: { id: moduleId, courseId: assignment.courseId, course: { schoolId } } });
    if (!courseModule) throw new BadRequestException('Modul tugas tidak berada pada mata pelajaran ini');
    if ((dto.isActive ?? assignment.isActive) && !courseModule.isPublished) throw new BadRequestException('Modul harus diterbitkan sebelum tugas dipublikasikan');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.startDate ? { startDate } : {}),
          ...(dto.endDate ? { endDate } : {}),
          ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
          ...(dto.targetViews !== undefined ? { targetViews: dto.targetViews } : {}),
          ...(dto.targetClicks !== undefined ? { targetClicks: dto.targetClicks } : {}),
          ...(dto.targetOrders !== undefined ? { targetOrders: dto.targetOrders } : {}),
          ...(dto.targetGmv !== undefined ? { targetGmv: dto.targetGmv } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.moduleId !== undefined ? { moduleId } : {}),
          version: { increment: 1 },
          ...(dto.isActive === true && !assignment.publishedAt ? { publishedAt: new Date() } : {}),
        },
      });
      await tx.assignmentVersion.create({ data: { assignmentId: id, version: updated.version, changedById: actorId, snapshotData: this.assignmentSnapshot(updated) } });
      return updated;
    });
  }

  async delete(id: string, schoolId: string, teacherId: string | undefined, actorId: string, accessContext: AccessContext): Promise<Assignment> {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, course: { schoolId }, ...(teacherId ? { teacherId } : {}) },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    await this.access.assertAssignmentFeatureEntitlement(accessContext, assignment.type, 'SUBMIT');

    if (!assignment.isActive) return assignment;
    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.assignment.update({ where: { id }, data: { isActive: false, version: { increment: 1 } } });
      await tx.assignmentVersion.create({ data: { assignmentId: id, version: archived.version, changedById: actorId, snapshotData: this.assignmentSnapshot(archived) } });
      return archived;
    });
  }

  private assignmentSnapshot(assignment: any): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify({
      courseId: assignment.courseId,
      moduleId: assignment.moduleId,
      teacherId: assignment.teacherId,
      title: assignment.title,
      description: assignment.description,
      type: assignment.type,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      maxScore: assignment.maxScore,
      rubricId: assignment.rubricId,
      checklistTemplateId: assignment.checklistTemplateId,
      targetViews: assignment.targetViews,
      targetClicks: assignment.targetClicks,
      targetOrders: assignment.targetOrders,
      targetGmv: assignment.targetGmv,
      isActive: assignment.isActive,
      publishedAt: assignment.publishedAt,
    })) as Prisma.InputJsonValue;
  }
}
