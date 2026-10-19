import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { SubmissionsService, CreateSubmissionDto, ReviewSubmissionDto, SubmitAffiliateVideoDto } from './submissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('submissions')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SubmissionsController {
  constructor(private service: SubmissionsService) {}

  @Get()
  @RequirePermissions({ resource: 'submissions', action: 'read' })
  async findAll(@Query() query: any, @Request() req: any) {
    return this.service.findAll({
      status: query.status,
      schoolId: this.requireSchool(req),
      teacherId: req.user.roles?.includes('teacher') ? req.user.teacherId : undefined,
      studentId: req.user.roles?.includes('student') ? req.user.studentId : undefined,
      accessContext: this.accessContext(req),
    });
  }

  @Get(':id')
  @RequirePermissions({ resource: 'submissions', action: 'read' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, {
      schoolId: this.requireSchool(req),
      teacherId: req.user.roles?.includes('teacher') ? req.user.teacherId : undefined,
      studentId: req.user.roles?.includes('student') ? req.user.studentId : undefined,
      accessContext: this.accessContext(req),
    });
  }

  /**
   * Siswa menyimpan draft atau update submission
   */
  @Post()
  @RequirePermissions({ resource: 'submissions', action: 'create' })
  async createOrUpdate(@Body() dto: CreateSubmissionDto, @Request() req: any) {
    if (!req.user.studentId) throw new ForbiddenException('Hanya siswa yang dapat membuat submission');
    dto.studentId = req.user.studentId;
    return this.service.createOrUpdate(dto, this.accessContext(req));
  }

  /**
   * Siswa melakukan pengiriman final (submit)
   */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'submissions', action: 'update' })
  async submit(@Param('id') id: string, @Request() req: any) {
    if (!req.user.studentId) throw new ForbiddenException('Hanya siswa yang dapat mengirim submission');
    return this.service.submit(id, this.accessContext(req));
  }

  /**
   * Guru/Reviewer melakukan review
   */
  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'submissions', action: 'review' })
  async review(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: ReviewSubmissionDto,
  ) {
    if (!req.user.teacherId) throw new ForbiddenException('Akun tidak memiliki profil guru yang valid');
    return this.service.review(id, req.user.teacherId, this.requireSchool(req), dto, this.accessContext(req));
  }

  @Post(':id/ai-assessment')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'submissions', action: 'review' })
  async createAiAssessment(@Param('id') id: string, @Request() req: any) {
    if (!req.user.teacherId) throw new ForbiddenException('Akun tidak memiliki profil guru yang valid');
    return this.service.createAiAssessment(id, req.user.teacherId, this.requireSchool(req), this.accessContext(req));
  }

  /**
   * Tambah video affiliate ke dalam submission
   */
  @Post(':id/videos')
  @RequirePermissions({ resource: 'submissions', action: 'update' })
  async addVideo(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: SubmitAffiliateVideoDto,
  ) {
    if (!req.user.studentId) throw new ForbiddenException('Hanya siswa yang dapat mengubah submission');
    return this.service.addAffiliateVideo(id, this.accessContext(req), dto);
  }

  private requireSchool(req: any): string {
    if (!req.user.schoolId) throw new ForbiddenException('Pilih konteks sekolah sebelum mengakses pengumpulan');
    return req.user.schoolId;
  }

  private accessContext(req: any) {
    return { organizationId: req.user.organizationId, schoolId: this.requireSchool(req), userId: req.user.userId, studentId: req.user.studentId };
  }
}
