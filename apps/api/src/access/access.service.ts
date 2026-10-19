import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementCacheService } from './entitlement-cache.service';
import { PLAN_MODULE_LIMIT, PlanCode, selectEffectiveGrant } from './access-policy';

export interface AccessContext {
  organizationId: string;
  schoolId?: string;
  userId: string;
  studentId?: string;
}

export interface CreateAccessGrantInput {
  targetType: 'ORGANIZATION' | 'SCHOOL' | 'PROGRAM' | 'CLASS' | 'USER';
  planCode: PlanCode;
  schoolId?: string;
  programId?: string;
  classId?: string;
  userId?: string;
  source: 'MANUAL' | 'PARTNERSHIP' | 'SCHOLARSHIP' | 'PILOT' | 'INSTITUTIONAL_INVOICE' | 'MIGRATION';
  startsAt?: string;
  endsAt?: string;
  reason: string;
}

export type AssignmentAccessAction = 'READ' | 'SUBMIT';

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: EntitlementCacheService,
  ) {}

  async getPublicPlans() {
    const now = new Date();
    const plans = await this.prisma.accessPlan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { rank: 'asc' },
      select: {
        code: true,
        name: true,
        rank: true,
        moduleLimit: true,
        entitlements: {
          where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          select: { enabled: true, valueJson: true, entitlementDefinition: { select: { key: true, valueType: true } } },
        },
        offers: {
          where: {
            status: 'ACTIVE',
            OR: [{ salesStartAt: null }, { salesStartAt: { lte: now } }],
            AND: [{ OR: [{ salesEndAt: null }, { salesEndAt: { gt: now } }] }],
          },
          select: {
            code: true,
            slug: true,
            name: true,
            audience: true,
            billingModel: true,
            accessDurationDays: true,
            seatMin: true,
            seatMax: true,
            prices: {
              where: { status: 'ACTIVE', effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
              select: { currency: true, amount: true, compareAtAmount: true, taxMode: true, taxRate: true },
            },
          },
        },
      },
    });

    return plans.map((plan) => ({
      ...plan,
      entitlements: Object.fromEntries(plan.entitlements.map((item) => [
        item.entitlementDefinition.key,
        item.valueJson ?? item.enabled,
      ])),
    }));
  }

  async resolveEffectiveAccess(context: AccessContext) {
    const cacheKey = `entitlement:${context.organizationId}:${context.schoolId ?? '-'}:${context.userId}`;
    const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const [studentScope, freePlan] = await Promise.all([
      context.studentId
        ? this.prisma.student.findFirst({
            where: { id: context.studentId, userId: context.userId, school: { organizationId: context.organizationId } },
            select: {
              classEnrollments: { where: { status: 'ACTIVE' }, select: { classId: true } },
              courseEnrollments: {
                where: { status: 'ACTIVE' },
                select: { course: { select: { programId: true } } },
              },
            },
          })
        : Promise.resolve(null),
      this.prisma.accessPlan.findUnique({
        where: { code: 'FREE' },
        include: {
          entitlements: {
            where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
            include: { entitlementDefinition: true },
          },
        },
      }),
    ]);
    if (!freePlan) throw new NotFoundException('Paket FREE belum dikonfigurasi');

    const classIds = studentScope?.classEnrollments.map((item) => item.classId) ?? [];
    const programIds = studentScope?.courseEnrollments
      .map((item) => item.course.programId)
      .filter((id): id is string => Boolean(id)) ?? [];
    const targets = [
      { targetType: 'ORGANIZATION' as const },
      ...(context.schoolId ? [{ targetType: 'SCHOOL' as const, schoolId: context.schoolId }] : []),
      ...(classIds.length ? [{ targetType: 'CLASS' as const, classId: { in: classIds } }] : []),
      ...(programIds.length ? [{ targetType: 'PROGRAM' as const, programId: { in: programIds } }] : []),
      { targetType: 'USER' as const, userId: context.userId },
    ];
    const grants = await this.prisma.accessGrant.findMany({
      where: {
        organizationId: context.organizationId,
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        startsAt: { lte: now },
        OR: targets,
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      include: {
        accessPlan: {
          include: {
            entitlements: {
              where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
              include: { entitlementDefinition: true },
            },
          },
        },
      },
    });

    const selected = selectEffectiveGrant(grants.map((grant) => ({
      id: grant.id,
      planCode: grant.accessPlan.code,
      planRank: grant.accessPlan.rank,
      moduleLimit: grant.accessPlan.moduleLimit,
      scope: grant.targetType,
      startsAt: grant.startsAt,
      endsAt: grant.endsAt,
      status: grant.status,
      source: grant.source,
    })), now);
    const selectedPlan = selected
      ? grants.find((grant) => grant.id === selected.id)!.accessPlan
      : freePlan;
    const entitlementRows = selectedPlan.entitlements;
    const result = {
      plan: {
        code: selectedPlan.code,
        name: selectedPlan.name,
        rank: selectedPlan.rank,
        moduleLimit: Math.min(selectedPlan.moduleLimit, 12),
      },
      grant: selected ? {
        id: selected.id,
        scope: selected.scope,
        source: selected.source,
        startsAt: selected.startsAt,
        endsAt: selected.endsAt,
      } : null,
      source: selected ? 'ACCESS_GRANT' : 'DEFAULT_FREE',
      entitlements: Object.fromEntries(entitlementRows.map((item) => [
        item.entitlementDefinition.key,
        item.valueJson ?? item.enabled,
      ])),
      resolvedAt: now.toISOString(),
    };
    await this.cache.set(context.organizationId, cacheKey, result);
    return result;
  }

  async createGrant(context: AccessContext, input: CreateAccessGrantInput) {
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw new BadRequestException('Periode access grant tidak valid');
    }
    if (endsAt && endsAt <= startsAt) throw new BadRequestException('Tanggal berakhir harus setelah tanggal mulai');
    if (input.reason.trim().length < 5) throw new BadRequestException('Alasan perubahan akses wajib diisi');

    const accessPlan = await this.prisma.accessPlan.findFirst({ where: { code: input.planCode, status: 'ACTIVE' } });
    if (!accessPlan) throw new BadRequestException('Paket akses tidak tersedia');
    await this.validateGrantTarget(context.organizationId, input);

    const status = startsAt > new Date() ? 'SCHEDULED' : 'ACTIVE';
    const grant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accessGrant.create({
        data: {
          organizationId: context.organizationId,
          schoolId: input.targetType === 'SCHOOL' ? input.schoolId : null,
          programId: input.targetType === 'PROGRAM' ? input.programId : null,
          classId: input.targetType === 'CLASS' ? input.classId : null,
          userId: input.targetType === 'USER' ? input.userId : null,
          targetType: input.targetType,
          accessPlanId: accessPlan.id,
          source: input.source,
          status,
          startsAt,
          endsAt,
          reason: input.reason.trim(),
          grantedBy: context.userId,
        },
      });
      await tx.accessGrantEvent.create({
        data: {
          accessGrantId: created.id,
          eventType: status === 'SCHEDULED' ? 'SCHEDULED' : 'CREATED',
          actorId: context.userId,
          reason: input.reason.trim(),
          metadata: { planCode: accessPlan.code, targetType: input.targetType },
        },
      });
      return created;
    });
    await this.cache.invalidateOrganization(context.organizationId);
    return { ...grant, planCode: accessPlan.code };
  }

  async invalidateOrganizationAccess(organizationId: string) {
    await this.cache.invalidateOrganization(organizationId);
  }

  async assertPublishedModuleAccess(context: AccessContext, moduleId: string) {
    const courseModule = await this.prisma.courseModule.findFirst({
      where: {
        id: moduleId,
        isPublished: true,
        course: {
          organizationId: context.organizationId,
          schoolId: context.schoolId,
          isActive: true,
          ...(context.studentId ? { enrollments: { some: { studentId: context.studentId, status: 'ACTIVE' } } } : {}),
        },
      },
      select: {
        id: true,
        courseId: true,
      },
    });
    if (!courseModule) throw new NotFoundException('Modul tidak ditemukan');
    const accessibleIds = await this.getAccessiblePublishedModuleIds(context, [courseModule.courseId]);
    if (!accessibleIds.has(moduleId)) throw new ForbiddenException('Modul tidak termasuk dalam paket aktif');
    return this.resolveEffectiveAccess(context);
  }

  async getAccessiblePublishedModuleIds(context: AccessContext, courseIds?: string[]) {
    const effective = await this.resolveEffectiveAccess(context) as any;
    const modules = await this.prisma.courseModule.findMany({
      where: {
        isPublished: true,
        ...(courseIds?.length ? { courseId: { in: courseIds } } : {}),
        course: {
          organizationId: context.organizationId,
          schoolId: context.schoolId,
          isActive: true,
          ...(context.studentId ? { enrollments: { some: { studentId: context.studentId, status: 'ACTIVE' } } } : {}),
        },
      },
      orderBy: [{ courseId: 'asc' }, { position: 'asc' }],
      select: { id: true, courseId: true, planAccess: { select: { minimumPlan: { select: { rank: true } } } } },
    });
    const accessible = new Set<string>();
    const sequenceByCourse = new Map<string, number>();
    for (const courseModule of modules) {
      const sequence = (sequenceByCourse.get(courseModule.courseId) ?? 0) + 1;
      sequenceByCourse.set(courseModule.courseId, sequence);
      if (
        sequence <= Math.min(Number(effective.plan.moduleLimit), 12)
        && Number(effective.plan.rank) >= (courseModule.planAccess?.minimumPlan.rank ?? 0)
      ) accessible.add(courseModule.id);
    }
    return accessible;
  }

  async assertEntitlement(context: AccessContext, key: string, message = 'Fitur tidak termasuk dalam paket aktif') {
    const effective = await this.resolveEffectiveAccess(context) as any;
    if (!this.entitlementEnabled(effective.entitlements?.[key])) throw new ForbiddenException(message);
    return effective;
  }

  async hasEntitlement(context: AccessContext, key: string) {
    const effective = await this.resolveEffectiveAccess(context) as any;
    return this.entitlementEnabled(effective.entitlements?.[key]);
  }

  async getEnabledAssignmentTypes(context: AccessContext, action: AssignmentAccessAction) {
    const [standard, store, affiliate] = await Promise.all([
      this.hasEntitlement(context, action === 'SUBMIT' ? 'assignments.standard.submit' : 'assignments.standard.read'),
      this.hasEntitlement(context, 'student_store.submit'),
      this.hasEntitlement(context, 'affiliate.content.submit'),
    ]);
    return [
      ...(standard ? ['WRITTEN', 'QUIZ', 'PROJECT', 'MIXED'] : []),
      ...(store ? ['STORE'] : []),
      ...(affiliate ? ['AFFILIATE'] : []),
    ];
  }

  async assertAssignmentFeatureEntitlement(context: AccessContext, type: string, action: AssignmentAccessAction) {
    return this.assertEntitlement(
      context,
      this.assignmentEntitlementKey(type, action),
      'Tugas tidak termasuk dalam paket aktif',
    );
  }

  async assertAssignmentAccess(
    context: AccessContext,
    assignmentId: string,
    action: AssignmentAccessAction,
    expectedType?: string,
  ) {
    if (!context.studentId) throw new ForbiddenException('Profil siswa diperlukan untuk akses tugas');
    const now = new Date();
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        isActive: true,
        publishedAt: { not: null, lte: now },
        ...(expectedType ? { type: expectedType } : {}),
        ...(action === 'SUBMIT' ? { startDate: { lte: now }, endDate: { gte: now } } : {}),
        module: { isPublished: true },
        course: {
          organizationId: context.organizationId,
          schoolId: context.schoolId,
          isActive: true,
          enrollments: { some: { studentId: context.studentId, status: 'ACTIVE' } },
        },
      },
      include: { module: { select: { id: true } }, course: { select: { organizationId: true, schoolId: true } } },
    });
    if (!assignment) throw new ForbiddenException(action === 'SUBMIT' ? 'Tugas belum dibuka, sudah berakhir, atau tidak tersedia' : 'Tugas tidak tersedia');
    await this.assertAssignmentFeatureEntitlement(context, assignment.type, action);
    await this.assertPublishedModuleAccess(context, assignment.moduleId);
    return assignment;
  }

  private assignmentEntitlementKey(type: string, action: AssignmentAccessAction) {
    if (type === 'STORE') return 'student_store.submit';
    if (type === 'AFFILIATE') return 'affiliate.content.submit';
    return action === 'SUBMIT' ? 'assignments.standard.submit' : 'assignments.standard.read';
  }

  private entitlementEnabled(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (value && typeof value === 'object' && 'enabled' in value) return Boolean((value as { enabled?: unknown }).enabled);
    return false;
  }

  private async validateGrantTarget(organizationId: string, input: CreateAccessGrantInput) {
    const targetValues = [input.schoolId, input.programId, input.classId, input.userId].filter(Boolean);
    if (input.targetType === 'ORGANIZATION' && targetValues.length !== 0) {
      throw new BadRequestException('Grant organisasi tidak boleh memiliki target tambahan');
    }
    if (input.targetType !== 'ORGANIZATION' && targetValues.length !== 1) {
      throw new BadRequestException('Access grant harus memiliki tepat satu target');
    }

    let count = 1;
    if (input.targetType === 'SCHOOL') count = await this.prisma.school.count({ where: { id: input.schoolId, organizationId } });
    if (input.targetType === 'PROGRAM') count = await this.prisma.program.count({ where: { id: input.programId, organizationId } });
    if (input.targetType === 'CLASS') count = await this.prisma.class.count({ where: { id: input.classId, school: { organizationId } } });
    if (input.targetType === 'USER') count = await this.prisma.user.count({ where: { id: input.userId, organizationId } });
    if (count !== 1) throw new ForbiddenException('Target access grant berada di luar organisasi aktif');
  }
}
