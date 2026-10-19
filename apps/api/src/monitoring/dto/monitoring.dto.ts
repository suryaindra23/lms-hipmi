import { EarlyWarningStatus, ReportType } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class MonitoringQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  periodDays = 30;

  @IsOptional()
  @IsString()
  classId?: string;
}

export class EarlyWarningQueryDto extends MonitoringQueryDto {
  @IsOptional()
  @IsEnum(EarlyWarningStatus)
  status?: EarlyWarningStatus;

  @IsOptional()
  @IsString()
  studentId?: string;
}

export class UpdateEarlyWarningDto {
  @IsEnum(EarlyWarningStatus)
  status!: EarlyWarningStatus;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note!: string;
}

export class CreateExportDto extends MonitoringQueryDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsOptional()
  @IsIn(['CSV'])
  format = 'CSV';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone = 'Asia/Jakarta';
}

export class CreatePublicStatisticDto extends MonitoringQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;
}

export class ReviewPublicStatisticDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
