import { Body, Controller, Get, Param, Put, Query, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

class ListUsersDto {
  @IsOptional() @IsString() @MaxLength(120) query?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findAll(@Query() query: ListUsersDto, @Request() req: any) {
    return this.usersService.findAll({ ...this.accessScope(req), ...query });
  }

  @Get(':id')
  @RequirePermissions({ resource: 'master-data', action: 'read' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, this.accessScope(req));
  }

  @Put(':id/status')
  @RequirePermissions({ resource: 'master-data', action: 'update' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @Request() req: any) {
    return this.usersService.updateStatus(id, this.accessScope(req), dto.status, req.user.userId);
  }

  private accessScope(req: any) {
    return {
      organizationId: req.user.organizationId,
      schoolId: req.tenant_context?.schoolId || req.user.schoolId,
      organizationWide: req.user.schoolAccess?.organizationWide === true,
    };
  }
}
