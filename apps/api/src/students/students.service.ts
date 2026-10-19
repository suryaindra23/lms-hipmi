import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Student, Prisma, StudentStatus } from '@prisma/client';
import { AuthService } from '../auth/auth.service'; // Import AuthService
import { EncryptionService } from '../common/services/encryption.service';
import { randomBytes } from 'crypto';

export interface CreateStudentDto {
  userId: string; // Make userId required
  schoolId: string;
  classId?: string;
  studentNumber: string;
  nisn?: string;
  fullName: string;
  birthPlace?: string;
  birthDate?: Date;
  gender?: string;
  address?: string;
  phone?: string;
  socialMedia?: string;
  affiliateAccount?: string;
  photo?: string;
}

export interface ImportStudentRow extends CreateStudentDto {
  email: string;
  password?: string;
}

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService, // Inject AuthService
    private encryption: EncryptionService,
  ) {}

  async findAll(params: {
    schoolId: string;
    skip?: number;
    take?: number;
    where?: Prisma.StudentWhereInput;
    orderBy?: Prisma.StudentOrderByWithRelationInput;
  }): Promise<{ data: Student[]; total: number }> {
    const { schoolId, skip = 0, take = 50, where, orderBy } = params;

    const combinedWhere: Prisma.StudentWhereInput = {
      ...where,
      schoolId,
    };

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where: combinedWhere,
        skip,
        take,
        orderBy,
        include: {
          user: { select: { email: true, status: true } },
          class: { select: { name: true, code: true } },
        },
      }),
      this.prisma.student.count({ where: combinedWhere }),
    ]);

    return { data, total };
  }

  async findOne(id: string, schoolId: string): Promise<Student> {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        user: { select: { id: true, email: true, username: true, firstName: true, lastName: true, phone: true, status: true, emailVerified: true, lastLoginAt: true } },
        class: true,
        school: true,
        studentParents: {
          include: {
            parent: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async create(dto: CreateStudentDto): Promise<Student> {
    const school = await this.prisma.school.findFirst({
      where: { id: dto.schoolId, isActive: true },
      select: { organizationId: true },
    });
    if (!school) throw new NotFoundException('School not found');
    const [user, targetClass] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: dto.userId, organizationId: school.organizationId },
        select: { id: true },
      }),
      dto.classId
        ? this.prisma.class.findFirst({ where: { id: dto.classId, schoolId: dto.schoolId, isActive: true }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (!user) throw new NotFoundException('User not found in this organization');
    if (dto.classId && !targetClass) throw new NotFoundException('Class not found in this school');

    // Validasi NISN unique
    if (dto.nisn) {
      const existing = await this.prisma.studentIdentifier.findUnique({
        where: { type_blindIndex: { type: 'NISN', blindIndex: this.encryption.blindIndex(dto.nisn, 'NISN') } },
      });
      if (existing) {
        throw new BadRequestException('NISN already exists');
      }
    }

    // Validasi student number unique per school
    const existingNumber = await this.prisma.student.findUnique({
      where: {
        schoolId_studentNumber: {
          schoolId: dto.schoolId,
          studentNumber: dto.studentNumber,
        },
      },
    });
    if (existingNumber) {
      throw new BadRequestException('Student number already exists in this school');
    }

    // Prisma.StudentCreateInput expects userId to be string
    // Assuming userId is always provided and valid by this point
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({ data: {
        userId: dto.userId, // userId is now required in CreateStudentDto
        schoolId: dto.schoolId,
        classId: dto.classId,
        studentNumber: dto.studentNumber,
        fullName: dto.fullName,
        birthPlace: dto.birthPlace,
        birthDate: dto.birthDate,
        gender: dto.gender,
        address: dto.address,
        phone: dto.phone,
        socialMedia: dto.socialMedia,
        affiliateAccount: dto.affiliateAccount,
        photo: dto.photo,
        status: 'DRAFT',
      } });
      if (dto.nisn) {
        await tx.studentIdentifier.create({ data: {
          studentId: student.id,
          type: 'NISN',
          valueEncrypted: this.encryption.encrypt(dto.nisn),
          blindIndex: this.encryption.blindIndex(dto.nisn, 'NISN'),
          last4: dto.nisn.slice(-4),
        } });
      }
      return student;
    });
  }

  async update(id: string, schoolId: string, dto: Partial<CreateStudentDto>): Promise<Student> {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (dto.classId) {
      const targetClass = await this.prisma.class.count({ where: { id: dto.classId, schoolId, isActive: true } });
      if (!targetClass) throw new NotFoundException('Class not found in this school');
    }

    const { schoolId: _schoolId, userId: _userId, nisn, ...safeData } = dto;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({ where: { id }, data: safeData });
      if (nisn) {
        await tx.studentIdentifier.upsert({
          where: { studentId_type: { studentId: id, type: 'NISN' } },
          update: { valueEncrypted: this.encryption.encrypt(nisn), blindIndex: this.encryption.blindIndex(nisn, 'NISN'), last4: nisn.slice(-4), status: 'NEEDS_REVIEW' },
          create: { studentId: id, type: 'NISN', valueEncrypted: this.encryption.encrypt(nisn), blindIndex: this.encryption.blindIndex(nisn, 'NISN'), last4: nisn.slice(-4), status: 'NEEDS_REVIEW' },
        });
      }
      return updated;
    });
  }

  async delete(id: string, schoolId: string): Promise<Student> {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const [archived] = await this.prisma.$transaction([
      this.prisma.student.update({ where: { id }, data: { status: 'INACTIVE' } }),
      this.prisma.classEnrollment.updateMany({ where: { studentId: id, schoolId, status: 'ACTIVE' }, data: { status: 'ARCHIVED', effectiveUntil: new Date() } }),
      this.prisma.user.update({ where: { id: student.userId }, data: { status: 'ARCHIVED' } }),
    ]);
    return archived;
  }

  /**
   * Bulk create students dari import (akan dipanggil oleh queue worker)
   */
  async bulkCreate(students: ImportStudentRow[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const studentData of students) {
      try {
        // Get organizationId from schoolId
        const school = await this.prisma.school.findUnique({
          where: { id: studentData.schoolId },
          select: { organizationId: true },
        });

        if (!school) {
          console.error(`School not found for id: ${studentData.schoolId}`);
          failed++;
          continue;
        }

        // Hash password
        const passwordHash = studentData.password
          ? await this.authService.hashPassword(studentData.password)
          : await this.authService.hashPassword(this.generateRandomPassword()); // Generate random password

        // Create user first
        const user = await this.prisma.user.create({
          data: {
            email: studentData.email,
            passwordHash: passwordHash,
            firstName: studentData.fullName.split(' ')[0],
            lastName: studentData.fullName.split(' ').slice(1).join(' ') || '-',
            organizationId: school.organizationId, // Set organizationId based on school
            status: 'PENDING_ACTIVATION',
          },
        });

        // Create student
        const student = await this.prisma.student.create({ data: {
            userId: user.id,
            schoolId: studentData.schoolId,
            classId: studentData.classId,
            studentNumber: studentData.studentNumber,
            fullName: studentData.fullName,
            birthPlace: studentData.birthPlace,
            birthDate: studentData.birthDate,
            gender: studentData.gender,
            address: studentData.address,
            phone: studentData.phone,
            socialMedia: studentData.socialMedia,
            affiliateAccount: studentData.affiliateAccount,
            status: 'DRAFT',
          } });
        if (studentData.nisn) {
          await this.prisma.studentIdentifier.create({ data: {
            studentId: student.id,
            type: 'NISN',
            valueEncrypted: this.encryption.encrypt(studentData.nisn),
            blindIndex: this.encryption.blindIndex(studentData.nisn, 'NISN'),
            last4: studentData.nisn.slice(-4),
          } });
        }

        success++;
      } catch (error) {
        console.error(`Failed to create student ${studentData.email}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  // Helper function to generate a random password
  private generateRandomPassword(): string {
    return randomBytes(24).toString('base64url');
  }
}
