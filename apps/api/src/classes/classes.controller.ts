import { Controller, Delete, Get, Param, Post, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateClassDto {
  @IsString() name: string;
  @IsString() code: string;
  @IsOptional() @IsInt() grade?: number;
  @IsOptional() @IsInt() capacity?: number;
  @IsOptional() @IsString() departmentId?: string;
}

export class UpdateClassDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() grade?: number;
  @IsOptional() @IsInt() capacity?: number;
  @IsOptional() @IsString() departmentId?: string;
}

@Controller('classes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ClassesController {
  constructor(private service: ClassesService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findAll(@Request() req: any) { return this.service.findAll(req.tenant_context?.schoolId || req.user.schoolId); }

  @Post()
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  create(@Body() dto: CreateClassDto, @Request() req: any) {
    return this.service.create(req.tenant_context?.schoolId || req.user.schoolId, dto);
  }

  @Put(':id')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  update(@Param('id') id: string, @Body() dto: UpdateClassDto, @Request() req: any) {
    return this.service.update(id, req.tenant_context?.schoolId || req.user.schoolId, dto);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'master-data', action: 'delete' })
  archive(@Param('id') id: string, @Request() req: any) {
    return this.service.archive(id, req.tenant_context?.schoolId || req.user.schoolId);
  }
}
