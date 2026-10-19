import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}

  /**
   * Dashboard Siswa
   */
  async getStudentDashboard(actor: any) {
    const studentId = actor.studentId;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: actor.schoolId, userId: actor.userId },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    const [moduleIds, assignmentTypes, affiliateAccess] = await Promise.all([
      this.access.getAccessiblePublishedModuleIds(actor),
      this.access.getEnabledAssignmentTypes(actor, 'READ'),
      this.access.hasEntitlement(actor, 'affiliate.metrics.manage'),
    ]);
    const videos = affiliateAccess ? await this.prisma.affiliateVideo.findMany({
      where: { studentId, student: { schoolId: actor.schoolId } },
      include: { metricSnapshots: { where: { verification: 'VERIFIED', corrections: { none: {} } }, orderBy: { snapshotDate: 'desc' }, take: 1 } },
    }) : [];

    let views = 0;
    let clicks = 0;
    let orders = 0;
    let gmv = 0;
    let commission = 0;

    videos.forEach((v) => {
      const latest = v.metricSnapshots[0];
      if (latest) {
        views += latest.views;
        clicks += latest.clicks;
        orders += latest.orders;
        gmv += Number(latest.gmv);
        commission += Number(latest.commission);
      }
    });

    // 2. Ambil tugas aktif (belum deadline dan belum selesai)
    const activeAssignments = await this.prisma.assignment.findMany({
      where: {
        course: { schoolId: student.schoolId, enrollments: { some: { studentId, status: 'ACTIVE' } } },
        moduleId: { in: [...moduleIds] },
        module: { isPublished: true },
        type: { in: assignmentTypes },
        publishedAt: { not: null, lte: new Date() },
        endDate: { gte: new Date() },
        isActive: true,
      },
      include: {
        submissions: { where: { studentId } },
      },
    });

    const pendingTasks = activeAssignments.filter((a) => a.submissions.length === 0);

    return {
      studentInfo: {
        fullName: student.fullName,
        className: student.class?.name || 'Belum ada kelas',
      },
      kpi: {
        views,
        clicks,
        orders,
        gmv,
        commission,
        ctr: views > 0 ? (clicks / views) * 100 : 0,
        conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
      },
      activeAssignmentsCount: activeAssignments.length,
      pendingTasksCount: pendingTasks.length,
      recentVideosCount: videos.length,
      affiliateAccess,
    };
  }

  /**
   * Dashboard Guru (Teacher)
   */
  async getTeacherDashboard(actor: any) {
    const { teacherId, schoolId } = actor;
    const [ownedCourses, classAssignments, advancedAccess] = await Promise.all([
      this.prisma.assignment.findMany({ where: { teacherId, course: { schoolId } }, distinct: ['courseId'], select: { courseId: true } }),
      this.prisma.teacherAssignment.findMany({ where: { teacherId, schoolId, isActive: true }, select: { classId: true } }),
      this.access.hasEntitlement(actor, 'dashboards.advanced.read'),
    ]);
    const courseIds = ownedCourses.map((item) => item.courseId);
    const classIds = classAssignments.map((item) => item.classId);
    const totalStudents = await this.prisma.student.count({
      where: { schoolId, OR: [
        ...(courseIds.length ? [{ courseEnrollments: { some: { courseId: { in: courseIds }, status: 'ACTIVE' as const } } }] : []),
        ...(classIds.length ? [{ classEnrollments: { some: { classId: { in: classIds }, status: 'ACTIVE' as const } } }] : []),
      ] },
    });

    // 2. Ambil submission yang perlu diperiksa (status SUBMITTED/RESUBMITTED)
    const pendingReviews = await this.prisma.submission.findMany({
      where: {
        assignment: { teacherId, course: { schoolId } },
        status: { in: ['SUBMITTED', 'RESUBMITTED'] },
      },
      include: {
        student: { select: { fullName: true } },
        assignment: { select: { title: true } },
      },
    });

    // 3. Ambil tugas aktif yang dibuat oleh guru ini
    const activeAssignments = await this.prisma.assignment.findMany({
      where: {
        teacherId,
        course: { schoolId },
        endDate: { gte: new Date() },
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        endDate: true,
        _count: { select: { submissions: true } },
      },
    });

    return {
      kpi: {
        totalStudents,
        pendingReviewsCount: pendingReviews.length,
        activeAssignmentsCount: activeAssignments.length,
      },
      pendingReviewsQueue: pendingReviews.slice(0, 10),
      activeAssignments,
      advancedAccess,
    };
  }

  /**
   * Dashboard Sekolah (School Admin / Principal)
   */
  async getSchoolDashboard(actor: any) {
    const schoolId = actor.schoolId;
    const advancedAccess = await this.access.hasEntitlement(actor, 'dashboards.advanced.read');
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      this.prisma.student.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.class.count({ where: { schoolId } }),
    ]);

    // Kumulatif data affiliate di sekolah
    const latestSnapshots = advancedAccess ? await this.prisma.affiliateMetricSnapshot.findMany({
      where: {
        schoolId,
        verification: 'VERIFIED',
        corrections: { none: {} },
      },
      distinct: ['affiliateVideoId'],
      orderBy: [{ affiliateVideoId: 'asc' }, { snapshotDate: 'desc' }],
    }) : [];

    let totalViews = 0;
    let totalClicks = 0;
    let totalOrders = 0;
    let totalGmv = 0;
    let totalCommission = 0;

    latestSnapshots.forEach((s) => {
      totalViews += s.views;
      totalClicks += s.clicks;
      totalOrders += s.orders;
      totalGmv += Number(s.gmv);
      totalCommission += Number(s.commission);
    });

    return {
      stats: {
        totalStudents,
        totalTeachers,
        totalClasses,
      },
      performance: {
        totalViews,
        totalClicks,
        totalOrders,
        totalGmv,
        totalCommission,
      },
      advancedAccess,
    };
  }
}
