import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SchoolsService, CreateSchoolDto, UpdateSchoolDto } from './schools.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';

@Controller('schools')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SchoolsController {
  constructor(private service: SchoolsService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user.organizationId);
  }

  @Post()
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  create(@Body() dto: CreateSchoolDto, @Request() req: any) {
    // Override organizationId dari JWT untuk keamanan tenant
    dto.organizationId = req.user.organizationId;
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto, @Request() req: any) {
    return this.service.update(id, req.user.organizationId, dto);
  }
}
