import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

export class CreateOrganizationDto {
  @IsString() name: string;
  @IsString() code: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logo?: string;
}

export class UpdateOrganizationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findAll(@Request() req: any) { return this.service.findAll(req.user.organizationId); }

  @Get(':id')
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findOne(@Param('id') id: string, @Request() req: any) { return this.service.findOne(id, req.user.organizationId); }

  @Post()
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  create(@Body() dto: CreateOrganizationDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @Request() req: any) {
    return this.service.update(id, req.user.organizationId, dto);
  }
}
