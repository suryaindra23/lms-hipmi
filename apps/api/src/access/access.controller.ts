import { Body, Controller, ForbiddenException, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { AccessService, CreateAccessGrantInput } from './access.service';
import { PLAN_CODES } from './access-policy';

class CreateAccessGrantDto implements CreateAccessGrantInput {
  @IsIn(['ORGANIZATION', 'SCHOOL', 'PROGRAM', 'CLASS', 'USER'])
  targetType!: CreateAccessGrantInput['targetType'];

  @IsIn(PLAN_CODES)
  planCode!: CreateAccessGrantInput['planCode'];

  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() programId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() userId?: string;

  @IsIn(['MANUAL', 'PARTNERSHIP', 'SCHOLARSHIP', 'PILOT', 'INSTITUTIONAL_INVOICE', 'MIGRATION'])
  source!: CreateAccessGrantInput['source'];

  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
@Controller('access')
export class AccessController {
  constructor(private readonly service: AccessService) {}

  @Get('plans')
  getPublicPlans() {
    return this.service.getPublicPlans();
  }

  @Get('effective')
  @UseGuards(JwtAuthGuard)
  getEffective(@Request() req: any) {
    return this.service.resolveEffectiveAccess(this.context(req));
  }

  @Post('grants')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'access-grants', action: 'manage' })
  createGrant(@Request() req: any, @Body() dto: CreateAccessGrantDto) {
    return this.service.createGrant(this.context(req), dto);
  }

  private context(req: any) {
    if (!req.user.organizationId) throw new ForbiddenException('Konteks organisasi diperlukan');
    return {
      organizationId: req.user.organizationId,
      schoolId: req.user.schoolId,
      userId: req.user.userId,
      studentId: req.user.studentId,
    };
  }
}
