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
import { AssignmentsService, CreateAssignmentDto, UpdateAssignmentDto } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('assignments')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private service: AssignmentsService) {}

  @Get()
  @RequirePermissions({ resource: 'assignments', action: 'read' })
  async findAll(@Query() query: any, @Request() req: any) {
    const schoolId = this.requireSchool(req);
    const teacherId = req.user.roles?.includes('teacher') ? req.user.teacherId : undefined;
    return this.service.findAll({
      schoolId,
      teacherId,
      activeOnly: req.user.roles?.includes('student'),
      studentId: req.user.roles?.includes('student') ? req.user.studentId : undefined,
      courseId: typeof query.courseId === 'string' ? query.courseId : undefined,
      accessContext: this.accessContext(req),
    });
  }

  @Get(':id')
  @RequirePermissions({ resource: 'assignments', action: 'read' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const teacherId = req.user.roles?.includes('teacher') ? req.user.teacherId : undefined;
    return this.service.findOne(id, this.requireSchool(req), teacherId, req.user.roles?.includes('student'), this.accessContext(req));
  }

  @Post()
  @RequirePermissions({ resource: 'assignments', action: 'create' })
  async create(@Body() dto: CreateAssignmentDto, @Request() req: any) {
    if (!req.user.teacherId) {
      throw new ForbiddenException('Akun tidak memiliki profil guru yang valid');
    }
    return this.service.create(dto, this.requireSchool(req), req.user.teacherId, this.accessContext(req));
  }

  @Put(':id')
  @RequirePermissions({ resource: 'assignments', action: 'update' })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto, @Request() req: any) {
    return this.service.update(id, dto, this.requireSchool(req), req.user.teacherId, req.user.userId, this.accessContext(req));
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'assignments', action: 'delete' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, this.requireSchool(req), req.user.teacherId, req.user.userId, this.accessContext(req));
  }

  private requireSchool(req: any): string {
    if (!req.user.schoolId) {
      throw new ForbiddenException('Pilih konteks sekolah sebelum mengakses tugas');
    }
    return req.user.schoolId;
  }

  private accessContext(req: any) {
    return { organizationId: req.user.organizationId, schoolId: this.requireSchool(req), userId: req.user.userId, studentId: req.user.studentId };
  }
}
