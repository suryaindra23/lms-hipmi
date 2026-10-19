import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Class, Prisma } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string): Promise<Class[]> {
    return this.prisma.class.findMany({ where: { schoolId } });
  }

  async create(schoolId: string, data: Omit<Prisma.ClassUncheckedCreateInput, 'schoolId'>): Promise<Class> {
    return this.prisma.class.create({ data: { ...data, schoolId } });
  }

  async update(id: string, schoolId: string, data: Prisma.ClassUpdateInput): Promise<Class> {
    const target = await this.prisma.class.findFirst({ where: { id, schoolId } });
    if (!target) throw new NotFoundException('Class not found');
    return this.prisma.class.update({ where: { id }, data });
  }

  async archive(id: string, schoolId: string): Promise<Class> {
    const target = await this.prisma.class.findFirst({ where: { id, schoolId } });
    if (!target) throw new NotFoundException('Class not found');
    return this.prisma.class.update({ where: { id }, data: { isActive: false } });
  }
}
