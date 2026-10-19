import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EarlyWarningSeverity, EarlyWarningStatus, Prisma, PublicStatisticStatus, ReportType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../infrastructure/queue.service';
import { ObjectStorageService } from '../infrastructure/object-storage.service';
import {
  CreateExportDto,
  CreatePublicStatisticDto,
  EarlyWarningQueryDto,
  MonitoringQueryDto,
  ReviewPublicStatisticDto,
  UpdateEarlyWarningDto,
} from './dto/monitoring.dto';
import { hasExceededDays } from './monitoring.utils';
import { AccessService } from '../access/access.service';

export type MonitoringContext = {
  userId: string;
  organizationId: string;
  schoolId?: string;
  studentId?: string;
  parentId?: string;
  teacherId?: string;
  roles: string[];
};

type StudentScope = {
  studentIds: string[];
  schoolIds: string[];
  studentWhere: Prisma.StudentWhereInput;
  assignmentWhere: Prisma.AssignmentWhereInput;
  lessonWhere: Prisma.LessonWhereInput;
  courseIds?: string[];
};

const ACTIVE_WARNING_STATUSES: EarlyWarningStatus[] = ['OPEN', 'ACKNOWLEDGED'];

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: ObjectStorageService,
    private readonly access: AccessService,
  ) {}

  async getOverview(context: MonitoringContext, query: MonitoringQueryDto) {
    await this.assertAdvancedDashboard(context);
    const now = new Date();
    const periodStart = new Date(now.getTime() - query.periodDays * 24 * 60 * 60 * 1000);
    const scope = await this.resolveScope(context, query.classId);
    const studentFilter = { studentId: { in: scope.studentIds } };

    const [
      students,
      totalTeachers,
      totalClasses,
      enrollments,
      publishedLessons,
      lessonProgress,
      assignments,
      submissions,
      storeSubmissions,
      affiliateVideos,
      affiliateSnapshots,
      warnings,
      imports,
      identityStatuses,
    ] = await Promise.all([
      this.prisma.student.findMany({
        where: scope.studentWhere,
        select: {
          id: true,
          fullName: true,
          studentNumber: true,
          status: true,
          classId: true,
          class: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
          user: { select: { id: true, lastLoginAt: true, activatedAt: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.teacher.count({ where: this.schoolWhere(context, scope.schoolIds) }),
      this.prisma.class.count({ where: { ...this.schoolWhere(context, scope.schoolIds), isActive: true } }),
      this.prisma.courseEnrollment.findMany({
        where: { ...studentFilter, status: { in: ['ACTIVE', 'COMPLETED'] }, ...(scope.courseIds?.length ? { courseId: { in: scope.courseIds } } : {}) },
        select: { id: true, studentId: true, status: true, courseId: true },
      }),
      this.prisma.lesson.findMany({
        where: scope.lessonWhere,
        select: { id: true, moduleId: true },
      }),
      this.prisma.lessonProgress.findMany({
        where: { ...studentFilter, lesson: scope.lessonWhere },
        select: { studentId: true, lessonId: true, state: true, progressPercent: true, updatedAt: true },
      }),
      this.prisma.assignment.findMany({
        where: scope.assignmentWhere,
        select: { id: true, title: true, type: true, endDate: true, courseId: true, maxScore: true, course: { select: { enrollments: { where: { studentId: { in: scope.studentIds }, status: 'ACTIVE' }, select: { studentId: true } } } } },
      }),
      this.prisma.submission.findMany({
        where: { ...studentFilter, assignment: scope.assignmentWhere },
        select: { id: true, studentId: true, assignmentId: true, status: true, score: true, gradePublishedAt: true, updatedAt: true, assignment: { select: { maxScore: true } } },
      }),
      this.prisma.studentStoreSubmission.findMany({
        where: { ...studentFilter, assignment: scope.assignmentWhere },
        select: { id: true, studentId: true, status: true, score: true, updatedAt: true, studentStore: { select: { platform: true } } },
      }),
      this.prisma.affiliateVideo.findMany({
        where: { ...studentFilter, submission: { assignment: scope.assignmentWhere } },
        select: { id: true, studentId: true, verification: true, publishedAt: true, updatedAt: true },
      }),
      this.prisma.affiliateMetricSnapshot.findMany({
        where: {
          studentId: { in: scope.studentIds },
          snapshotDate: { gte: periodStart, lte: now },
          verification: 'VERIFIED',
          corrections: { none: {} },
          affiliateVideo: { submission: { assignment: scope.assignmentWhere } },
        },
        orderBy: { snapshotDate: 'asc' },
        select: {
          affiliateVideoId: true,
          snapshotDate: true,
          views: true,
          clicks: true,
          orders: true,
          gmv: true,
          commission: true,
          verification: true,
        },
      }),
      this.prisma.earlyWarning.findMany({
        where: { organizationId: context.organizationId, studentId: { in: scope.studentIds }, status: { in: ACTIVE_WARNING_STATUSES } },
        select: { id: true, studentId: true, classId: true, severity: true, status: true, title: true, message: true, triggeredAt: true },
        orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
      }),
      this.prisma.importJob.findMany({
        where: {
          organizationId: context.organizationId,
          schoolId: { in: scope.schoolIds },
          createdAt: { gte: periodStart },
          ...(!context.roles.some((role) => ['super-admin', 'program-manager', 'school-admin', 'principal'].includes(role)) ? { createdById: context.userId } : {}),
        },
        select: { status: true, type: true, createdAt: true },
      }),
      this.prisma.identityDocument.groupBy({
        by: ['verificationStatus'],
        where: { studentId: { in: scope.studentIds } },
        _count: { _all: true },
      }),
    ]);

    const audience = this.audience(context.roles);
    const accessibleModulesByStudent = new Map<string, Set<string>>(await Promise.all(students.map(async (student) => [
      student.id,
      await this.access.getAccessiblePublishedModuleIds({
        organizationId: context.organizationId,
        schoolId: student.school.id,
        userId: student.user.id,
        studentId: student.id,
      }, scope.courseIds),
    ] as const)));
    const progressByStudentAndLesson = new Map(lessonProgress.map((item) => [`${item.studentId}:${item.lessonId}`, item]));
    const progressSummaryByStudent = new Map(students.map((student) => {
      const accessibleModules = accessibleModulesByStudent.get(student.id) ?? new Set<string>();
      const expectedLessons = publishedLessons.filter((lesson) => accessibleModules.has(lesson.moduleId));
      const progress = expectedLessons.map((lesson) => progressByStudentAndLesson.get(`${student.id}:${lesson.id}`));
      const totalProgress = progress.reduce((sum, item) => sum + (item?.progressPercent ?? 0), 0);
      return [student.id, {
        progressPercent: expectedLessons.length ? totalProgress / expectedLessons.length : 0,
        completedLessons: progress.filter((item) => item?.state === 'COMPLETED').length,
        totalLessons: expectedLessons.length,
      }] as const;
    }));
    const activeStudents = students.filter((student) => student.user.lastLoginAt && student.user.lastLoginAt >= periodStart).length;
    const completedLessons = lessonProgress.filter((item) => item.state === 'COMPLETED').length;
    const startedLessons = lessonProgress.filter((item) => item.state !== 'NOT_STARTED').length;
    const averageProgress = students.length
      ? [...progressSummaryByStudent.values()].reduce((sum, item) => sum + item.progressPercent, 0) / students.length
      : 0;
    const completedSubmissions = submissions.filter((item) => item.status === 'APPROVED').length;
    const pendingReviews = submissions.filter((item) => ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(item.status)).length;
    const revisionRequired = submissions.filter((item) => item.status === 'REVISION_REQUIRED').length
      + storeSubmissions.filter((item) => item.status === 'REVISION_REQUIRED').length;
    const publishedGrades = submissions.filter((item) => item.gradePublishedAt && item.score !== null);
    const averageScore = publishedGrades.length
      ? publishedGrades.reduce((sum, item) => sum + ((item.score || 0) / Math.max(item.assignment.maxScore, 1)) * 100, 0) / publishedGrades.length
      : null;
    const completedEnrollments = enrollments.filter((item) => item.status === 'COMPLETED').length;
    const courseCompletionRate = enrollments.length ? completedEnrollments / enrollments.length * 100 : 0;
    const expectedSubmissionCount = assignments.reduce((total, assignment) => total + assignment.course.enrollments.length, 0);
    const submissionCompletionRate = expectedSubmissionCount ? completedSubmissions / expectedSubmissionCount * 100 : 0;
    const latestMetricByVideo = new Map<string, (typeof affiliateSnapshots)[number]>();
    affiliateSnapshots.forEach((snapshot) => latestMetricByVideo.set(snapshot.affiliateVideoId, snapshot));
    const latestMetrics = [...latestMetricByVideo.values()];
    const metricTotals = latestMetrics.reduce(
      (total, snapshot) => ({
        views: total.views + snapshot.views,
        clicks: total.clicks + snapshot.clicks,
        orders: total.orders + snapshot.orders,
        gmv: total.gmv + Number(snapshot.gmv),
        commission: total.commission + Number(snapshot.commission),
      }),
      { views: 0, clicks: 0, orders: 0, gmv: 0, commission: 0 },
    );

    const dailyLatestByVideo = new Map<string, (typeof affiliateSnapshots)[number]>();
    affiliateSnapshots.forEach((snapshot) => {
      const date = snapshot.snapshotDate.toISOString().slice(0, 10);
      dailyLatestByVideo.set(`${date}:${snapshot.affiliateVideoId}`, snapshot);
    });
    const trendMap = new Map<string, { date: string; views: number; clicks: number; orders: number }>();
    dailyLatestByVideo.forEach((snapshot) => {
      const date = snapshot.snapshotDate.toISOString().slice(0, 10);
      const current = trendMap.get(date) || { date, views: 0, clicks: 0, orders: 0 };
      current.views += snapshot.views;
      current.clicks += snapshot.clicks;
      current.orders += snapshot.orders;
      trendMap.set(date, current);
    });

    const studentActivity = students.map((student) => {
      const progress = lessonProgress.filter((item) => item.studentId === student.id);
      const progressSummary = progressSummaryByStudent.get(student.id)!;
      const studentSubmissions = submissions.filter((item) => item.studentId === student.id);
      const studentWarnings = warnings.filter((item) => item.studentId === student.id);
      const lastProgress = progress.reduce<Date | null>((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, null);
      const lastSubmission = studentSubmissions.reduce<Date | null>((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, null);
      const lastActivity = [student.user.lastLoginAt, lastProgress, lastSubmission]
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      return {
        id: student.id,
        fullName: student.fullName,
        studentNumber: student.studentNumber,
        className: student.class?.name || 'Belum ada kelas',
        progressPercent: Math.round(progressSummary.progressPercent),
        completedLessons: progressSummary.completedLessons,
        totalLessons: progressSummary.totalLessons,
        submissionCompleted: studentSubmissions.filter((item) => item.status === 'APPROVED').length,
        warningCount: studentWarnings.length,
        lastActivity,
      };
    }).sort((a, b) => b.warningCount - a.warningCount || a.fullName.localeCompare(b.fullName));

    const schoolComparison = audience === 'PROGRAM' ? [...new Map(students.map((student) => [student.school.id, student.school])).values()].map((school) => {
      const schoolStudents = students.filter((student) => student.school.id === school.id);
      const schoolStudentIds = new Set(schoolStudents.map((student) => student.id));
      const schoolSubmissions = submissions.filter((submission) => schoolStudentIds.has(submission.studentId));
      const schoolProgress = schoolStudents.map((student) => progressSummaryByStudent.get(student.id)?.progressPercent ?? 0);
      const schoolExpectedSubmissions = assignments.reduce(
        (total, assignment) => total + assignment.course.enrollments.filter((enrollment) => schoolStudentIds.has(enrollment.studentId)).length,
        0,
      );
      return {
        schoolId: school.id,
        schoolName: school.name,
        studentCount: schoolStudents.length,
        activeRate: schoolStudents.length ? Math.round(schoolStudents.filter((student) => student.user.lastLoginAt && student.user.lastLoginAt >= periodStart).length / schoolStudents.length * 1000) / 10 : 0,
        averageProgress: schoolProgress.length ? Math.round(schoolProgress.reduce((sum, value) => sum + value, 0) / schoolProgress.length * 10) / 10 : 0,
        approvedSubmissionRate: schoolExpectedSubmissions ? Math.round(schoolSubmissions.filter((item) => item.status === 'APPROVED').length / schoolExpectedSubmissions * 1000) / 10 : 0,
      };
    }).sort((a, b) => a.schoolName.localeCompare(b.schoolName)) : [];

    return {
      audience,
      scope: { organizationId: context.organizationId, schoolIds: scope.schoolIds, classId: query.classId || null },
      period: { days: query.periodDays, start: periodStart, end: now, timezone: 'Asia/Jakarta' },
      lastUpdated: now,
      definitions: {
        activeStudents: `Siswa dengan login dalam ${query.periodDays} hari terakhir`,
        learningProgress: 'Rata-rata progres terhadap seluruh materi yang dapat diakses siswa, termasuk yang belum dimulai',
        affiliatePerformance: 'Snapshot terverifikasi terbaru per konten pada periode terpilih; snapshot yang sudah dikoreksi tidak dihitung',
        earlyWarning: 'Sinyal pendampingan berbasis aturan; bukan hukuman otomatis',
      },
      kpi: {
        totalStudents: students.length,
        activeStudents,
        inactiveStudents: Math.max(students.length - activeStudents, 0),
        totalTeachers,
        totalClasses,
        courseEnrollments: enrollments.length,
        courseCompletionRate: Math.round(courseCompletionRate * 10) / 10,
        averageLearningProgress: Math.round(averageProgress * 10) / 10,
        startedLessons,
        completedLessons,
        activeAssignments: assignments.length,
        approvedSubmissions: completedSubmissions,
        submissionCompletionRate: Math.round(submissionCompletionRate * 10) / 10,
        pendingReviews,
        revisionRequired,
        storeApproved: storeSubmissions.filter((item) => item.status === 'APPROVED').length,
        affiliateApproved: affiliateVideos.filter((item) => item.verification === 'VERIFIED').length,
        averageScore: averageScore === null ? null : Math.round(averageScore * 10) / 10,
        openWarnings: warnings.length,
        verifiedMetricSnapshots: latestMetrics.length,
        ...metricTotals,
      },
      distributions: {
        submissions: this.countBy(submissions, 'status'),
        stores: this.countBy(storeSubmissions, 'status'),
        storePlatforms: this.countBy(storeSubmissions.filter((item) => item.studentStore), 'studentStore.platform'),
        affiliateContent: this.countBy(affiliateVideos, 'verification'),
        warnings: this.countBy(warnings, 'severity'),
        grades: this.gradeDistribution(publishedGrades.map((item) => (item.score || 0) / Math.max(item.assignment.maxScore, 1) * 100)),
        imports: this.countBy(imports, 'status'),
        identityVerification: ['SCHOOL', 'PROGRAM'].includes(audience) ? identityStatuses.map((item) => ({ key: item.verificationStatus, count: item._count._all })) : [],
      },
      trends: { affiliate: [...trendMap.values()].slice(-31) },
      warnings: audience === 'PROGRAM' ? [] : warnings.slice(0, 12),
      students: audience === 'PROGRAM' ? [] : studentActivity.slice(0, 50),
      schools: schoolComparison,
    };
  }

  async getStudentLearningProgress(context: MonitoringContext, studentId: string) {
    await this.assertAdvancedDashboard(context);
    const scope = await this.resolveScope(context);
    const student = await this.prisma.student.findFirst({
      where: { AND: [scope.studentWhere, { id: studentId }] },
      select: {
        id: true,
        fullName: true,
        studentNumber: true,
        school: { select: { id: true, name: true } },
        class: { select: { name: true } },
        user: { select: { id: true } },
      },
    });
    if (!student) throw new NotFoundException('Siswa tidak ditemukan dalam ruang lingkup Anda');

    const accessibleModuleIds = await this.access.getAccessiblePublishedModuleIds({
      organizationId: context.organizationId,
      schoolId: student.school.id,
      userId: student.user.id,
      studentId: student.id,
    }, scope.courseIds);
    const modules = await this.prisma.courseModule.findMany({
      where: { id: { in: [...accessibleModuleIds] }, isPublished: true },
      orderBy: [{ courseId: 'asc' }, { position: 'asc' }],
      select: {
        id: true,
        title: true,
        position: true,
        course: { select: { id: true, code: true, name: true } },
        lessons: {
          where: { isPublished: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            estimatedMinutes: true,
            progress: {
              where: { studentId },
              select: { state: true, progressPercent: true, lastPosition: true, updatedAt: true },
              take: 1,
            },
          },
        },
      },
    });

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        studentNumber: student.studentNumber,
        schoolName: student.school.name,
        className: student.class?.name || 'Belum ada kelas',
      },
      modules: modules.map((courseModule) => ({
        ...courseModule,
        lessons: courseModule.lessons.map((lesson) => ({
          ...lesson,
          progress: lesson.progress[0] || {
            state: 'NOT_STARTED', progressPercent: 0, lastPosition: null, updatedAt: null,
          },
        })),
      })),
    };
  }

  async evaluateEarlyWarnings(context: MonitoringContext, query: MonitoringQueryDto) {
    await this.assertAdvancedDashboard(context);
    if (!context.schoolId) throw new BadRequestException('Pilih konteks sekolah untuk evaluasi early warning');
    const scope = await this.resolveScope(context, query.classId);
    const rules = await this.ensureDefaultRules(context);
    const now = new Date();
    const approachingDays = this.ruleNumber(rules.get('DEADLINE_APPROACHING_3D'), 'days', 3);
    const [students, relevantAssignments] = await Promise.all([
      this.prisma.student.findMany({
        where: scope.studentWhere,
        include: {
          user: { select: { id: true, createdAt: true, lastLoginAt: true, activatedAt: true } },
          lessonProgress: { where: { lesson: scope.lessonWhere }, include: { lesson: { select: { id: true, title: true } } } },
          submissions: { where: { assignment: scope.assignmentWhere }, include: { assignment: { select: { id: true, title: true, endDate: true, maxScore: true } }, affiliateVideos: { select: { id: true } } } },
          storeSubmissions: { where: { assignment: scope.assignmentWhere }, select: { id: true, status: true, updatedAt: true, studentStore: { select: { storeUrl: true } }, _count: { select: { files: true } } } },
          affiliateVideos: {
            where: { submission: { assignment: scope.assignmentWhere } },
            select: {
              id: true,
              verification: true,
              updatedAt: true,
              metricSnapshots: { orderBy: { snapshotDate: 'desc' }, take: 1, select: { snapshotDate: true } },
              fraudFlags: { where: { status: 'OPEN' }, select: { id: true, type: true } },
              submission: { select: { status: true } },
            },
          },
        },
      }),
      this.prisma.assignment.findMany({
        where: { ...scope.assignmentWhere, endDate: { lte: new Date(now.getTime() + approachingDays * 86400000) } },
        select: { id: true, title: true, type: true, endDate: true, course: { select: { enrollments: { where: { studentId: { in: scope.studentIds }, status: 'ACTIVE' }, select: { studentId: true } } } } },
      }),
    ]);

    const activeKeys = new Set<string>();
    let created = 0;
    let refreshed = 0;
    for (const student of students) {
      const invitationRule = rules.get('INVITATION_NOT_ACTIVATED');
      const invitationDays = this.ruleNumber(invitationRule, 'days', 3);
      const inactivityRule = rules.get('INACTIVITY_7D');
      const inactivityDays = this.ruleNumber(inactivityRule, 'days', 7);
      const lastLogin = student.user.lastLoginAt || student.user.activatedAt;
      if (invitationRule && !student.user.activatedAt && hasExceededDays(student.user.createdAt, now, invitationDays)) {
        const result = await this.upsertWarning({
          context, student, rule: invitationRule, resourceType: 'USER', resourceId: student.user.id,
          title: 'Perlu bantuan mengaktifkan akun',
          message: `Akun belum diaktifkan setelah ${invitationDays} hari. Periksa kendala undangan atau akses bersama siswa secara suportif.`,
          evidence: { accountCreatedAt: student.user.createdAt, thresholdDays: invitationDays },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      } else if (inactivityRule && hasExceededDays(lastLogin, now, inactivityDays)) {
        const result = await this.upsertWarning({
          context, student, rule: inactivityRule, resourceType: 'USER', resourceId: student.user.id,
          title: 'Perlu dukungan untuk kembali aktif',
          message: `Belum ada aktivitas login dalam ${inactivityDays} hari. Hubungi siswa secara suportif dan pastikan tidak ada kendala akses.`,
          evidence: { lastLoginAt: lastLogin, thresholdDays: inactivityDays },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const stalledLearningRule = rules.get('LEARNING_PROGRESS_STALLED');
      const stalledLearningDays = this.ruleNumber(stalledLearningRule, 'days', 7);
      for (const progress of student.lessonProgress.filter((item) => item.state === 'IN_PROGRESS' && hasExceededDays(item.updatedAt, now, stalledLearningDays))) {
        if (!stalledLearningRule) break;
        const result = await this.upsertWarning({
          context, student, rule: stalledLearningRule, resourceType: 'LESSON', resourceId: progress.lesson.id,
          title: 'Materi perlu dilanjutkan',
          message: `Materi “${progress.lesson.title}” belum dilanjutkan dalam ${stalledLearningDays} hari. Tawarkan bantuan untuk mengatasi kendala belajar.`,
          evidence: { state: progress.state, progressPercent: progress.progressPercent, lastUpdatedAt: progress.updatedAt, thresholdDays: stalledLearningDays },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const overdueRule = rules.get('OVERDUE_ASSIGNMENT');
      const approachingRule = rules.get('DEADLINE_APPROACHING_3D');
      for (const assignment of relevantAssignments.filter((item) => item.course.enrollments.some((enrollment) => enrollment.studentId === student.id))) {
          const submission = student.submissions.find((item) => item.assignmentId === assignment.id);
          if (submission && ['APPROVED', 'ARCHIVED'].includes(submission.status)) continue;
          if (assignment.endDate >= now && approachingRule && !submission) {
            const result = await this.upsertWarning({
              context, student, rule: approachingRule, resourceType: 'ASSIGNMENT', resourceId: assignment.id,
              title: 'Tenggat tugas semakin dekat',
              message: `Tugas “${assignment.title}” akan berakhir dalam beberapa hari. Bantu siswa memulai dari langkah kecil yang realistis.`,
              evidence: { deadline: assignment.endDate, submissionStatus: 'NOT_STARTED', thresholdDays: approachingDays },
            });
            activeKeys.add(result.id); result.created ? created++ : refreshed++;
          }
          const unpublishedContentRule = rules.get('AFFILIATE_CONTENT_NOT_PUBLISHED');
          if (assignment.endDate >= now && unpublishedContentRule && assignment.type.includes('AFFILIATE') && (!submission || submission.affiliateVideos.length === 0)) {
            const result = await this.upsertWarning({
              context, student, rule: unpublishedContentRule, resourceType: 'ASSIGNMENT', resourceId: assignment.id,
              title: 'Konten affiliate belum dipublikasikan',
              message: `Konten untuk tugas “${assignment.title}” belum tercatat. Periksa kendala publikasi dan bantu siswa menyiapkan langkah berikutnya.`,
              evidence: { deadline: assignment.endDate, submissionStatus: submission?.status || 'NOT_STARTED' },
            });
            activeKeys.add(result.id); result.created ? created++ : refreshed++;
          }
          if (!overdueRule || assignment.endDate >= now) continue;
          const result = await this.upsertWarning({
            context, student, rule: overdueRule, resourceType: 'ASSIGNMENT', resourceId: assignment.id,
            title: 'Tugas melewati tenggat',
            message: `Tugas “${assignment.title}” memerlukan tindak lanjut. Bantu siswa menyusun langkah penyelesaian yang realistis.`,
            evidence: { deadline: assignment.endDate, submissionStatus: submission?.status || 'NOT_STARTED' },
          });
          activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const staleDraftRule = rules.get('STALE_DRAFT_7D');
      const staleDraftDays = this.ruleNumber(staleDraftRule, 'days', 7);
      const staleDrafts = [
        ...student.submissions.filter((item) => item.status === 'DRAFT' && hasExceededDays(item.updatedAt, now, staleDraftDays)).map((item) => ({ id: item.id, kind: 'SUBMISSION' })),
        ...student.storeSubmissions.filter((item) => item.status === 'DRAFT' && hasExceededDays(item.updatedAt, now, staleDraftDays)).map((item) => ({ id: item.id, kind: 'STORE_SUBMISSION' })),
      ];
      for (const draft of staleDrafts) {
        if (!staleDraftRule) break;
        const result = await this.upsertWarning({
          context, student, rule: staleDraftRule, resourceType: draft.kind, resourceId: draft.id,
          title: 'Draf perlu dilanjutkan',
          message: `Draf belum diperbarui dalam ${staleDraftDays} hari. Tawarkan bantuan untuk menentukan langkah berikutnya.`,
          evidence: { thresholdDays: staleDraftDays },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const lowGradeRule = rules.get('LOW_GRADE_REPEAT');
      const lowGradeThreshold = this.ruleNumber(lowGradeRule, 'percent', 60);
      const lowGradeCount = this.ruleNumber(lowGradeRule, 'count', 2);
      const lowGrades = student.submissions.filter((item) => item.gradePublishedAt && item.score !== null && item.score / Math.max(item.assignment.maxScore, 1) * 100 < lowGradeThreshold);
      if (lowGradeRule && lowGrades.length >= lowGradeCount) {
        const result = await this.upsertWarning({
          context, student, rule: lowGradeRule, resourceType: 'STUDENT', resourceId: student.id,
          title: 'Perlu dukungan belajar tambahan',
          message: 'Beberapa nilai terpublikasi menunjukkan siswa mungkin membutuhkan penjelasan atau latihan tambahan. Gunakan percakapan suportif.',
          evidence: { lowPublishedGradeCount: lowGrades.length, thresholdPercent: lowGradeThreshold, thresholdCount: lowGradeCount },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const storeRule = rules.get('STORE_EVIDENCE_INCOMPLETE');
      const minimumStoreFiles = this.ruleNumber(storeRule, 'minimumFiles', 1);
      for (const store of student.storeSubmissions.filter((item) => item.status !== 'APPROVED' && (!item.studentStore?.storeUrl || item._count.files < minimumStoreFiles))) {
        if (!storeRule) break;
        const result = await this.upsertWarning({
          context, student, rule: storeRule, resourceType: 'STORE_SUBMISSION', resourceId: store.id,
          title: 'Bukti Student Store belum lengkap',
          message: 'URL toko atau bukti pendukung belum lengkap. Bantu siswa memeriksa checklist tanpa memberi hukuman otomatis.',
          evidence: { hasStoreUrl: Boolean(store.studentStore?.storeUrl), fileCount: store._count.files, minimumFiles: minimumStoreFiles },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const affiliateContentRule = rules.get('AFFILIATE_CONTENT_UNVERIFIED');
      const affiliateContentDays = this.ruleNumber(affiliateContentRule, 'days', 7);
      for (const video of student.affiliateVideos.filter((item) => item.verification === 'UNVERIFIED' && hasExceededDays(item.updatedAt, now, affiliateContentDays))) {
        if (!affiliateContentRule) break;
        const result = await this.upsertWarning({
          context, student, rule: affiliateContentRule, resourceType: 'AFFILIATE_CONTENT', resourceId: video.id,
          title: 'Konten affiliate perlu ditindaklanjuti',
          message: `Konten belum terverifikasi setelah ${affiliateContentDays} hari. Periksa status submission dan bantu siswa menindaklanjuti feedback.`,
          evidence: { submissionStatus: video.submission.status, thresholdDays: affiliateContentDays },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const revisionRule = rules.get('REVISION_REQUIRED_REPEAT');
      const revisionThreshold = this.ruleNumber(revisionRule, 'count', 2);
      const revisionCount = student.submissions.filter((item) => item.status === 'REVISION_REQUIRED').length
        + student.storeSubmissions.filter((item) => item.status === 'REVISION_REQUIRED').length;
      if (revisionRule && revisionCount >= revisionThreshold) {
        const result = await this.upsertWarning({
          context, student, rule: revisionRule, resourceType: 'STUDENT', resourceId: student.id,
          title: 'Perlu pendampingan revisi',
          message: 'Beberapa hasil kerja masih memerlukan revisi. Tinjau pola feedback dan tawarkan sesi pendampingan singkat.',
          evidence: { revisionRequiredCount: revisionCount, threshold: revisionThreshold },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }

      const staleRule = rules.get('AFFILIATE_METRIC_STALE');
      const staleMetricDays = this.ruleNumber(staleRule, 'days', 14);
      for (const video of student.affiliateVideos.filter((item) => item.verification === 'VERIFIED')) {
        const latest = video.metricSnapshots[0]?.snapshotDate;
        if (staleRule && hasExceededDays(latest, now, staleMetricDays)) {
          const result = await this.upsertWarning({
            context, student, rule: staleRule, resourceType: 'AFFILIATE_CONTENT', resourceId: video.id,
            title: 'Performa affiliate perlu diperbarui',
            message: `Snapshot metrik belum diperbarui dalam ${staleMetricDays} hari. Ingatkan siswa untuk mencatat data terbaru yang dapat diverifikasi.`,
            evidence: { latestSnapshotAt: latest || null, thresholdDays: staleMetricDays },
          });
          activeKeys.add(result.id); result.created ? created++ : refreshed++;
        }
      }

      const qualityRule = rules.get('OPEN_DATA_QUALITY_FLAG');
      const openFlags = student.affiliateVideos.flatMap((item) => item.fraudFlags.map((flag) => ({ ...flag, videoId: item.id })));
      if (qualityRule && openFlags.length > 0) {
        const result = await this.upsertWarning({
          context, student, rule: qualityRule, resourceType: 'STUDENT', resourceId: student.id,
          title: 'Data affiliate perlu diperiksa',
          message: 'Ada penanda kualitas data yang belum diselesaikan. Lakukan verifikasi manusia sebelum mengambil keputusan.',
          evidence: { openFlagCount: openFlags.length, flagTypes: [...new Set(openFlags.map((item) => item.type))] },
        });
        activeKeys.add(result.id); result.created ? created++ : refreshed++;
      }
    }

    const stale = await this.prisma.earlyWarning.findMany({
      where: {
        schoolId: context.schoolId,
        studentId: { in: scope.studentIds },
        ruleId: { in: [...rules.values()].map((rule) => rule.id) },
        status: { in: ACTIVE_WARNING_STATUSES },
        ...(activeKeys.size ? { id: { notIn: [...activeKeys] } } : {}),
      },
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.earlyWarning.updateMany({
        where: { id: { in: stale.map((item) => item.id) } },
        data: { status: 'RESOLVED', resolvedAt: now, resolution: 'Sinyal tidak lagi terdeteksi pada evaluasi terbaru.' },
      });
    }
    return { evaluatedStudents: students.length, created, refreshed, autoResolved: stale.length, evaluatedAt: now };
  }

  async listEarlyWarnings(context: MonitoringContext, query: EarlyWarningQueryDto) {
    await this.assertAdvancedDashboard(context);
    const scope = await this.resolveScope(context, query.classId);
    if (query.studentId && !scope.studentIds.includes(query.studentId)) throw new ForbiddenException('Siswa berada di luar ruang lingkup Anda');
    const warnings = await this.prisma.earlyWarning.findMany({
      where: {
        organizationId: context.organizationId,
        studentId: query.studentId || { in: scope.studentIds },
        ...(query.status ? { status: query.status } : { status: { in: ACTIVE_WARNING_STATUSES } }),
      },
      include: {
        student: { select: { id: true, fullName: true, studentNumber: true, class: { select: { name: true } } } },
        rule: { select: { code: true, name: true, description: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        actions: { orderBy: { createdAt: 'desc' }, take: 5, include: { actor: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
      take: 200,
    });
    if (!context.studentId && !context.parentId) return warnings;
    return warnings.map((warning) => ({
      id: warning.id,
      severity: warning.severity,
      status: warning.status,
      title: warning.title,
      message: warning.message,
      triggeredAt: warning.triggeredAt,
      student: warning.student,
      rule: warning.rule,
      assignedTo: null,
      actions: [],
    }));
  }

  async updateEarlyWarning(context: MonitoringContext, id: string, dto: UpdateEarlyWarningDto) {
    await this.assertAdvancedDashboard(context);
    const warning = await this.prisma.earlyWarning.findFirst({
      where: { id, organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}) },
    });
    if (!warning) throw new NotFoundException('Early warning tidak ditemukan');
    if (context.studentId || context.parentId) throw new ForbiddenException('Hanya petugas pendamping yang dapat memperbarui tindak lanjut');
    if (['RESOLVED', 'DISMISSED'].includes(warning.status)) throw new BadRequestException('Early warning sudah memiliki keputusan final');
    const scope = await this.resolveScope(context);
    if (!scope.studentIds.includes(warning.studentId)) throw new ForbiddenException('Early warning berada di luar ruang lingkup Anda');
    if (dto.status === 'OPEN') throw new BadRequestException('Status tidak dapat dikembalikan ke OPEN melalui aksi ini');
    if (dto.status === warning.status) throw new BadRequestException('Status early warning tidak berubah');
    const resolved = ['RESOLVED', 'DISMISSED'].includes(dto.status);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.earlyWarning.update({
        where: { id },
        data: {
          status: dto.status,
          actionNote: dto.note.trim(),
          acknowledgedAt: dto.status === 'ACKNOWLEDGED' ? new Date() : warning.acknowledgedAt,
          resolvedAt: resolved ? new Date() : null,
          resolvedById: resolved ? context.userId : null,
          resolution: resolved ? dto.note.trim() : null,
        },
      });
      await tx.earlyWarningAction.create({
        data: { earlyWarningId: id, actorId: context.userId, fromStatus: warning.status, toStatus: dto.status, note: dto.note.trim() },
      });
      return updated;
    });
  }

  async getReportOptions(context: MonitoringContext) {
    await this.assertReportAccess(context);
    const broadRole = this.hasBroadReportingRole(context);
    const reportTypes = [
      { value: ReportType.USER_ENROLLMENTS, label: 'User dan enrollment', privileged: true },
      { value: ReportType.LEARNING_ACTIVITY, label: 'Aktivitas pembelajaran', privileged: false },
      { value: ReportType.STUDENT_PROGRESS, label: 'Progres course dan siswa', privileged: false },
      { value: ReportType.ASSIGNMENT_SUBMISSIONS, label: 'Tugas dan submission', privileged: false },
      { value: ReportType.GRADES_RUBRICS, label: 'Nilai dan rubrik terpublikasi', privileged: false },
      { value: ReportType.STUDENT_STORES, label: 'Student Store dan checklist', privileged: false },
      { value: ReportType.STORE_REVIEW_REVISIONS, label: 'Review dan revisi Student Store', privileged: false },
      { value: ReportType.AFFILIATE_CONTENT, label: 'Konten affiliate', privileged: false },
      { value: ReportType.AFFILIATE_PERFORMANCE, label: 'Riwayat metrik affiliate', privileged: false },
      { value: ReportType.EARLY_WARNINGS, label: 'Early warning', privileged: false },
      { value: ReportType.IDENTITY_VERIFICATION, label: 'Status verifikasi identitas', privileged: true },
      { value: ReportType.CONSENT_STATUS, label: 'Status consent', privileged: true },
      { value: ReportType.TEACHER_WORKLOAD, label: 'Beban kerja guru/reviewer', privileged: true },
      { value: ReportType.IMPORT_HISTORY, label: 'Riwayat import', privileged: true },
      { value: ReportType.AUDIT_SUMMARY, label: 'Ringkasan audit', privileged: true },
    ];
    return {
      formats: [{ value: 'CSV', label: 'CSV aman untuk spreadsheet' }],
      reportTypes: reportTypes.filter((item) => broadRole || !item.privileged).map(({ privileged: _privileged, ...item }) => item),
      notes: ['Data sensitif tidak disertakan', 'Nilai hanya yang sudah dipublikasikan', 'File privat dan tautan unduh memiliki masa berlaku'],
    };
  }

  async createExport(context: MonitoringContext, dto: CreateExportDto) {
    await this.assertReportAccess(context);
    const privilegedReports: ReportType[] = [
      ReportType.USER_ENROLLMENTS,
      ReportType.IDENTITY_VERIFICATION,
      ReportType.CONSENT_STATUS,
      ReportType.TEACHER_WORKLOAD,
      ReportType.IMPORT_HISTORY,
      ReportType.AUDIT_SUMMARY,
    ];
    if (privilegedReports.includes(dto.reportType) && !this.hasBroadReportingRole(context)) {
      throw new ForbiddenException('Jenis laporan ini hanya tersedia untuk pengelola sekolah atau program');
    }
    const scope = await this.resolveScope(context, dto.classId);
    const exportJob = await this.prisma.exportJob.create({
      data: {
        organizationId: context.organizationId,
        schoolId: context.schoolId || null,
        requestedById: context.userId,
        reportType: dto.reportType,
        format: dto.format,
        timezone: dto.timezone,
        filters: { periodDays: dto.periodDays, classId: dto.classId || null, studentIds: scope.studentIds },
      },
    });
    await this.queue.add('report-export', 'generate-csv', {
      organizationId: context.organizationId,
      schoolId: exportJob.schoolId || undefined,
      requestedBy: context.userId,
      payload: { exportJobId: exportJob.id },
    }, { jobId: `report-export-${exportJob.id}` });
    return exportJob;
  }

  async listExports(context: MonitoringContext) {
    await this.assertReportAccess(context);
    const broadRole = context.roles.some((role) => ['super-admin', 'program-manager', 'school-admin', 'principal'].includes(role));
    await this.prisma.exportJob.updateMany({
      where: { organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}), status: 'COMPLETED', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return this.prisma.exportJob.findMany({
      where: {
        organizationId: context.organizationId,
        ...(context.schoolId ? { schoolId: context.schoolId } : {}),
        ...(!broadRole ? { requestedById: context.userId } : {}),
      },
      select: { id: true, reportType: true, format: true, status: true, rowCount: true, fileName: true, failureReason: true, expiresAt: true, createdAt: true, completedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getExportDownload(context: MonitoringContext, id: string) {
    await this.assertReportAccess(context);
    const job = await this.prisma.exportJob.findFirst({
      where: { id, organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}) },
    });
    if (!job) throw new NotFoundException('Export tidak ditemukan');
    const broadRole = context.roles.some((role) => ['super-admin', 'program-manager', 'school-admin', 'principal'].includes(role));
    if (!broadRole && job.requestedById !== context.userId) throw new ForbiddenException('Export berada di luar ruang lingkup Anda');
    if (job.status !== 'COMPLETED' || !job.storageKey || !job.expiresAt || job.expiresAt <= new Date()) {
      throw new BadRequestException('File export belum siap atau sudah kedaluwarsa');
    }
    await this.prisma.exportDownloadEvent.create({
      data: { exportJobId: job.id, organizationId: context.organizationId, schoolId: job.schoolId, actorId: context.userId },
    });
    return { fileName: job.fileName, expiresAt: job.expiresAt, url: await this.storage.createDownloadUrl('exports', job.storageKey, 120) };
  }

  async createPublicStatistic(context: MonitoringContext, dto: CreatePublicStatisticDto) {
    await this.assertAdvancedDashboard(context);
    if (!context.schoolId) throw new BadRequestException('Pilih sekolah untuk membuat statistik publik');
    const overview = await this.getOverview(context, dto);
    const now = new Date();
    return this.prisma.publicStatistic.create({
      data: {
        organizationId: context.organizationId,
        schoolId: context.schoolId,
        title: dto.title.trim(),
        periodStart: new Date(now.getTime() - dto.periodDays * 86400000),
        periodEnd: now,
        cohortSize: overview.kpi.totalStudents,
        metrics: {
          participatingStudents: overview.kpi.totalStudents,
          averageLearningProgress: overview.kpi.averageLearningProgress,
          approvedStores: overview.kpi.storeApproved,
          approvedAffiliateContent: overview.kpi.affiliateApproved,
        },
        status: 'PENDING_APPROVAL',
        createdById: context.userId,
      },
    });
  }

  async listPublicStatistics(context: MonitoringContext) {
    await this.assertAdvancedDashboard(context);
    return this.prisma.publicStatistic.findMany({
      where: { organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}) },
      include: { school: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } }, reviewedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reviewPublicStatistic(context: MonitoringContext, id: string, dto: ReviewPublicStatisticDto) {
    await this.assertAdvancedDashboard(context);
    const statistic = await this.prisma.publicStatistic.findFirst({
      where: { id, organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}) },
    });
    if (!statistic) throw new NotFoundException('Statistik tidak ditemukan');
    if (statistic.status !== 'PENDING_APPROVAL') throw new BadRequestException('Statistik sudah memiliki keputusan final');
    if (dto.decision === 'APPROVED' && statistic.createdById === context.userId) throw new ForbiddenException('Pembuat snapshot tidak boleh menyetujui statistiknya sendiri');
    if (dto.decision === 'REJECTED' && !dto.notes?.trim()) throw new BadRequestException('Catatan wajib untuk penolakan statistik');
    if (dto.decision === 'APPROVED' && statistic.cohortSize < statistic.minimumCohort) {
      throw new BadRequestException(`Statistik memerlukan minimal ${statistic.minimumCohort} peserta untuk melindungi privasi`);
    }
    const approved = dto.decision === 'APPROVED';
    return this.prisma.publicStatistic.update({
      where: { id },
      data: {
        status: dto.decision as PublicStatisticStatus,
        reviewedById: context.userId,
        reviewNotes: dto.notes?.trim() || null,
        approvedAt: approved ? new Date() : null,
        publishedAt: approved ? new Date() : null,
      },
    });
  }

  async getPublishedStatistics() {
    const statistics = await this.prisma.publicStatistic.findMany({
      where: { status: 'APPROVED', publishedAt: { not: null } },
      select: { id: true, title: true, periodStart: true, periodEnd: true, cohortSize: true, minimumCohort: true, metrics: true, publishedAt: true, school: { select: { name: true, city: true, province: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 12,
    });
    return statistics
      .filter((item) => item.cohortSize >= item.minimumCohort)
      .map(({ minimumCohort: _minimumCohort, ...item }) => item);
  }

  private async resolveScope(context: MonitoringContext, classId?: string): Promise<StudentScope> {
    if (!context.organizationId) throw new ForbiddenException('Konteks organisasi tidak tersedia');
    const now = new Date();
    let studentWhere: Prisma.StudentWhereInput;
    let teacherCourseIds: string[] = [];
    if (context.studentId) {
      studentWhere = { id: context.studentId, school: { organizationId: context.organizationId } };
    } else if (context.parentId) {
      studentWhere = {
        school: { organizationId: context.organizationId },
        studentParents: {
          some: {
            parentId: context.parentId,
            verificationStatus: 'VERIFIED',
            revokedAt: null,
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
        },
      };
    } else if (context.roles.includes('teacher')) {
      if (!context.teacherId || !context.schoolId) throw new ForbiddenException('Konteks guru dan sekolah diperlukan');
      const [teachingAssignments, ownedAssignments] = await Promise.all([
        this.prisma.teacherAssignment.findMany({
          where: { teacherId: context.teacherId, schoolId: context.schoolId, isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          select: { classId: true, courseId: true },
        }),
        this.prisma.assignment.findMany({ where: { teacherId: context.teacherId, course: { schoolId: context.schoolId } }, select: { courseId: true } }),
      ]);
      const classIds = [...new Set(teachingAssignments.map((item) => item.classId))];
      teacherCourseIds = [...new Set([...teachingAssignments.map((item) => item.courseId).filter((id): id is string => Boolean(id)), ...ownedAssignments.map((item) => item.courseId)])];
      studentWhere = {
        schoolId: context.schoolId,
        OR: [
          ...(classIds.length ? [{ classEnrollments: { some: { classId: { in: classIds }, status: 'ACTIVE' as const } } }] : []),
          ...(teacherCourseIds.length ? [{ courseEnrollments: { some: { courseId: { in: teacherCourseIds }, status: 'ACTIVE' as const } } }] : []),
        ],
      };
    } else if (context.schoolId) {
      studentWhere = { schoolId: context.schoolId };
    } else {
      studentWhere = { school: { organizationId: context.organizationId } };
    }
    if (classId) studentWhere = { AND: [studentWhere, { OR: [{ classId }, { classEnrollments: { some: { classId, status: 'ACTIVE' } } }] }] };
    const students = await this.prisma.student.findMany({ where: studentWhere, select: { id: true, schoolId: true } });
    if (classId && students.length === 0) {
      const allowedClass = await this.prisma.class.count({
        where: {
          id: classId,
          school: { organizationId: context.organizationId },
          ...(context.schoolId ? { schoolId: context.schoolId } : {}),
          ...(context.roles.includes('teacher') ? { teacherAssignments: { some: { teacherId: context.teacherId, isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } } } : {}),
        },
      });
      if (!allowedClass) throw new ForbiddenException('Kelas berada di luar ruang lingkup Anda');
    }
    const studentIds = students.map((student) => student.id);
    const schoolIds = [...new Set(students.map((student) => student.schoolId).concat(context.schoolId ? [context.schoolId] : []))];
    const assignmentWhere: Prisma.AssignmentWhereInput = {
      isActive: true,
      publishedAt: { not: null, lte: now },
      module: { isPublished: true },
      ...(context.roles.includes('teacher')
        ? { teacherId: context.teacherId, ...(teacherCourseIds.length ? { courseId: { in: teacherCourseIds } } : {}) }
        : context.studentId || context.parentId
          ? { course: { enrollments: { some: { studentId: { in: studentIds }, status: 'ACTIVE' } } } }
          : { course: { schoolId: { in: schoolIds } } }),
    };
    const lessonWhere: Prisma.LessonWhereInput = {
      isPublished: true,
      module: {
        isPublished: true,
        course: context.roles.includes('teacher')
          ? { id: { in: teacherCourseIds }, schoolId: context.schoolId }
          : context.studentId || context.parentId
            ? { enrollments: { some: { studentId: { in: studentIds }, status: 'ACTIVE' } } }
            : { schoolId: { in: schoolIds } },
      },
    };
    return {
      studentIds,
      schoolIds,
      studentWhere,
      assignmentWhere,
      lessonWhere,
      courseIds: teacherCourseIds,
    };
  }

  private schoolWhere(context: MonitoringContext, schoolIds: string[]) {
    return context.schoolId ? { schoolId: context.schoolId } : { school: { organizationId: context.organizationId }, schoolId: { in: schoolIds } };
  }

  private audience(roles: string[]) {
    if (roles.includes('student')) return 'STUDENT';
    if (roles.includes('parent')) return 'PARENT';
    if (roles.includes('teacher')) return 'TEACHER';
    if (roles.some((role) => ['school-admin', 'principal'].includes(role))) return 'SCHOOL';
    return 'PROGRAM';
  }

  private assertAdvancedDashboard(context: MonitoringContext) {
    return this.access.assertEntitlement(context, 'dashboards.advanced.read', 'Dashboard lanjutan tidak termasuk dalam paket aktif');
  }

  private assertReportAccess(context: MonitoringContext) {
    return this.access.assertEntitlement(context, 'reports.export', 'Laporan dan export tidak termasuk dalam paket aktif');
  }

  private hasBroadReportingRole(context: MonitoringContext) {
    return context.roles.some((role) => ['super-admin', 'program-manager', 'school-admin', 'principal'].includes(role));
  }

  private countBy<T extends Record<string, any>>(rows: T[], path: string) {
    const keys = path.split('.');
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      let value: any = row;
      keys.forEach((key) => { value = value?.[key]; });
      const normalized = String(value || 'BELUM_ADA');
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return [...counts.entries()].map(([key, count]) => ({ key, count }));
  }

  private gradeDistribution(scores: number[]) {
    const buckets = [
      { key: '0–59', min: 0, max: 59 },
      { key: '60–74', min: 60, max: 74 },
      { key: '75–89', min: 75, max: 89 },
      { key: '90–100', min: 90, max: 100 },
    ];
    return buckets.map((bucket) => ({ key: bucket.key, count: scores.filter((score) => score >= bucket.min && score <= bucket.max).length }));
  }

  private ruleNumber(rule: { thresholds?: unknown } | undefined, key: string, fallback: number) {
    if (!rule?.thresholds || typeof rule.thresholds !== 'object' || Array.isArray(rule.thresholds)) return fallback;
    const value = Number((rule.thresholds as Record<string, unknown>)[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private async ensureDefaultRules(context: MonitoringContext) {
    const definitions: Array<{ code: string; name: string; description: string; signalType: string; thresholds: object; severity: EarlyWarningSeverity }> = [
      { code: 'INACTIVITY_7D', name: 'Tidak aktif 7 hari', description: 'Mendeteksi siswa yang memerlukan dukungan untuk kembali aktif.', signalType: 'INACTIVITY', thresholds: { days: 7 }, severity: 'ATTENTION' },
      { code: 'INVITATION_NOT_ACTIVATED', name: 'Undangan belum diaktifkan', description: 'Mendeteksi akun siswa yang memerlukan bantuan aktivasi setelah undangan.', signalType: 'INVITATION_PENDING', thresholds: { days: 3 }, severity: 'INFO' },
      { code: 'LEARNING_PROGRESS_STALLED', name: 'Progress materi tertinggal', description: 'Mendeteksi materi yang sudah dimulai tetapi lama tidak dilanjutkan.', signalType: 'LEARNING_STALLED', thresholds: { days: 7 }, severity: 'ATTENTION' },
      { code: 'DEADLINE_APPROACHING_3D', name: 'Tenggat mendekat', description: 'Mengingatkan tugas yang belum dimulai ketika tenggat semakin dekat.', signalType: 'DEADLINE_APPROACHING', thresholds: { days: 3 }, severity: 'INFO' },
      { code: 'OVERDUE_ASSIGNMENT', name: 'Tugas melewati tenggat', description: 'Menandai tugas yang belum selesai setelah tenggat.', signalType: 'OVERDUE_ASSIGNMENT', thresholds: { days: 0 }, severity: 'HIGH' },
      { code: 'STALE_DRAFT_7D', name: 'Draf tidak diperbarui', description: 'Mendeteksi draf yang mungkin memerlukan bantuan untuk dilanjutkan.', signalType: 'STALE_DRAFT', thresholds: { days: 7 }, severity: 'ATTENTION' },
      { code: 'REVISION_REQUIRED_REPEAT', name: 'Revisi berulang', description: 'Mendorong pendampingan saat beberapa hasil kerja memerlukan revisi.', signalType: 'REVISION_REQUIRED', thresholds: { count: 2 }, severity: 'ATTENTION' },
      { code: 'LOW_GRADE_REPEAT', name: 'Nilai rendah berulang', description: 'Menawarkan dukungan belajar setelah beberapa nilai terpublikasi berada di bawah ambang.', signalType: 'LOW_GRADE', thresholds: { count: 2, percent: 60 }, severity: 'ATTENTION' },
      { code: 'STORE_EVIDENCE_INCOMPLETE', name: 'Bukti Student Store belum lengkap', description: 'Memeriksa URL dan bukti pendukung toko yang belum lengkap.', signalType: 'STORE_INCOMPLETE', thresholds: { minimumFiles: 1 }, severity: 'INFO' },
      { code: 'AFFILIATE_CONTENT_UNVERIFIED', name: 'Konten affiliate belum terverifikasi', description: 'Mendorong tindak lanjut konten yang lama belum terverifikasi.', signalType: 'AFFILIATE_CONTENT', thresholds: { days: 7 }, severity: 'INFO' },
      { code: 'AFFILIATE_CONTENT_NOT_PUBLISHED', name: 'Konten affiliate belum dipublikasikan', description: 'Mendeteksi tugas affiliate mendekati tenggat tanpa konten yang tercatat.', signalType: 'AFFILIATE_NOT_PUBLISHED', thresholds: { days: 3 }, severity: 'INFO' },
      { code: 'AFFILIATE_METRIC_STALE', name: 'Metrik affiliate belum diperbarui', description: 'Mengingatkan pembaruan snapshot performa.', signalType: 'STALE_METRIC', thresholds: { days: 14 }, severity: 'INFO' },
      { code: 'OPEN_DATA_QUALITY_FLAG', name: 'Penanda kualitas data terbuka', description: 'Memerlukan pemeriksaan manusia atas penanda kualitas data.', signalType: 'DATA_QUALITY', thresholds: { count: 1 }, severity: 'HIGH' },
    ];
    const result = new Map<string, any>();
    for (const definition of definitions) {
      const existing = await this.prisma.earlyWarningRule.findFirst({ where: { organizationId: context.organizationId, schoolId: context.schoolId, code: definition.code } });
      const rule = existing || await this.prisma.earlyWarningRule.create({
        data: { organizationId: context.organizationId, schoolId: context.schoolId, createdById: context.userId, ...definition },
      });
      if (rule.isEnabled) result.set(rule.code, rule);
    }
    return result;
  }

  private async upsertWarning(input: {
    context: MonitoringContext;
    student: { id: string; schoolId: string; classId: string | null };
    rule: { id: string; severity: EarlyWarningSeverity };
    resourceType: string;
    resourceId: string;
    title: string;
    message: string;
    evidence: Prisma.InputJsonValue;
  }) {
    const existing = await this.prisma.earlyWarning.findFirst({
      where: { ruleId: input.rule.id, studentId: input.student.id, resourceType: input.resourceType, resourceId: input.resourceId },
    });
    if (existing) {
      const warning = await this.prisma.earlyWarning.update({
        where: { id: existing.id },
        data: { title: input.title, message: input.message, evidence: input.evidence, severity: input.rule.severity, lastEvaluatedAt: new Date(), ...(existing.status === 'RESOLVED' || existing.status === 'DISMISSED' ? { status: 'OPEN', resolvedAt: null, resolvedById: null, resolution: null } : {}) },
      });
      return { id: warning.id, created: false };
    }
    const warning = await this.prisma.earlyWarning.create({
      data: {
        organizationId: input.context.organizationId,
        schoolId: input.student.schoolId,
        classId: input.student.classId,
        studentId: input.student.id,
        ruleId: input.rule.id,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        severity: input.rule.severity,
        title: input.title,
        message: input.message,
        evidence: input.evidence,
      },
    });
    return { id: warning.id, created: true };
  }
}
