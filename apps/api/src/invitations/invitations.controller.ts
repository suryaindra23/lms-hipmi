import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { InvitationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { RateLimit } from '../common/guards/rate-limit.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InvitationsService } from './invitations.service';

class CreateInvitationDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName: string;
  @IsString() roleSlug: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsObject() profileData?: Record<string, unknown>;
}

class AcceptInvitationDto {
  @IsString() token: string;
  @IsString() @MinLength(8) password: string;
}

class ListInvitationsDto {
  @IsOptional() @IsString() @MaxLength(120) query?: string;
  @IsOptional() @IsEnum(InvitationStatus) status?: InvitationStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  list(@Query() query: ListInvitationsDto, @Request() request: any) {
    return this.service.list(request.user, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  create(@Body() dto: CreateInvitationDto, @Request() request: any) {
    return this.service.create(dto, request.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  revoke(@Param('id') id: string, @Request() request: any) {
    return this.service.revoke(id, request.user);
  }

  @Post('accept')
  @RateLimit(5, 15 * 60)
  accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto.token, dto.password);
  }
}
