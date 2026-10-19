import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Organization, Prisma } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: { id: organizationId },
      include: { _count: { select: { schools: true, users: true } } },
    });
  }

  async findOne(id: string, organizationId: string): Promise<Organization> {
    if (id !== organizationId) throw new NotFoundException('Organization not found');
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      include: {
        schools: { select: { id: true, name: true, status: true } },
        _count: { select: { schools: true, users: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  async update(id: string, organizationId: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    try {
      if (id !== organizationId) throw new NotFoundException('Organization not found');
      const exists = await this.prisma.organization.count({ where: { id: organizationId } });
      if (!exists) throw new NotFoundException('Organization not found');
      return await this.prisma.organization.update({ where: { id }, data });
    } catch {
      throw new NotFoundException('Organization not found');
    }
  }
}
