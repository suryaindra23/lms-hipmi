import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicYear, Semester, Prisma } from '@prisma/client';

@Injectable()
export class AcademicYearsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string): Promise<AcademicYear[]> {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      include: { semesters: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string): Promise<AcademicYear> {
    const ay = await this.prisma.academicYear.findFirst({
      where: { id, schoolId },
      include: { semesters: true },
    });
    if (!ay) throw new NotFoundException('Academic year not found');
    return ay;
  }

  async create(schoolId: string, data: Prisma.AcademicYearCreateWithoutSchoolInput): Promise<AcademicYear> {
    // Validasi range tanggal
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }
    return this.prisma.academicYear.create({
      data: { ...data, schoolId },
    });
  }

  async activate(id: string, schoolId: string): Promise<AcademicYear> {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!academicYear) throw new NotFoundException('Academic year not found');

    // Nonaktifkan tahun ajaran aktif lainnya di sekolah tersebut
    return this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { schoolId, isActive: true },
        data: { isActive: false },
      });
      return tx.academicYear.update({
        where: { id: academicYear.id },
        data: { isActive: true },
      });
    });
  }

  // SEMESTERS

  async createSemester(
    academicYearId: string,
    schoolId: string,
    data: Prisma.SemesterCreateWithoutAcademicYearInput,
  ): Promise<Semester> {
    // Pastikan academic year milik sekolah yang benar
    const ay = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!ay) throw new NotFoundException('Academic year not found');

    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.prisma.semester.create({
      data: { ...data, academicYearId },
    });
  }
}
