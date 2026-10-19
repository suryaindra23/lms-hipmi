import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import {
  CreateExportDto,
  CreatePublicStatisticDto,
  EarlyWarningQueryDto,
  MonitoringQueryDto,
  ReviewPublicStatisticDto,
  UpdateEarlyWarningDto,
} from './dto/monitoring.dto';
import { MonitoringContext, MonitoringService } from './monitoring.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MonitoringController {
  constructor(private readonly service: MonitoringService) {}

  @Get('overview')
  @RequirePermissions({ resource: 'monitoring', action: 'read' })
  getOverview(@Request() req: any, @Query() query: MonitoringQueryDto) {
    return this.service.getOverview(this.context(req), query);
  }

  @Get('students/:id/learning-progress')
  @RequirePermissions({ resource: 'monitoring', action: 'read' })
  getStudentLearningProgress(@Request() req: any, @Param('id') id: string) {
    return this.service.getStudentLearningProgress(this.context(req), id);
  }

  @Get('early-warnings')
  @RequirePermissions({ resource: 'monitoring', action: 'read' })
  listEarlyWarnings(@Request() req: any, @Query() query: EarlyWarningQueryDto) {
    return this.service.listEarlyWarnings(this.context(req), query);
  }

  @Post('early-warnings/evaluate')
  @RequirePermissions({ resource: 'monitoring', action: 'manage' })
  evaluateEarlyWarnings(@Request() req: any, @Body() query: MonitoringQueryDto) {
    return this.service.evaluateEarlyWarnings(this.context(req), query);
  }

  @Patch('early-warnings/:id')
  @RequirePermissions({ resource: 'monitoring', action: 'manage' })
  updateEarlyWarning(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateEarlyWarningDto) {
    return this.service.updateEarlyWarning(this.context(req), id, dto);
  }

  @Get('reports/options')
  @RequirePermissions({ resource: 'reports', action: 'read' })
  getReportOptions(@Request() req: any) {
    return this.service.getReportOptions(this.context(req));
  }

  @Post('exports')
  @RequirePermissions({ resource: 'reports', action: 'export' })
  createExport(@Request() req: any, @Body() dto: CreateExportDto) {
    return this.service.createExport(this.context(req), dto);
  }

  @Get('exports')
  @RequirePermissions({ resource: 'reports', action: 'read' })
  listExports(@Request() req: any) {
    return this.service.listExports(this.context(req));
  }

  @Get('exports/:id/download')
  @RequirePermissions({ resource: 'reports', action: 'read' })
  getExportDownload(@Request() req: any, @Param('id') id: string) {
    return this.service.getExportDownload(this.context(req), id);
  }

  @Post('public-statistics')
  @RequirePermissions({ resource: 'public-statistics', action: 'approve' })
  createPublicStatistic(@Request() req: any, @Body() dto: CreatePublicStatisticDto) {
    return this.service.createPublicStatistic(this.context(req), dto);
  }

  @Get('public-statistics')
  @RequirePermissions({ resource: 'public-statistics', action: 'approve' })
  listPublicStatistics(@Request() req: any) {
    return this.service.listPublicStatistics(this.context(req));
  }

  @Post('public-statistics/:id/review')
  @RequirePermissions({ resource: 'public-statistics', action: 'approve' })
  reviewPublicStatistic(@Request() req: any, @Param('id') id: string, @Body() dto: ReviewPublicStatisticDto) {
    return this.service.reviewPublicStatistic(this.context(req), id, dto);
  }

  private context(req: any): MonitoringContext {
    return {
      userId: req.user.userId,
      organizationId: req.user.organizationId,
      schoolId: req.user.schoolId,
      studentId: req.user.studentId,
      parentId: req.user.parentId,
      teacherId: req.user.teacherId,
      roles: req.user.roles || [],
    };
  }
}

@Controller('public/statistics')
export class PublicStatisticsController {
  constructor(private readonly service: MonitoringService) {}

  @Get()
  list() {
    return this.service.getPublishedStatistics();
  }
}
