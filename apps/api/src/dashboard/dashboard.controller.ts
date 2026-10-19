import { Controller, ForbiddenException, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('student')
  @RequirePermissions({ resource: 'dashboard', action: 'read' })
  async getStudentDashboard(@Request() req: any) {
    if (!req.user.studentId) {
      throw new ForbiddenException('Akun tidak memiliki profil siswa yang valid');
    }
    return this.service.getStudentDashboard(req.user);
  }

  @Get('teacher')
  @RequirePermissions({ resource: 'dashboard', action: 'read' })
  async getTeacherDashboard(@Request() req: any) {
    if (!req.user.teacherId || !req.user.schoolId) {
      throw new ForbiddenException('Akun tidak memiliki konteks guru dan sekolah yang valid');
    }
    return this.service.getTeacherDashboard(req.user);
  }

  @Get('school')
  @RequirePermissions({ resource: 'dashboard', action: 'read' })
  async getSchoolDashboard(@Request() req: any) {
    if (!req.user.schoolId) {
      throw new ForbiddenException('Pilih konteks sekolah sebelum membuka dashboard');
    }
    return this.service.getSchoolDashboard(req.user);
  }
}
