import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { LearningService } from './learning.service';

export class CreateMaterialDto {
  @IsString() courseId: string;
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(5000) content?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) fileUrl?: string;
  @IsIn(['DOC', 'VIDEO', 'LINK', 'TEXT']) type: string;
  @IsString() lessonId: string;
}

export class CreateProgramDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(3) @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class CreateCourseDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(3) @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() programId?: string;
}

export class CreateModuleDto {
  @IsString() @MinLength(3) @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(1) position?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class CreateLessonDto {
  @IsString() @MinLength(3) @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsInt() @Min(1) position?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1440) estimatedMinutes?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class EnrollClassDto {
  @IsString() courseId: string;
  @IsString() classId: string;
}

export class UpdateProgressDto {
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']) state: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  @IsInt() @Min(0) @Max(100) progressPercent: number;
  @IsOptional() @IsInt() @Min(0) lastPosition?: number;
  @IsOptional() @IsString() materialId?: string;
}

@Controller('learning')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class LearningController {
  constructor(private readonly service: LearningService) {}

  @Get('courses')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  getCourses(@Request() req: any) {
    return this.service.getCourses(this.requireSchool(req), req.user.studentId);
  }

  @Get('tree')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  getTree(@Request() req: any) {
    return this.service.getLearningTree(
      this.requireSchool(req),
      req.user.studentId,
      req.user.studentId ? this.accessContext(req) : undefined,
    );
  }

  @Get('programs')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  getPrograms(@Request() req: any) {
    return this.service.getPrograms(this.requireSchool(req));
  }

  @Get('classes')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  getClasses(@Request() req: any) {
    return this.service.getClasses(this.requireSchool(req));
  }

  @Post('programs')
  @RequirePermissions({ resource: 'materials', action: 'create' })
  createProgram(@Body() dto: CreateProgramDto, @Request() req: any) {
    return this.service.createProgram(this.requireSchool(req), req.user.organizationId, req.user.userId, dto);
  }

  @Post('courses')
  @RequirePermissions({ resource: 'materials', action: 'create' })
  createCourse(@Body() dto: CreateCourseDto, @Request() req: any) {
    return this.service.createCourse(this.requireSchool(req), req.user.organizationId, dto);
  }

  @Post('courses/:id/modules')
  @RequirePermissions({ resource: 'materials', action: 'create' })
  createModule(@Param('id') id: string, @Body() dto: CreateModuleDto, @Request() req: any) {
    return this.service.createModule(id, this.requireSchool(req), req.user.userId, dto);
  }

  @Post('modules/:id/lessons')
  @RequirePermissions({ resource: 'materials', action: 'create' })
  createLesson(@Param('id') id: string, @Body() dto: CreateLessonDto, @Request() req: any) {
    return this.service.createLesson(id, this.requireSchool(req), req.user.userId, dto);
  }

  @Post('enrollments/class')
  @RequirePermissions({ resource: 'materials', action: 'create' })
  enrollClass(@Body() dto: EnrollClassDto, @Request() req: any) {
    return this.service.enrollClass(this.requireSchool(req), dto);
  }

  @Put('lessons/:id/progress')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto, @Request() req: any) {
    if (!req.user.studentId) throw new ForbiddenException('Hanya siswa yang dapat memperbarui progres belajar');
    return this.service.updateProgress(
      id,
      this.requireSchool(req),
      req.user.studentId,
      dto,
      this.accessContext(req),
    );
  }

  @Get('materials')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  getMaterials(@Request() req: any, @Query('courseId') courseId?: string) {
    const teacherId = req.user.roles?.includes('teacher') ? req.user.teacherId : undefined;
    return this.service.getMaterials(
      this.requireSchool(req),
      teacherId,
      req.user.studentId,
      courseId,
      req.user.studentId ? this.accessContext(req) : undefined,
    );
  }

  @Get('materials/:id/access')
  @RequirePermissions({ resource: 'materials', action: 'read' })
  getMaterialAccess(@Param('id') id: string, @Request() req: any) {
    return this.service.getMaterialFileAccess(
      id,
      this.requireSchool(req),
      req.user.teacherId,
      req.user.studentId,
      req.user.studentId ? this.accessContext(req) : undefined,
    );
  }

  @Post('materials')
  @RequirePermissions({ resource: 'materials', action: 'create' })
  createMaterial(@Request() req: any, @Body() dto: CreateMaterialDto) {
    if (!req.user.teacherId) {
      throw new ForbiddenException('Akun tidak memiliki profil guru yang valid');
    }
    return this.service.createMaterial(this.requireSchool(req), req.user.teacherId, dto);
  }

  private requireSchool(req: any): string {
    if (!req.user.schoolId) {
      throw new ForbiddenException('Pilih konteks sekolah sebelum mengakses pembelajaran');
    }
    return req.user.schoolId;
  }

  private accessContext(req: any) {
    if (!req.user.organizationId) throw new ForbiddenException('Konteks organisasi diperlukan');
    return {
      organizationId: req.user.organizationId,
      schoolId: this.requireSchool(req),
      userId: req.user.userId,
      studentId: req.user.studentId,
    };
  }
}
