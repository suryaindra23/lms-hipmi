import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { MasterDataResource, MasterDataService } from './master-data.service';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantGuard } from '../common/guards/tenant.guard';

class UpdateTeacherDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(50) nip?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateParentDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class CreateEnrollmentDto {
  @IsString() studentId: string;
  @IsString() classId: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() semesterId?: string;
  @IsDateString() effectiveFrom: string;
}

class CreateTeacherAssignmentDto {
  @IsString() teacherId: string;
  @IsString() classId: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() @MaxLength(120) subject?: string;
  @IsDateString() effectiveFrom: string;
}

class LinkParentDto {
  @IsString() studentId: string;
  @IsString() parentId: string;
  @IsString() relationship: string;
}

class ListMasterDataDto {
  @IsOptional() @IsString() @MaxLength(120) query?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@Controller('master-data')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  getOverview(@Request() req: any) {
    if (!req.user.roles?.some((role: string) => ['super-admin', 'school-admin'].includes(role))) {
      throw new ForbiddenException('Master Data hanya dapat diakses administrator');
    }
    const schoolId = this.requireSchool(req);
    return this.service.getOverview(schoolId, req.user.organizationId);
  }

  @Get('lists/:resource')
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  list(
    @Param('resource') resource: MasterDataResource,
    @Query() query: ListMasterDataDto,
    @Request() req: any,
  ) {
    const schoolId = this.requireSchool(req);
    if (!['classes', 'students', 'teachers', 'parents'].includes(resource)) {
      throw new ForbiddenException('Jenis Master Data tidak didukung');
    }
    return this.service.list(resource, schoolId, query);
  }

  @Put('teachers/:id')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  updateTeacher(@Param('id') id: string, @Body() dto: UpdateTeacherDto, @Request() req: any) {
    return this.service.updateTeacher(id, this.requireSchool(req), dto);
  }

  @Delete('teachers/:id')
  @RequirePermissions({ resource: 'master-data', action: 'delete' })
  archiveTeacher(@Param('id') id: string, @Request() req: any) {
    return this.service.archiveTeacher(id, this.requireSchool(req));
  }

  @Put('parents/:id')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  updateParent(@Param('id') id: string, @Body() dto: UpdateParentDto, @Request() req: any) {
    return this.service.updateParent(id, this.requireSchool(req), dto);
  }

  @Delete('parents/:id')
  @RequirePermissions({ resource: 'master-data', action: 'delete' })
  archiveParent(@Param('id') id: string, @Request() req: any) {
    return this.service.archiveParent(id, this.requireSchool(req));
  }

  @Post('enrollments')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  enroll(@Body() dto: CreateEnrollmentDto, @Request() req: any) {
    return this.service.enrollStudent(this.requireSchool(req), dto);
  }

  @Post('teacher-assignments')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  assignTeacher(@Body() dto: CreateTeacherAssignmentDto, @Request() req: any) {
    return this.service.assignTeacher(this.requireSchool(req), dto);
  }

  @Post('parent-links')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  linkParent(@Body() dto: LinkParentDto, @Request() req: any) {
    return this.service.linkParent(this.requireSchool(req), dto, req.user.userId);
  }

  private requireSchool(req: any): string {
    const schoolId = req.tenant_context?.schoolId || req.user.schoolId;
    if (!schoolId) throw new ForbiddenException('Pilih konteks sekolah terlebih dahulu');
    return schoolId;
  }
}
