import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { LeadsService, CreateLeadDto } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { LeadStatus } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsInt, Min, IsEmail } from 'class-validator';
import { RateLimit } from '../common/guards/rate-limit.guard';

export class CreateLeadWithHoneypotDto extends CreateLeadDto {
  @IsString() @IsEmail() email: string;
  @IsString() schoolName: string;
  @IsString() educationLevel: string;
  @IsString() city: string;
  @IsString() province: string;
  @IsString() picName: string;
  @IsString() picTitle: string;
  @IsString() phone: string;
  @IsInt() @Min(1) estimatedStudents: number;
  @IsString() programOfInterest: string;
  @IsOptional() @IsString() message?: string;
  @IsBoolean() consent: boolean;

  // Honeypot field (hidden input di UI)
  @IsOptional() @IsString() website?: string;
}

@Controller('leads')
export class LeadsController {
  constructor(private service: LeadsService) {}

  /**
   * Endpoint Publik: Pendaftaran Sekolah Baru
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(5, 10 * 60)
  async registerSchool(@Body() dto: CreateLeadWithHoneypotDto) {
    // Honeypot check: jika bot mengisi field "website", silently ignore (bot-trap)
    if (dto.website) {
      console.warn('Spam bot detected via Honeypot check. Request ignored.');
      return { message: 'Registration submitted successfully' }; // Return success to fool the bot
    }

    if (!dto.consent) {
      throw new BadRequestException('Consent to privacy policy is required');
    }

    return this.service.create(dto);
  }

  /**
   * Endpoint Admin: List pendaftar (Leads)
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'leads', action: 'read' })
  async getLeads() {
    return this.service.findAll();
  }

  /**
   * Endpoint Admin: Update status lead
   */
  @Put(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ resource: 'leads', action: 'update' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: LeadStatus },
  ) {
    return this.service.updateStatus(id, body.status);
  }
}
