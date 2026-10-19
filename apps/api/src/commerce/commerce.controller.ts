import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { IsBoolean, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { ApproveOrderInput, CommerceService, CreateOrderInput, RejectOrderInput } from './commerce.service';

class CreateOrderDto implements CreateOrderInput {
  @IsString() @MinLength(2) @MaxLength(120) offerSlug!: string;
  @IsUUID() idempotencyKey!: string;
  @IsBoolean() acceptTerms!: boolean;
}

class ApproveOrderDto implements ApproveOrderInput {
  @IsString() @MinLength(1) @MaxLength(120) beneficiaryUserId!: string;
  @IsString() @MinLength(3) @MaxLength(120) paymentReference!: string;
  @IsString() @MinLength(5) @MaxLength(500) note!: string;
}

class RejectOrderDto implements RejectOrderInput {
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

@Controller('commerce')
@UseGuards(JwtAuthGuard)
export class CommerceController {
  constructor(private readonly service: CommerceService) {}

  @Post('orders')
  createOrder(@Request() request: any, @Body() dto: CreateOrderDto) {
    return this.service.createOrder(request.user, dto);
  }

  @Get('orders')
  listMine(@Request() request: any) {
    return this.service.listMine(request.user);
  }

  @Get('orders/:id')
  findMine(@Request() request: any, @Param('id') id: string) {
    return this.service.findMine(request.user, id);
  }

  @Post('orders/:id/cancel')
  cancelMine(@Request() request: any, @Param('id') id: string) {
    return this.service.cancelMine(request.user, id);
  }

  @Get('admin/orders')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'access-grants', action: 'manage' })
  listApprovalOrders(@Request() request: any) {
    return this.service.listApprovalOrders(request.user);
  }

  @Get('admin/students')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'access-grants', action: 'manage' })
  listEligibleStudents(@Request() request: any) {
    return this.service.listEligibleStudents(request.user);
  }

  @Post('admin/orders/:id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'access-grants', action: 'manage' })
  approveOrder(@Request() request: any, @Param('id') id: string, @Body() dto: ApproveOrderDto) {
    return this.service.approveOrder(request.user, id, dto);
  }

  @Post('admin/orders/:id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ resource: 'access-grants', action: 'manage' })
  rejectOrder(@Request() request: any, @Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.service.rejectOrder(request.user, id, dto);
  }
}
