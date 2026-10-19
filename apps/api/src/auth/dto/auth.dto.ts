import { IsEmail, IsString, MinLength, IsOptional, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @Length(6, 6)
  @IsOptional()
  otp?: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  organizationId: string;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class MfaCodeDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class DisableMfaDto extends MfaCodeDto {
  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
