import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { FraudResolutionStatus, StoreFileKind, StorePlatform, StoreSubmissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsMimeType, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { StudentStoreService } from './student-store.service';

class ChecklistItemDto {
  @IsString() itemId: string;
  @IsBoolean() completed: boolean;
  @IsOptional() @IsString() @MaxLength(1000) value?: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

class SaveStoreDraftDto {
  @IsString() assignmentId: string;
  @IsOptional() @IsInt() @Min(1) rowVersion?: number;
  @IsEnum(StorePlatform) platform: StorePlatform;
  @IsString() @MinLength(2) @MaxLength(160) storeName: string;
  @IsOptional() @IsString() @MaxLength(160) storeUsername?: string;
  @IsOptional() @IsString() @MaxLength(160) storeExternalId?: string;
  @IsUrl({ require_protocol: true }) storeUrl: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsDateString() createdDate?: string;
  @IsInt() @Min(0) @Max(100000) productCount: number;
  @IsOptional() @IsArray() products?: Array<Record<string, unknown>>;
  @IsOptional() @IsString() @MaxLength(3000) studentNotes?: string;
  @IsOptional() @IsString() @MaxLength(3000) obstacles?: string;
  @IsBoolean() declarationAccepted: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistItemDto) checklist: ChecklistItemDto[];
}

class TemplateItemDto {
  @IsString() @MinLength(2) @MaxLength(60) code: string;
  @IsString() @MinLength(2) @MaxLength(200) label: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) evidenceType?: string;
  @IsInt() @Min(0) @Max(100) weight: number;
  @IsBoolean() isRequired: boolean;
  @IsInt() @Min(1) position: number;
}

class CreateTemplateDto {
  @IsString() @MinLength(3) @MaxLength(160) name: string;
  @IsOptional() @IsEnum(StorePlatform) platform?: StorePlatform;
  @IsInt() @Min(1) @Max(1000) minimumProducts: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TemplateItemDto) items: TemplateItemDto[];
}

class PrepareFileDto {
  @IsString() @MaxLength(255) fileName: string;
  @IsMimeType() mimeType: string;
  @IsInt() @Min(1) @Max(20 * 1024 * 1024) sizeBytes: number;
  @IsEnum(StoreFileKind) kind: StoreFileKind;
}

class RegisterFileDto extends PrepareFileDto {
  @IsString() @MaxLength(800) storageKey: string;
  @IsOptional() @IsString() @MaxLength(500) caption?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
}

class RubricScoreDto {
  @IsString() criterionId: string;
  @IsInt() @Min(0) @Max(1000) score: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

class StoreReviewDto {
  @IsEnum(StoreSubmissionStatus) decision: StoreSubmissionStatus;
  @IsOptional() @IsString() @MaxLength(5000) feedback?: string;
  @IsBoolean() publishGrade: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RubricScoreDto) scores?: RubricScoreDto[];
}

class SubmitStoreDto {
  @IsBoolean() declarationAccepted: boolean;
}

class ResolveFraudDto {
  @IsEnum(FraudResolutionStatus) status: FraudResolutionStatus;
  @IsString() @MinLength(3) @MaxLength(2000) notes: string;
}

@Controller('student-store')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class StudentStoreController {
  constructor(private readonly service: StudentStoreService) {}

  @Get('checklist-templates')
  @RequirePermissions({ resource: 'assignments', action: 'read' })
  templates(@Request() req: any) { return this.service.listTemplates({ ...req.user, schoolId: this.school(req) }); }

  @Post('checklist-templates')
  @RequirePermissions({ resource: 'assignments', action: 'create' })
  createTemplate(@Body() dto: CreateTemplateDto, @Request() req: any) { return this.service.createTemplate({ ...req.user, schoolId: this.school(req) }, dto); }

  @Get('assignments')
  @RequirePermissions({ resource: 'assignments', action: 'read' })
  assignments(@Request() req: any) { return this.service.listAssignments({ ...req.user, schoolId: this.school(req), studentId: this.student(req) }); }

  @Post('submissions/draft')
  @RequirePermissions({ resource: 'submissions', action: 'create' })
  saveDraft(@Body() dto: SaveStoreDraftDto, @Request() req: any) { return this.service.saveDraft({ ...req.user, schoolId: this.school(req), studentId: this.student(req) }, dto); }

  @Get('submissions/:id')
  @RequirePermissions({ resource: 'submissions', action: 'read' })
  getSubmission(@Param('id') id: string, @Request() req: any) { return this.service.getSubmission(id, { ...req.user, schoolId: this.school(req) }); }

  @Post('submissions/:id/files/upload-url')
  @RequirePermissions({ resource: 'submissions', action: 'create' })
  prepareFile(@Param('id') id: string, @Body() dto: PrepareFileDto, @Request() req: any) { return this.service.prepareFileUpload(id, { ...req.user, schoolId: this.school(req), studentId: this.student(req) }, dto); }

  @Post('submissions/:id/files')
  @RequirePermissions({ resource: 'submissions', action: 'create' })
  registerFile(@Param('id') id: string, @Body() dto: RegisterFileDto, @Request() req: any) { return this.service.registerFile(id, { ...req.user, schoolId: this.school(req), studentId: this.student(req) }, dto); }

  @Delete('files/:id')
  @RequirePermissions({ resource: 'submissions', action: 'update' })
  deleteFile(@Param('id') id: string, @Request() req: any) { return this.service.deleteFile(id, { ...req.user, schoolId: this.school(req), studentId: this.student(req) }); }

  @Post('submissions/:id/submit')
  @RequirePermissions({ resource: 'submissions', action: 'update' })
  submit(@Param('id') id: string, @Body() dto: SubmitStoreDto, @Request() req: any) { return this.service.submit(id, { ...req.user, schoolId: this.school(req), studentId: this.student(req) }, dto.declarationAccepted); }

  @Get('review/queue')
  @RequirePermissions({ resource: 'submissions', action: 'review' })
  queue(@Request() req: any) { return this.service.reviewQueue({ ...req.user, schoolId: this.school(req), teacherId: this.teacher(req) }); }

  @Post('submissions/:id/review')
  @RequirePermissions({ resource: 'submissions', action: 'review' })
  review(@Param('id') id: string, @Body() dto: StoreReviewDto, @Request() req: any) { return this.service.review(id, { ...req.user, schoolId: this.school(req), teacherId: this.teacher(req) }, dto); }

  @Post('fraud-flags/:id/resolve')
  @RequirePermissions({ resource: 'submissions', action: 'review' })
  resolveFraud(@Param('id') id: string, @Body() dto: ResolveFraudDto, @Request() req: any) { return this.service.resolveFraudFlag(id, { ...req.user, schoolId: this.school(req), teacherId: this.teacher(req) }, dto); }

  @Post('files/:id/access')
  @RequirePermissions({ resource: 'submissions', action: 'read' })
  accessFile(@Param('id') id: string, @Request() req: any) { return this.service.accessFile(id, { ...req.user, schoolId: this.school(req) }); }

  private school(req: any) { if (!req.user.schoolId) throw new ForbiddenException('Konteks sekolah wajib dipilih'); return req.user.schoolId as string; }
  private student(req: any) { if (!req.user.studentId) throw new ForbiddenException('Profil siswa diperlukan'); return req.user.studentId as string; }
  private teacher(req: any) { if (!req.user.teacherId) throw new ForbiddenException('Profil guru diperlukan'); return req.user.teacherId as string; }
}
