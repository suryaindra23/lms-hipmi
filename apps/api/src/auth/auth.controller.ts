import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Patch,
  Delete,
  Param,
  Request,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  MfaCodeDto,
  DisableMfaDto,
  UpdateAccountDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';
import { RateLimit } from '../common/guards/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @RateLimit(5, 60)
  async register(@Body() dto: RegisterDto, @Req() request: ExpressRequest): Promise<AuthResponseDto> {
    return this.authService.register(dto, this.metadata(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit(5, 60)
  async login(@Body() dto: LoginDto, @Req() request: ExpressRequest): Promise<AuthResponseDto> {
    return this.authService.login(dto, this.metadata(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit(20, 60)
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: ExpressRequest): Promise<AuthResponseDto> {
    return this.authService.refreshToken(dto.refreshToken, this.metadata(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Request() req: any) {
    return this.authService.logoutAll(req.user.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit(3, 15 * 60)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit(5, 15 * 60)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return req.user;
  }

  @Get('account')
  @UseGuards(JwtAuthGuard)
  getAccount(@Request() req: any) {
    return this.authService.getAccount(req.user.userId);
  }

  @Patch('account')
  @UseGuards(JwtAuthGuard)
  updateAccount(@Request() req: any, @Body() dto: UpdateAccountDto) {
    return this.authService.updateAccount(req.user.userId, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @RateLimit(5, 15 * 60)
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, req.user.sessionId, dto.currentPassword, dto.newPassword);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@Request() req: any) {
    return this.authService.listSessions(req.user.userId, req.user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  revokeSession(@Request() req: any, @Param('id') id: string) {
    return this.authService.revokeOwnSession(req.user.userId, req.user.sessionId, id);
  }

  @Get('schools')
  @UseGuards(JwtAuthGuard)
  async getSchools(@Request() req: any) {
    return {
      selectedSchoolId: req.user.schoolId || null,
      schools: await this.authService.getAccessibleSchools(req.user.userId),
    };
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @RateLimit(3, 15 * 60)
  setupMfa(@Request() req: any) {
    return this.authService.beginMfaSetup(req.user.userId);
  }

  @Post('mfa/confirm')
  @UseGuards(JwtAuthGuard)
  @RateLimit(5, 15 * 60)
  confirmMfa(@Request() req: any, @Body() dto: MfaCodeDto) {
    return this.authService.confirmMfa(req.user.userId, req.user.sessionId, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @RateLimit(3, 15 * 60)
  disableMfa(@Request() req: any, @Body() dto: DisableMfaDto) {
    return this.authService.disableMfa(req.user.userId, dto.password, dto.code);
  }

  private metadata(request: ExpressRequest) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
