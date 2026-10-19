import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() whatsappEnabled?: boolean;
  @IsOptional() @IsBoolean() smsEnabled?: boolean;
  @IsOptional() @IsIn(['IMMEDIATE', 'DAILY', 'WEEKLY']) digestFrequency?: string;
  @IsOptional() @IsString() quietHoursStart?: string;
  @IsOptional() @IsString() quietHoursEnd?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsBoolean() assignmentUpdates?: boolean;
  @IsOptional() @IsBoolean() reviewUpdates?: boolean;
  @IsOptional() @IsBoolean() announcements?: boolean;
  @IsOptional() @IsBoolean() earlyWarnings?: boolean;
  @IsOptional() @IsBoolean() helpdeskUpdates?: boolean;
}

export class CreateAnnouncementDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsString() @MinLength(3) @MaxLength(5000) body: string;
  @IsOptional() @IsIn(['ALL', 'STUDENTS', 'TEACHERS', 'PARENTS', 'STAFF']) audience?: string;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @IsBoolean() publishNow?: boolean;
}

export class CreateCertificateTemplateDto {
  @IsString() @MinLength(3) @MaxLength(120) name: string;
  @IsString() @MinLength(3) @MaxLength(180) titleTemplate: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsObject() eligibilityRule: Record<string, unknown>;
}

export class IssueCertificateDto {
  @IsString() templateId: string;
  @IsString() studentId: string;
}

export class CertificatePublicationDto {
  @IsBoolean() publicVisible: boolean;
}

export class RevokeCertificateDto {
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}

export class CreateAchievementDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(3) @MaxLength(120) title: string;
  @IsString() @MinLength(3) @MaxLength(1000) description: string;
  @IsOptional() @IsString() icon?: string;
  @IsObject() criteria: Record<string, unknown>;
}

export class AwardAchievementDto {
  @IsString() studentId: string;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
}

export class CreatePortfolioItemDto {
  @IsString() sourceType: string;
  @IsString() sourceId: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class PortfolioPublicationDto {
  @IsBoolean() publicVisible: boolean;
}

export class CreateHelpdeskTicketDto {
  @IsString() @MinLength(2) @MaxLength(80) category: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsString() @MinLength(5) @MaxLength(180) subject: string;
  @IsString() @MinLength(10) @MaxLength(5000) description: string;
}

export class AddHelpdeskMessageDto {
  @IsString() @MinLength(2) @MaxLength(5000) body: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}

export class HelpdeskAttachmentUploadDto {
  @IsString() @MinLength(1) @MaxLength(255) fileName: string;
  @IsIn(['application/pdf', 'image/jpeg', 'image/png']) mimeType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(8 * 1024 * 1024) sizeBytes: number;
}

export class CompleteHelpdeskAttachmentDto extends HelpdeskAttachmentUploadDto {
  @IsString() @MinLength(10) @MaxLength(600) storageKey: string;
  @IsOptional() @IsString() @MaxLength(500) body?: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}

export class UpdateHelpdeskTicketDto {
  @IsOptional() @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED']) status?: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() @MaxLength(2000) resolution?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) satisfaction?: number;
}

export class CreateCmsContentDto {
  @IsString() @MinLength(2) @MaxLength(120) slug: string;
  @IsIn(['FAQ', 'TESTIMONIAL', 'CASE_STUDY', 'PARTNER', 'PAGE']) type: string;
  @IsString() @MinLength(3) @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsObject() body: Record<string, unknown>;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) position?: number;
}

export class AnalyticsEventDto {
  @IsIn(['PAGE_VIEW', 'CTA_CLICK', 'LEAD_STARTED', 'LEAD_SUBMITTED', 'PWA_INSTALLED']) eventName: string;
  @IsOptional() @IsObject() properties?: Record<string, unknown>;
  @IsBoolean() consentGranted: boolean;
  @IsOptional() @IsString() @MaxLength(100) anonymousId?: string;
}

export class SyncDraftDto {
  @IsObject() content: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) version?: number;
}
