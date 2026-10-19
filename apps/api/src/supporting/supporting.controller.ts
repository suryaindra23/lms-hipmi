import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { RateLimit } from '../common/guards/rate-limit.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import {
  AddHelpdeskMessageDto,
  CompleteHelpdeskAttachmentDto,
  AnalyticsEventDto,
  AwardAchievementDto,
  CertificatePublicationDto,
  CreateAchievementDto,
  CreateAnnouncementDto,
  CreateCertificateTemplateDto,
  CreateCmsContentDto,
  CreateHelpdeskTicketDto,
  CreatePortfolioItemDto,
  IssueCertificateDto,
  HelpdeskAttachmentUploadDto,
  PortfolioPublicationDto,
  RevokeCertificateDto,
  SyncDraftDto,
  UpdateHelpdeskTicketDto,
  UpdateNotificationPreferenceDto,
} from './dto/supporting.dto';
import { SupportingContext, SupportingService } from './supporting.service';

@Controller('support')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SupportingController {
  constructor(private readonly service: SupportingService) {}

  @Get('notifications')
  @RequirePermissions({ resource: 'notifications', action: 'read' })
  notifications(@Request() req: any) { return this.service.listNotifications(this.context(req)); }

  @Patch('notifications/:id/read')
  @RequirePermissions({ resource: 'notifications', action: 'update' })
  readNotification(@Request() req: any, @Param('id') id: string) { return this.service.markNotification(this.context(req), id); }

  @Patch('notifications/:id/archive')
  @RequirePermissions({ resource: 'notifications', action: 'update' })
  archiveNotification(@Request() req: any, @Param('id') id: string) { return this.service.markNotification(this.context(req), id, true); }

  @Post('notifications/read-all')
  @RequirePermissions({ resource: 'notifications', action: 'update' })
  readAllNotifications(@Request() req: any) { return this.service.markAllNotificationsRead(this.context(req)); }

  @Get('notification-preferences')
  @RequirePermissions({ resource: 'notifications', action: 'read' })
  preference(@Request() req: any) { return this.service.getNotificationPreference(this.context(req)); }

  @Put('notification-preferences')
  @RequirePermissions({ resource: 'notifications', action: 'update' })
  updatePreference(@Request() req: any, @Body() dto: UpdateNotificationPreferenceDto) { return this.service.updateNotificationPreference(this.context(req), dto); }

  @Get('announcements')
  @RequirePermissions({ resource: 'announcements', action: 'read' })
  announcements(@Request() req: any) { return this.service.listAnnouncements(this.context(req)); }

  @Get('announcements/manage')
  @RequirePermissions({ resource: 'announcements', action: 'manage' })
  managedAnnouncements(@Request() req: any) { return this.service.listManagedAnnouncements(this.context(req)); }

  @Post('announcements')
  @RequirePermissions({ resource: 'announcements', action: 'manage' })
  createAnnouncement(@Request() req: any, @Body() dto: CreateAnnouncementDto) { return this.service.createAnnouncement(this.context(req), dto); }

  @Post('announcements/:id/publish')
  @RequirePermissions({ resource: 'announcements', action: 'manage' })
  publishAnnouncement(@Request() req: any, @Param('id') id: string) { return this.service.publishAnnouncement(this.context(req), id); }

  @Get('certificate-templates')
  @RequirePermissions({ resource: 'certificates', action: 'read' })
  templates(@Request() req: any) { return this.service.listCertificateTemplates(this.context(req)); }

  @Post('certificate-templates')
  @RequirePermissions({ resource: 'certificates', action: 'manage' })
  createTemplate(@Request() req: any, @Body() dto: CreateCertificateTemplateDto) { return this.service.createCertificateTemplate(this.context(req), dto); }

  @Get('certificates')
  @RequirePermissions({ resource: 'certificates', action: 'read' })
  certificates(@Request() req: any) { return this.service.listCertificates(this.context(req)); }

  @Post('certificates')
  @RequirePermissions({ resource: 'certificates', action: 'manage' })
  issueCertificate(@Request() req: any, @Body() dto: IssueCertificateDto) { return this.service.issueCertificate(this.context(req), dto); }

  @Patch('certificates/:id/publication')
  @RequirePermissions({ resource: 'certificates', action: 'update' })
  certificatePublication(@Request() req: any, @Param('id') id: string, @Body() dto: CertificatePublicationDto) { return this.service.setCertificatePublication(this.context(req), id, dto); }

  @Patch('certificates/:id/revoke')
  @RequirePermissions({ resource: 'certificates', action: 'manage' })
  revokeCertificate(@Request() req: any, @Param('id') id: string, @Body() dto: RevokeCertificateDto) { return this.service.revokeCertificate(this.context(req), id, dto); }

  @Get('certificates/:id/download')
  @RequirePermissions({ resource: 'certificates', action: 'read' })
  certificateDownload(@Request() req: any, @Param('id') id: string) { return this.service.certificateDownload(this.context(req), id); }

  @Get('achievements')
  @RequirePermissions({ resource: 'achievements', action: 'read' })
  achievements(@Request() req: any) { return this.service.listAchievements(this.context(req)); }

  @Get('achievement-definitions')
  @RequirePermissions({ resource: 'achievements', action: 'manage' })
  achievementDefinitions(@Request() req: any) { return this.service.listAchievementDefinitions(this.context(req)); }

  @Post('achievements')
  @RequirePermissions({ resource: 'achievements', action: 'manage' })
  createAchievement(@Request() req: any, @Body() dto: CreateAchievementDto) { return this.service.createAchievement(this.context(req), dto); }

  @Post('achievements/:id/award')
  @RequirePermissions({ resource: 'achievements', action: 'manage' })
  awardAchievement(@Request() req: any, @Param('id') id: string, @Body() dto: AwardAchievementDto) { return this.service.awardAchievement(this.context(req), id, dto); }

  @Get('portfolio')
  @RequirePermissions({ resource: 'portfolio', action: 'read' })
  portfolio(@Request() req: any) { return this.service.listPortfolio(this.context(req)); }

  @Post('portfolio')
  @RequirePermissions({ resource: 'portfolio', action: 'create' })
  createPortfolio(@Request() req: any, @Body() dto: CreatePortfolioItemDto) { return this.service.createPortfolioItem(this.context(req), dto); }

  @Patch('portfolio/:id/publication')
  @RequirePermissions({ resource: 'portfolio', action: 'update' })
  portfolioPublication(@Request() req: any, @Param('id') id: string, @Body() dto: PortfolioPublicationDto) { return this.service.setPortfolioPublication(this.context(req), id, dto); }

  @Get('helpdesk')
  @RequirePermissions({ resource: 'helpdesk', action: 'read' })
  tickets(@Request() req: any) { return this.service.listHelpdeskTickets(this.context(req)); }

  @Post('helpdesk')
  @RequirePermissions({ resource: 'helpdesk', action: 'create' })
  createTicket(@Request() req: any, @Body() dto: CreateHelpdeskTicketDto) { return this.service.createHelpdeskTicket(this.context(req), dto); }

  @Get('helpdesk/:id')
  @RequirePermissions({ resource: 'helpdesk', action: 'read' })
  ticket(@Request() req: any, @Param('id') id: string) { return this.service.getHelpdeskTicket(this.context(req), id); }

  @Post('helpdesk/:id/messages')
  @RequirePermissions({ resource: 'helpdesk', action: 'create' })
  addTicketMessage(@Request() req: any, @Param('id') id: string, @Body() dto: AddHelpdeskMessageDto) { return this.service.addHelpdeskMessage(this.context(req), id, dto); }

  @Post('helpdesk/:id/attachments/upload-url')
  @RequirePermissions({ resource: 'helpdesk', action: 'create' })
  attachmentUpload(@Request() req: any, @Param('id') id: string, @Body() dto: HelpdeskAttachmentUploadDto) { return this.service.createHelpdeskAttachmentUpload(this.context(req), id, dto); }

  @Post('helpdesk/:id/attachments')
  @RequirePermissions({ resource: 'helpdesk', action: 'create' })
  completeAttachment(@Request() req: any, @Param('id') id: string, @Body() dto: CompleteHelpdeskAttachmentDto) { return this.service.completeHelpdeskAttachment(this.context(req), id, dto); }

  @Get('helpdesk/messages/:messageId/attachment')
  @RequirePermissions({ resource: 'helpdesk', action: 'read' })
  attachment(@Request() req: any, @Param('messageId') messageId: string) { return this.service.helpdeskAttachmentDownload(this.context(req), messageId); }

  @Patch('helpdesk/:id')
  @RequirePermissions({ resource: 'helpdesk', action: 'update' })
  updateTicket(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateHelpdeskTicketDto) { return this.service.updateHelpdeskTicket(this.context(req), id, dto); }

  @Get('cms')
  @RequirePermissions({ resource: 'cms', action: 'manage' })
  cms(@Request() req: any) { return this.service.listCms(this.context(req)); }

  @Post('cms')
  @RequirePermissions({ resource: 'cms', action: 'manage' })
  createCms(@Request() req: any, @Body() dto: CreateCmsContentDto) { return this.service.createCms(this.context(req), dto); }

  @Post('cms/:id/publish')
  @RequirePermissions({ resource: 'cms', action: 'manage' })
  publishCms(@Request() req: any, @Param('id') id: string) { return this.service.publishCms(this.context(req), id); }

  @Post('analytics/events')
  @RequirePermissions({ resource: 'analytics', action: 'create' })
  analytics(@Request() req: any, @Body() dto: AnalyticsEventDto) { return this.service.recordAnalytics(dto, this.context(req)); }

  @Get('sync-drafts/:key')
  @RequirePermissions({ resource: 'offline-drafts', action: 'update' })
  draft(@Request() req: any, @Param('key') key: string) { return this.service.getSyncDraft(this.context(req), key); }

  @Put('sync-drafts/:key')
  @RequirePermissions({ resource: 'offline-drafts', action: 'update' })
  syncDraft(@Request() req: any, @Param('key') key: string, @Body() dto: SyncDraftDto) { return this.service.syncDraft(this.context(req), key, dto); }

  @Delete('sync-drafts/:key')
  @RequirePermissions({ resource: 'offline-drafts', action: 'update' })
  deleteDraft(@Request() req: any, @Param('key') key: string) { return this.service.deleteSyncDraft(this.context(req), key); }

  private context(req: any): SupportingContext {
    return { userId: req.user.userId, organizationId: req.user.organizationId, schoolId: req.user.schoolId, studentId: req.user.studentId, parentId: req.user.parentId, teacherId: req.user.teacherId, roles: req.user.roles || [] };
  }
}

@Controller('public')
export class PublicSupportingController {
  constructor(private readonly service: SupportingService) {}

  @Get('certificates/:code')
  @RateLimit(30, 60)
  certificate(@Param('code') code: string) { return this.service.getPublicCertificate(code); }

  @Get('portfolio/:slug')
  @RateLimit(30, 60)
  portfolio(@Param('slug') slug: string) { return this.service.getPublicPortfolio(slug); }

  @Get('content')
  @RateLimit(60, 60)
  content(@Query('type') type?: string) { return this.service.getPublicCms(type); }

  @Post('analytics/events')
  @RateLimit(30, 60)
  analytics(@Body() dto: AnalyticsEventDto) { return this.service.recordAnalytics(dto); }
}
