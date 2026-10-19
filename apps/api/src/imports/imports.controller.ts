import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ImportsService } from './imports.service';

class StudentImportRowDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(50) studentNumber: string;
  @IsString() @MaxLength(200) fullName: string;
  @IsOptional() @IsString() @MaxLength(50) classCode?: string;
  @IsOptional() @IsString() @MaxLength(30) nisn?: string;
}

class CreateStudentImportDto {
  @IsString() @MaxLength(255) sourceName: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10_000) @ValidateNested({ each: true }) @Type(() => StudentImportRowDto)
  rows: StudentImportRowDto[];
}

@Controller('imports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  list(@Request() request: any) {
    return this.service.list(request.user);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findOne(@Param('id') id: string, @Request() request: any) {
    return this.service.findOne(id, request.user);
  }

  @Post('students')
  @RequirePermissions({ resource: 'master-data', action: 'import' })
  createStudentImport(@Body() dto: CreateStudentImportDto, @Request() request: any) {
    return this.service.createStudentImport(dto.sourceName, dto.rows, request.user);
  }
}
