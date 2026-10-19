import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { School, Prisma, SchoolStatus } from '@prisma/client';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateSchoolDto {
  @IsString() organizationId: string;
  @IsString() name: string;
  @IsString() code: string;
  @IsString() level: string;
  @IsOptional() @IsString() npsn?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() principal?: string;
  @IsOptional() @IsString() picName?: string;
  @IsOptional() @IsString() picPhone?: string;
  @IsOptional() @IsString() picEmail?: string;
}

export class UpdateSchoolDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() principal?: string;
  @IsOptional() @IsString() picName?: string;
  @IsOptional() @IsString() picPhone?: string;
  @IsOptional() @IsString() picEmail?: string;
  @IsOptional() @IsEnum(SchoolStatus) status?: SchoolStatus;
}

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  /** Selalu filter by organizationId untuk tenant isolation */
  async findAll(organizationId: string): Promise<School[]> {
    return this.prisma.school.findMany({
      where: { organizationId },
      include: {
        _count: { select: { students: true, teachers: true, classes: true } },
      },
    });
  }

  async findOne(id: string, organizationId: string): Promise<School> {
    const school = await this.prisma.school.findFirst({
      where: { id, organizationId },
      include: {
        classes: { select: { id: true, name: true, code: true } },
        departments: { select: { id: true, name: true, code: true } },
        _count: { select: { students: true, teachers: true, classes: true } },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async create(dto: CreateSchoolDto): Promise<School> {
    return this.prisma.school.create({
      data: {
        ...dto,
        status: 'DRAFT',
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateSchoolDto): Promise<School> {
    // Verify school belongs to organization
    const school = await this.prisma.school.findFirst({
      where: { id, organizationId },
    });
    if (!school) throw new NotFoundException('School not found');

    return this.prisma.school.update({ where: { id }, data: dto });
  }
}
