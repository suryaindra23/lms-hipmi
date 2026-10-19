import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type MasterDataResource = 'classes' | 'students' | 'teachers' | 'parents';

export type MasterDataListOptions = {
  query?: string;
  status?: string;
  classId?: string;
  page: number;
  pageSize: number;
};

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(schoolId: string, organizationId?: string) {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, ...(organizationId ? { organizationId } : {}) },
      select: {
        id: true,
        code: true,
        npsn: true,
        name: true,
        level: true,
        status: true,
        city: true,
        province: true,
        principal: true,
        picName: true,
        picEmail: true,
        picPhone: true,
        isActive: true,
      },
    });

    if (!school) throw new NotFoundException('Sekolah tidak ditemukan dalam organisasi ini');
    if (!school.isActive) throw new ForbiddenException('Sekolah sedang tidak aktif');

    const [classes, students, teachers, parents, classCount, studentCount, teacherCount, parentCount] = await Promise.all([
      this.prisma.class.findMany({
        where: { schoolId },
        select: {
          id: true,
          code: true,
          name: true,
          grade: true,
          capacity: true,
          isActive: true,
          _count: { select: { students: true } },
        },
        orderBy: [{ grade: 'asc' }, { name: 'asc' }],
        take: 100,
      }),
      this.prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true,
          studentNumber: true,
          fullName: true,
          phone: true,
          status: true,
          class: { select: { id: true, name: true, code: true } },
          user: { select: { email: true, status: true } },
          _count: { select: { studentParents: true } },
        },
        orderBy: { fullName: 'asc' },
        take: 100,
      }),
      this.prisma.teacher.findMany({
        where: { schoolId },
        select: {
          id: true,
          nip: true,
          fullName: true,
          phone: true,
          isActive: true,
          user: { select: { email: true, status: true } },
          _count: { select: { materials: true, assignments: true } },
        },
        orderBy: { fullName: 'asc' },
        take: 100,
      }),
      this.prisma.parent.findMany({
        where: { studentParents: { some: { student: { schoolId }, revokedAt: null } } },
        select: {
          id: true,
          fullName: true,
          phone: true,
          isActive: true,
          user: { select: { email: true, status: true } },
          studentParents: {
            where: { student: { schoolId }, revokedAt: null },
            select: { student: { select: { id: true, fullName: true, studentNumber: true } } },
          },
        },
        orderBy: { fullName: 'asc' },
        take: 100,
      }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.student.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.parent.count({
        where: { studentParents: { some: { student: { schoolId }, revokedAt: null } } },
      }),
    ]);

    return {
      school,
      classes,
      students,
      teachers,
      parents,
      counts: {
        classes: classCount,
        students: studentCount,
        teachers: teacherCount,
        parents: parentCount,
      },
    };
  }

  async list(resource: MasterDataResource, schoolId: string, options: MasterDataListOptions) {
    const skip = (options.page - 1) * options.pageSize;
    const contains = options.query?.trim()
      ? { contains: options.query.trim(), mode: 'insensitive' as const }
      : undefined;
    let items: unknown[];
    let total: number;

    if (resource === 'classes') {
      const where = {
        schoolId,
        ...(contains ? { OR: [{ name: contains }, { code: contains }] } : {}),
        ...(options.status === 'active' ? { isActive: true } : {}),
        ...(options.status === 'inactive' ? { isActive: false } : {}),
      };
      [items, total] = await Promise.all([
        this.prisma.class.findMany({
          where,
          select: {
            id: true, code: true, name: true, grade: true, capacity: true, isActive: true,
            _count: { select: { students: true } },
          },
          orderBy: [{ grade: 'asc' }, { name: 'asc' }],
          skip,
          take: options.pageSize,
        }),
        this.prisma.class.count({ where }),
      ]);
    } else if (resource === 'students') {
      const studentStatus = Object.values(StudentStatus).includes(options.status as StudentStatus)
        ? options.status as StudentStatus
        : undefined;
      const where = {
        schoolId,
        ...(contains ? { OR: [{ fullName: contains }, { studentNumber: contains }, { user: { email: contains } }] } : {}),
        ...(studentStatus ? { status: studentStatus } : {}),
        ...(options.classId ? { classId: options.classId } : {}),
      };
      [items, total] = await Promise.all([
        this.prisma.student.findMany({
          where,
          select: {
            id: true, studentNumber: true, fullName: true, phone: true, status: true,
            class: { select: { id: true, name: true, code: true } },
            user: { select: { email: true, status: true } },
            _count: { select: { studentParents: true } },
          },
          orderBy: { fullName: 'asc' },
          skip,
          take: options.pageSize,
        }),
        this.prisma.student.count({ where }),
      ]);
    } else if (resource === 'teachers') {
      const where = {
        schoolId,
        ...(contains ? { OR: [{ fullName: contains }, { nip: contains }, { user: { email: contains } }] } : {}),
        ...(options.status === 'active' ? { isActive: true } : {}),
        ...(options.status === 'inactive' ? { isActive: false } : {}),
      };
      [items, total] = await Promise.all([
        this.prisma.teacher.findMany({
          where,
          select: {
            id: true, nip: true, fullName: true, phone: true, isActive: true,
            user: { select: { email: true, status: true } },
            _count: { select: { materials: true, assignments: true } },
          },
          orderBy: { fullName: 'asc' },
          skip,
          take: options.pageSize,
        }),
        this.prisma.teacher.count({ where }),
      ]);
    } else if (resource === 'parents') {
      const where = {
        studentParents: { some: { student: { schoolId }, revokedAt: null } },
        ...(contains ? { OR: [{ fullName: contains }, { phone: contains }, { user: { email: contains } }] } : {}),
        ...(options.status === 'active' ? { isActive: true } : {}),
        ...(options.status === 'inactive' ? { isActive: false } : {}),
      };
      [items, total] = await Promise.all([
        this.prisma.parent.findMany({
          where,
          select: {
            id: true, fullName: true, phone: true, isActive: true,
            user: { select: { email: true, status: true } },
            studentParents: {
              where: { student: { schoolId }, revokedAt: null },
              select: { student: { select: { id: true, fullName: true, studentNumber: true } } },
            },
          },
          orderBy: { fullName: 'asc' },
          skip,
          take: options.pageSize,
        }),
        this.prisma.parent.count({ where }),
      ]);
    } else {
      throw new BadRequestException('Jenis Master Data tidak didukung');
    }

    return {
      items,
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
    };
  }

  async updateTeacher(id: string, schoolId: string, data: { fullName?: string; nip?: string; phone?: string; isActive?: boolean }) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, schoolId } });
    if (!teacher) throw new NotFoundException('Guru tidak ditemukan di sekolah ini');
    return this.prisma.teacher.update({ where: { id }, data });
  }

  async archiveTeacher(id: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, schoolId } });
    if (!teacher) throw new NotFoundException('Guru tidak ditemukan di sekolah ini');
    await this.prisma.$transaction([
      this.prisma.teacher.update({ where: { id }, data: { isActive: false } }),
      this.prisma.teacherAssignment.updateMany({ where: { teacherId: id, schoolId, isActive: true }, data: { isActive: false, effectiveUntil: new Date() } }),
      this.prisma.user.update({ where: { id: teacher.userId }, data: { status: 'ARCHIVED' } }),
    ]);
    return { id, status: 'ARCHIVED' };
  }

  async updateParent(id: string, schoolId: string, data: { fullName?: string; phone?: string; isActive?: boolean }) {
    const parent = await this.findParentInSchool(id, schoolId);
    return this.prisma.parent.update({ where: { id: parent.id }, data });
  }

  async archiveParent(id: string, schoolId: string) {
    const parent = await this.findParentInSchool(id, schoolId);
    const remainingActiveLinks = await this.prisma.$transaction(async (tx) => {
      await tx.studentParent.updateMany({
        where: { parentId: id, student: { schoolId }, revokedAt: null },
        data: { verificationStatus: 'REVOKED', revokedAt: new Date() },
      });
      const remaining = await tx.studentParent.count({ where: { parentId: id, revokedAt: null } });
      if (remaining === 0) {
        await tx.parent.update({ where: { id }, data: { isActive: false } });
        await tx.user.update({ where: { id: parent.userId }, data: { status: 'ARCHIVED' } });
      }
      return remaining;
    });
    return { id, status: remainingActiveLinks === 0 ? 'ARCHIVED' : 'REVOKED_IN_SCHOOL' };
  }

  async enrollStudent(schoolId: string, data: { studentId: string; classId: string; academicYearId?: string; semesterId?: string; effectiveFrom: string }) {
    const [student, targetClass] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: data.studentId, schoolId } }),
      this.prisma.class.findFirst({ where: { id: data.classId, schoolId, isActive: true } }),
    ]);
    if (!student || !targetClass) throw new NotFoundException('Siswa atau kelas tidak ditemukan dalam sekolah ini');
    if (data.academicYearId) {
      const validYear = await this.prisma.academicYear.count({ where: { id: data.academicYearId, schoolId } });
      if (!validYear) throw new NotFoundException('Tahun ajaran tidak ditemukan dalam sekolah ini');
    }
    if (data.semesterId) {
      const validSemester = await this.prisma.semester.count({
        where: { id: data.semesterId, academicYear: { schoolId } },
      });
      if (!validSemester) throw new NotFoundException('Semester tidak ditemukan dalam sekolah ini');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.classEnrollment.updateMany({
        where: { studentId: student.id, schoolId, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED', effectiveUntil: new Date(data.effectiveFrom) },
      });
      await tx.student.update({ where: { id: student.id }, data: { classId: targetClass.id } });
      return tx.classEnrollment.create({
        data: {
          studentId: student.id,
          classId: targetClass.id,
          schoolId,
          academicYearId: data.academicYearId,
          semesterId: data.semesterId,
          effectiveFrom: new Date(data.effectiveFrom),
        },
      });
    });
  }

  async assignTeacher(schoolId: string, data: { teacherId: string; classId: string; courseId?: string; subject?: string; effectiveFrom: string }) {
    const [teacher, targetClass, course] = await Promise.all([
      this.prisma.teacher.findFirst({ where: { id: data.teacherId, schoolId, isActive: true } }),
      this.prisma.class.findFirst({ where: { id: data.classId, schoolId, isActive: true } }),
      data.courseId ? this.prisma.course.findFirst({ where: { id: data.courseId, schoolId, isActive: true } }) : Promise.resolve(null),
    ]);
    if (!teacher || !targetClass || (data.courseId && !course)) throw new NotFoundException('Guru, kelas, atau course tidak ditemukan dalam sekolah ini');
    return this.prisma.teacherAssignment.create({
      data: {
        teacherId: teacher.id,
        classId: targetClass.id,
        schoolId,
        courseId: course?.id,
        subject: data.subject,
        effectiveFrom: new Date(data.effectiveFrom),
      },
    });
  }

  async linkParent(schoolId: string, data: { studentId: string; parentId: string; relationship: string }, verifierId: string) {
    const [student, parent] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: data.studentId, schoolId } }),
      this.findParentInSchool(data.parentId, schoolId),
    ]);
    if (!student || !parent) throw new NotFoundException('Siswa atau orang tua tidak ditemukan dalam sekolah ini');
    return this.prisma.studentParent.upsert({
      where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
      update: { relationship: data.relationship, verificationStatus: 'VERIFIED', verifiedAt: new Date(), verifiedBy: verifierId, revokedAt: null },
      create: { studentId: student.id, parentId: parent.id, relationship: data.relationship, verificationStatus: 'VERIFIED', verifiedAt: new Date(), verifiedBy: verifierId },
    });
  }

  private async findParentInSchool(id: string, schoolId: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, user: { userRoles: { some: { schoolId } } } },
    });
    if (!parent) throw new NotFoundException('Orang tua tidak ditemukan dalam sekolah ini');
    return parent;
  }
}
