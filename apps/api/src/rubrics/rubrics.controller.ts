import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RubricsService } from './rubrics.service';

class RubricCriterionDto {
  @IsString() @MinLength(2) @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsInt() @Min(1) @Max(100) weight: number;
  @IsInt() @Min(1) @Max(1000) maxScore: number;
  @IsOptional() @IsInt() @Min(1) position?: number;
  @IsOptional() @IsObject() levels?: Record<string, unknown>;
}

class CreateRubricDto {
  @IsString() @MinLength(3) @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RubricCriterionDto) criteria: RubricCriterionDto[];
}

@Controller('rubrics')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class RubricsController {
  constructor(private readonly service: RubricsService) {}

  @Get()
  @RequirePermissions({ resource: 'assignments', action: 'read' })
  list(@Request() req: any) { return this.service.list(req.user.organizationId, this.accessContext(req)); }

  @Get(':id')
  @RequirePermissions({ resource: 'assignments', action: 'read' })
  get(@Param('id') id: string, @Request() req: any) { return this.service.findOne(id, req.user.organizationId, this.accessContext(req)); }

  @Post()
  @RequirePermissions({ resource: 'assignments', action: 'create' })
  create(@Body() dto: CreateRubricDto, @Request() req: any) { return this.service.createForContext(this.accessContext(req), dto as any); }

  @Post('templates/mgmp')
  @RequirePermissions({ resource: 'assignments', action: 'create' })
  createMgmpTemplates(@Request() req: any) { return this.service.createMgmpTemplates(this.accessContext(req)); }

  private accessContext(req: any) {
    return { organizationId: req.user.organizationId, schoolId: req.user.schoolId, userId: req.user.userId, studentId: req.user.studentId };
  }
}
