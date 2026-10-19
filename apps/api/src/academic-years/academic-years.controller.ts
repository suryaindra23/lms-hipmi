import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString() name: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

export class CreateSemesterDto {
  @IsString() name: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

@Controller('academic-years')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AcademicYearsController {
  constructor(private service: AcademicYearsService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findAll(@Request() req: any) {
    return this.service.findAll(req.tenant_context?.schoolId || req.user.schoolId);
  }

  @Post()
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  create(@Body() dto: CreateAcademicYearDto, @Request() req: any) {
    return this.service.create(req.tenant_context?.schoolId || req.user.schoolId, dto);
  }

  @Put(':id/activate')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  activate(@Param('id') id: string, @Request() req: any) {
    return this.service.activate(id, req.tenant_context?.schoolId || req.user.schoolId);
  }

  @Post(':id/semesters')
  @RequirePermissions({ resource: 'master-data', action: 'create' })
  createSemester(
    @Param('id') id: string,
    @Body() dto: CreateSemesterDto,
    @Request() req: any,
  ) {
    return this.service.createSemester(id, req.tenant_context?.schoolId || req.user.schoolId, dto);
  }
}
