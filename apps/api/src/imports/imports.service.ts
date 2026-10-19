import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../infrastructure/queue.service';
import { EncryptionService } from '../common/services/encryption.service';

export interface StudentImportRowInput {
  email: string;
  studentNumber: string;
  fullName: string;
  classCode?: string;
  nisn?: string;
}

export function prepareStudentImportPayload(row: StudentImportRowInput, encryption: EncryptionService) {
  const nisn = row.nisn?.trim();
  return {
    email: row.email.trim().toLowerCase(),
    studentNumber: row.studentNumber.trim(),
    fullName: row.fullName.trim(),
    ...(row.classCode?.trim() ? { classCode: row.classCode.trim() } : {}),
    ...(nisn
      ? {
          nisnEncrypted: encryption.encrypt(nisn),
          nisnLast4: nisn.slice(-4),
        }
      : {}),
  };
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly encryption: EncryptionService,
  ) {}

  async createStudentImport(sourceName: string, rows: StudentImportRowInput[], actor: any) {
    if (!actor.organizationId || !actor.schoolId) throw new BadRequestException('School context is required');
    if (rows.length < 1 || rows.length > 10_000) throw new BadRequestException('Import must contain 1-10,000 rows');

    const job = await this.prisma.importJob.create({
      data: {
        organizationId: actor.organizationId,
        schoolId: actor.schoolId,
        createdById: actor.userId,
        type: 'STUDENTS',
        sourceName: sourceName.slice(0, 255),
        totalRows: rows.length,
        rows: {
          create: rows.map((row, index) => ({
            rowNumber: index + 2,
            payload: prepareStudentImportPayload(row, this.encryption) as Prisma.InputJsonValue,
          })),
        },
      },
      select: { id: true, status: true, totalRows: true, sourceName: true, createdAt: true },
    });

    await this.queue.add(
      'student-import',
      'process',
      {
        organizationId: actor.organizationId,
        schoolId: actor.schoolId,
        requestedBy: actor.userId,
        payload: { importJobId: job.id },
      },
      { jobId: job.id },
    );
    return job;
  }

  list(actor: any) {
    return this.prisma.importJob.findMany({
      where: { organizationId: actor.organizationId, schoolId: actor.schoolId },
      select: {
        id: true,
        type: true,
        sourceName: true,
        status: true,
        totalRows: true,
        validRows: true,
        failedRows: true,
        processedRows: true,
        failureReason: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string, actor: any) {
    const job = await this.prisma.importJob.findFirst({
      where: { id, organizationId: actor.organizationId, schoolId: actor.schoolId },
      include: {
        rows: {
          where: { status: 'FAILED' },
          select: { rowNumber: true, status: true, payload: true, errors: true },
          orderBy: { rowNumber: 'asc' },
          take: 500,
        },
      },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return {
      ...job,
      rows: job.rows.map((row) => {
        const payload = row.payload as Record<string, unknown>;
        const { nisnEncrypted: _nisnEncrypted, ...safePayload } = payload;
        return { ...row, payload: safePayload };
      }),
    };
  }
}
