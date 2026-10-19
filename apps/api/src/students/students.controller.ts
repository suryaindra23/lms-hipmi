import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { IsString, IsOptional, IsInt, Min, Max, IsEnum, MaxLength, MinLength, Matches, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { StudentStatus } from '@prisma/client';

export class QueryStudentsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
}

class CreateStudentRequestDto {
  @IsString() @MinLength(1) userId: string;
  @IsString() @MinLength(1) @MaxLength(50) studentNumber: string;
  @IsOptional() @Matches(/^\d{10}$/) nisn?: string;
  @IsString() @MinLength(1) @MaxLength(200) fullName: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() @MaxLength(120) birthPlace?: string;
  @IsOptional() @Type(() => Date) @IsDate() birthDate?: Date;
  @IsOptional() @IsString() @MaxLength(30) gender?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) socialMedia?: string;
  @IsOptional() @IsString() @MaxLength(255) affiliateAccount?: string;
  @IsOptional() @IsString() @MaxLength(500) photo?: string;
}

class UpdateStudentRequestDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) studentNumber?: string;
  @IsOptional() @Matches(/^\d{10}$/) nisn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() @MaxLength(120) birthPlace?: string;
  @IsOptional() @Type(() => Date) @IsDate() birthDate?: Date;
  @IsOptional() @IsString() @MaxLength(30) gender?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) socialMedia?: string;
  @IsOptional() @IsString() @MaxLength(255) affiliateAccount?: string;
  @IsOptional() @IsString() @MaxLength(500) photo?: string;
}

@Controller('students')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class StudentsController {
  constructor(private service: StudentsService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  async findAll(@Query() query: QueryStudentsDto, @Request() req: any) {
    const { skip, take, search, classId, status } = query;
    const schoolId = this.requireSchool(req);

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { studentNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (classId) where.classId = classId;
    if (status) where.status = status;

    return this.service.findAll({
      schoolId,
      skip: skip || 0,
      take: take || 50,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const schoolId = this.requireSchool(req);
    return this.service.findOne(id, schoolId);
  }

  @Post()
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  async create(@Body() dto: CreateStudentRequestDto, @Request() req: any) {
    const schoolId = this.requireSchool(req);
    return this.service.create({ ...dto, schoolId });
  }

  @Put(':id')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  async update(@Param('id') id: string, @Body() dto: UpdateStudentRequestDto, @Request() req: any) {
    const schoolId = this.requireSchool(req);
    return this.service.update(id, schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'master-data', action: 'delete' })
  async delete(@Param('id') id: string, @Request() req: any) {
    const schoolId = this.requireSchool(req);
    return this.service.delete(id, schoolId);
  }

  private requireSchool(req: any): string {
    const schoolId = req.tenant_context?.schoolId || req.user.schoolId;
    if (!schoolId) throw new ForbiddenException('Pilih konteks sekolah terlebih dahulu');
    return schoolId;
  }

}
