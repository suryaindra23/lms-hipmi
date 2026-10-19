import { Body, Controller, Delete, Get, Header, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ConsentType, DataSubjectRequestStatus, DataSubjectRequestType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { RateLimit } from '../common/guards/rate-limit.guard';
import { PrivacyService } from './privacy.service';

class GrantConsentDto {
  @IsString() documentId: string;
  @IsEnum(ConsentType) type: ConsentType;
  @IsOptional() @IsString() studentId?: string;
  @IsIn(['AUTHENTICATED_CHECKBOX']) method: string;
}

class WithdrawConsentDto {
  @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

class CreateDataRequestDto {
  @IsEnum(DataSubjectRequestType) type: DataSubjectRequestType;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() @MaxLength(2000) details?: string;
}

class UpdateDataRequestDto {
  @IsEnum(DataSubjectRequestStatus) status: DataSubjectRequestStatus;
  @IsOptional() @IsString() @MaxLength(4000) resolution?: string;
}

@Controller('privacy')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get('consent-documents')
  @Header('Cache-Control', 'no-store, private')
  documents(@Request() req: any) { return this.service.listDocuments(req.user.organizationId); }

  @Get('subjects')
  @Header('Cache-Control', 'no-store, private')
  subjects(@Request() req: any) { return this.service.listSubjects(req.user); }

  @Get('consents/me')
  @Header('Cache-Control', 'no-store, private')
  myConsents(@Request() req: any) { return this.service.listMyConsents(req.user); }

  @Post('consents')
  @Header('Cache-Control', 'no-store, private')
  @RateLimit(20, 60)
  grant(@Body() dto: GrantConsentDto, @Request() req: any) { return this.service.grant(req.user, dto); }

  @Delete('consents/:id')
  @Header('Cache-Control', 'no-store, private')
  @RateLimit(20, 60)
  withdraw(@Param('id') id: string, @Body() dto: WithdrawConsentDto, @Request() req: any) { return this.service.withdraw(req.user, id, dto.reason); }

  @Post('data-requests')
  @Header('Cache-Control', 'no-store, private')
  @RateLimit(10, 60 * 60)
  createRequest(@Body() dto: CreateDataRequestDto, @Request() req: any) { return this.service.createRequest(req.user, dto); }

  @Get('data-requests/me')
  @Header('Cache-Control', 'no-store, private')
  myRequests(@Request() req: any) { return this.service.listMyRequests(req.user); }

  @Get('data-requests')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'privacy', action: 'manage' })
  requests(@Request() req: any) { return this.service.listRequests(req.user); }

  @Put('data-requests/:id')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermissions({ resource: 'privacy', action: 'manage' })
  updateRequest(@Param('id') id: string, @Body() dto: UpdateDataRequestDto, @Request() req: any) { return this.service.updateRequest(req.user, id, dto); }
}
