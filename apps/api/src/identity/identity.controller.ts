import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsMimeType, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { IdentityDocumentsService } from './identity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuditLogService } from '../common/services/audit-log.service';

class PrepareIdentityUploadDto {
  @IsString() @MaxLength(255) fileName: string;
  @IsMimeType() mimeType: string;
  @IsInt() @Min(1) @Max(8 * 1024 * 1024) sizeBytes: number;
}

class SubmitIdentityDto extends PrepareIdentityUploadDto {
  @Matches(/^\d{16}$/) nik: string;
  @IsOptional() @Matches(/^\d{10}$/) nisn?: string;
  @IsIn(['KTP', 'KIA', 'KK', 'KARTU_PELAJAR']) type: string;
  @IsString() @MaxLength(700) storageKey: string;
  @IsBoolean() consent: boolean;
}

class VerifyIdentityDto {
  @IsEnum(DocumentStatus) status: DocumentStatus;
  @IsOptional() @IsIn(['DOCUMENT_MISMATCH', 'FILE_UNREADABLE', 'DOCUMENT_EXPIRED', 'OTHER']) reasonCode?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

@Controller('identity-documents')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class IdentityDocumentsController {
  constructor(
    private readonly service: IdentityDocumentsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'identity', action: 'create' })
  getMyStatus(@Request() req: any) {
    if (!req.user.studentId) throw new ForbiddenException('Hanya siswa yang memiliki status identitas');
    return this.service.getStatus(req.user.studentId);
  }

  @Post('upload-url')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'identity', action: 'create' })
  prepareUpload(@Body() dto: PrepareIdentityUploadDto, @Request() req: any) {
    return this.service.createUploadUrl(this.studentContext(req), dto);
  }

  @Post()
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'identity', action: 'create' })
  async submit(@Body() dto: SubmitIdentityDto, @Request() req: any) {
    const document = await this.service.submit(this.studentContext(req), dto);
    await this.auditLog.logRequired({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      schoolId: req.user.schoolId,
      action: 'SUBMIT_IDENTITY_DOCUMENT',
      resource: 'identity_document',
      resourceId: document.id,
      details: { documentType: dto.type, consent: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.requestId,
    });
    return document;
  }

  @Get('pending')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'identity', action: 'verify' })
  getPending(@Request() req: any) {
    return this.service.findAllPending(req.user.organizationId, req.tenant_context?.schoolId || req.user.schoolId);
  }

  @Post(':id/access')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'identity.document', action: 'read' })
  async accessDocument(@Param('id') id: string, @Request() req: any) {
    const result = await this.service.createDownloadUrl(id, req.user.organizationId, req.tenant_context?.schoolId || req.user.schoolId);
    await this.auditLog.logRequired({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      schoolId: req.tenant_context?.schoolId || req.user.schoolId,
      action: 'ACCESS_IDENTITY_DOCUMENT',
      resource: 'identity_document',
      resourceId: id,
      details: { expiresIn: result.expiresIn },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.requestId,
    });
    return result;
  }

  @Put(':id/verify')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'identity', action: 'verify' })
  async verify(@Param('id') id: string, @Body() dto: VerifyIdentityDto, @Request() req: any) {
    const document = await this.service.updateStatus(
      id,
      dto.status,
      dto.reasonCode,
      dto.notes,
      req.user.userId,
      req.user.organizationId,
      req.tenant_context?.schoolId || req.user.schoolId,
    );
    await this.auditLog.logRequired({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      schoolId: req.tenant_context?.schoolId || req.user.schoolId,
      action: 'VERIFY_IDENTITY_DOCUMENT',
      resource: 'identity_document',
      resourceId: id,
      details: { status: dto.status, reasonCode: dto.reasonCode },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.requestId,
    });
    return { message: `Status dokumen diperbarui menjadi ${dto.status}`, document };
  }

  private studentContext(req: any) {
    const schoolId = req.tenant_context?.schoolId || req.user.schoolId;
    if (!req.user.studentId || !req.user.organizationId || !schoolId) {
      throw new ForbiddenException('Hanya siswa aktif dalam konteks sekolah yang dapat mengunggah identitas');
    }
    return {
      userId: req.user.userId,
      studentId: req.user.studentId,
      organizationId: req.user.organizationId,
      schoolId,
    };
  }
}
