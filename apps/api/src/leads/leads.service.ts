import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Lead, LeadStatus, Prisma } from '@prisma/client';

export class CreateLeadDto {
  schoolName: string;
  educationLevel: string;
  city: string;
  province: string;
  picName: string;
  picTitle: string;
  email: string;
  phone: string;
  estimatedStudents: number;
  programOfInterest: string;
  message?: string;
  consent: boolean;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    return this.prisma.lead.create({
      data: {
        schoolName: dto.schoolName,
        educationLevel: dto.educationLevel,
        city: dto.city,
        province: dto.province,
        picName: dto.picName,
        picTitle: dto.picTitle,
        email: dto.email,
        phone: dto.phone,
        estimatedStudents: Number(dto.estimatedStudents),
        programOfInterest: dto.programOfInterest,
        message: dto.message,
        consent: dto.consent,
        status: 'PENDING',
      },
    });
  }

  async findAll(): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.lead.update({
      where: { id },
      data: { status },
    });
  }
}
