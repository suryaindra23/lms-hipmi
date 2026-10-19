import { Body, Controller, Get, Param, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { csvCell } from '../common/utils/security.utils';
import {
  AffiliateService,
  CreateAffiliateAccountDto,
  CreateAffiliateMetricImportDto,
  CreateSnapshotDto,
  ResolveAffiliateFlagDto,
  ReviewAffiliateAccountDto,
  SaveAffiliateContentDto,
  VerifyMetricDto,
} from './affiliate.service';

@Controller('affiliate')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AffiliateController {
  constructor(private readonly service: AffiliateService) {}

  @Get('providers')
  @RequirePermissions({ resource: 'affiliate', action: 'read' })
  providers(@Request() req: any) {
    return this.service.getProviders(req.user);
  }

  @Get('workspace')
  @RequirePermissions({ resource: 'affiliate', action: 'read' })
  workspace(@Request() req: any) {
    return this.service.getWorkspace(req.user);
  }

  @Get('accounts')
  @RequirePermissions({ resource: 'affiliate', action: 'read' })
  accounts(@Query('studentId') studentId: string | undefined, @Request() req: any) {
    return this.service.listAccounts(req.user, studentId);
  }

  @Post('accounts')
  @RequirePermissions({ resource: 'affiliate', action: 'create' })
  createAccount(@Body() dto: CreateAffiliateAccountDto, @Request() req: any) {
    return this.service.createAccount(dto, req.user);
  }

  @Post('accounts/:id/review')
  @RequirePermissions({ resource: 'affiliate', action: 'verify' })
  reviewAccount(@Param('id') id: string, @Body() dto: ReviewAffiliateAccountDto, @Request() req: any) {
    return this.service.reviewAccount(id, dto, req.user);
  }

  @Post('content')
  @RequirePermissions({ resource: 'affiliate', action: 'create' })
  saveContent(@Body() dto: SaveAffiliateContentDto, @Request() req: any) {
    return this.service.saveContent(dto, req.user);
  }

  @Post('videos/:videoId/snapshots')
  @RequirePermissions({ resource: 'affiliate', action: 'create' })
  createSnapshot(@Param('videoId') videoId: string, @Body() dto: CreateSnapshotDto, @Request() req: any) {
    return this.service.createSnapshot(videoId, dto, req.user);
  }

  @Get('students/:studentId/performance')
  @RequirePermissions({ resource: 'affiliate', action: 'read' })
  getStudentPerformance(@Param('studentId') studentId: string, @Request() req: any) {
    const effectiveStudentId = req.user.roles?.includes('student') ? req.user.studentId : studentId;
    return this.service.getStudentPerformance(effectiveStudentId, req.user.schoolId, req.user);
  }

  @Get('my-performance')
  @RequirePermissions({ resource: 'affiliate', action: 'read' })
  getMyPerformance(@Request() req: any) {
    return this.service.getStudentPerformance(req.user.studentId, req.user.schoolId, req.user);
  }

  @Get('verification-queue')
  @RequirePermissions({ resource: 'affiliate', action: 'verify' })
  verificationQueue(@Request() req: any) {
    return this.service.getVerificationQueue(req.user);
  }

  @Post('metrics/:id/verify')
  @RequirePermissions({ resource: 'affiliate', action: 'verify' })
  verifyMetric(@Param('id') id: string, @Body() dto: VerifyMetricDto, @Request() req: any) {
    return this.service.verifyMetric(id, dto, req.user);
  }

  @Post('flags/:id/resolve')
  @RequirePermissions({ resource: 'affiliate', action: 'verify' })
  resolveFlag(@Param('id') id: string, @Body() dto: ResolveAffiliateFlagDto, @Request() req: any) {
    return this.service.resolveFlag(id, dto, req.user);
  }

  @Post('metric-imports')
  @RequirePermissions({ resource: 'affiliate', action: 'import' })
  createMetricImport(@Body() dto: CreateAffiliateMetricImportDto, @Request() req: any) {
    return this.service.createMetricImport(dto, req.user);
  }

  @Get('metric-imports')
  @RequirePermissions({ resource: 'affiliate', action: 'import' })
  metricImports(@Request() req: any) {
    return this.service.listMetricImports(req.user);
  }

  @Get('export')
  @RequirePermissions({ resource: 'affiliate', action: 'read' })
  async exportPerformance(@Request() req: any, @Res() res: Response) {
    const data = await this.service.getExportData(req.user);
    const headers = ['Nomor Induk', 'Nama Lengkap', 'Kelas', 'Total Video', 'Views', 'Clicks', 'Orders', 'GMV (Rupiah)', 'Komisi (Rupiah)', 'CTR', 'Conversion Rate'].join(',');
    const rows = data.map((row) => [
      csvCell(row.studentNumber), csvCell(row.fullName), csvCell(row.className), row.totalVideos,
      row.views, row.clicks, row.orders, row.gmv, row.commission, csvCell(row.ctr), csvCell(row.conversionRate),
    ].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan-performa-affiliate.csv');
    return res.status(200).send([headers, ...rows].join('\n'));
  }
}
