import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { isPendingPaymentExpired } from './commerce.utils';

const paymentAccount = {
  bankName: process.env.PAYMENT_BANK_NAME || 'BANK DEMO',
  accountNumber: process.env.PAYMENT_BANK_ACCOUNT_NUMBER || '0000000000',
  accountHolder: process.env.PAYMENT_BANK_ACCOUNT_HOLDER || 'SUNRISE ACADEMY DEMO',
};

const orderInclude = {
  items: {
    select: {
      id: true,
      quantityOrSeats: true,
      unitAmount: true,
      lineTotal: true,
      accessStartsAt: true,
      accessEndsAt: true,
      accessPlan: { select: { id: true, code: true, name: true, moduleLimit: true } },
      planOffer: { select: { slug: true, name: true, accessDurationDays: true } },
      beneficiaries: {
        select: {
          id: true,
          beneficiaryType: true,
          userId: true,
          schoolId: true,
          verificationStatus: true,
        },
      },
      accessGrants: {
        select: {
          id: true,
          userId: true,
          targetType: true,
          source: true,
          status: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  },
  paymentAttempts: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      provider: true,
      methodType: true,
      status: true,
      requestedAmount: true,
      currency: true,
      providerReference: true,
      paymentUrlExpiresAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderInclude;

export interface CommerceUser {
  userId: string;
  organizationId?: string;
  schoolId?: string;
  schoolAccess?: { organizationWide?: boolean; schoolIds?: string[] };
}

export interface CreateOrderInput {
  offerSlug: string;
  idempotencyKey: string;
  acceptTerms: boolean;
}

export interface ApproveOrderInput {
  beneficiaryUserId: string;
  paymentReference: string;
  note: string;
}

export interface RejectOrderInput {
  reason: string;
}

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async createOrder(user: CommerceUser, input: CreateOrderInput) {
    if (!input.acceptTerms) throw new BadRequestException('Persetujuan syarat pembelian wajib diberikan');

    await this.expirePendingOrders({ purchaserUserId: user.userId });

    const existing = await this.prisma.order.findUnique({
      where: { purchaserUserId_idempotencyKey: { purchaserUserId: user.userId, idempotencyKey: input.idempotencyKey } },
      include: orderInclude,
    });
    if (existing) return this.toResponse(existing);

    const now = new Date();
    const offer = await this.prisma.planOffer.findFirst({
      where: {
        slug: input.offerSlug,
        status: 'ACTIVE',
        audience: 'INDIVIDUAL',
        OR: [{ salesStartAt: null }, { salesStartAt: { lte: now } }],
        AND: [{ OR: [{ salesEndAt: null }, { salesEndAt: { gt: now } }] }],
      },
      include: {
        accessPlan: { select: { id: true, code: true, name: true, moduleLimit: true } },
        prices: {
          where: { status: 'ACTIVE', effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });
    if (!offer) throw new NotFoundException('Paket tidak tersedia');
    if (offer.billingModel === 'FREE') throw new BadRequestException('Paket Gratis tidak memerlukan pembelian');

    const price = offer.prices[0];
    if (!price || Number(price.amount) <= 0) throw new BadRequestException('Harga paket belum tersedia');
    if (!offer.termsVersion || !offer.refundPolicyVersion) {
      throw new BadRequestException('Syarat pembelian paket belum lengkap');
    }

    const purchaserStudent = await this.prisma.student.findFirst({
      where: {
        userId: user.userId,
        status: 'ACTIVE',
        ...(user.organizationId ? { school: { organizationId: user.organizationId } } : {}),
      },
      select: { schoolId: true },
    });

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        purchaserUserId: user.userId,
        status: 'PENDING_PAYMENT',
        paymentExpiresAt: { gt: now },
        items: { some: { planOfferId: offer.id } },
      },
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
    });
    if (activeOrder) return this.toResponse(await this.ensurePaymentCode(activeOrder.id));

    const paymentExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const orderNumber = `SA-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const amount = price.amount;

    const order = await this.prisma.$transaction(async (tx) => {
      const uniqueCode = await this.allocateUniqueCode(tx, now, price.currency, amount);
      const totalAmount = new Prisma.Decimal(amount.toString()).plus(uniqueCode);
      const created = await tx.order.create({
        data: {
          orderNumber,
          organizationId: user.organizationId ?? null,
          purchaserUserId: user.userId,
          status: 'PENDING_PAYMENT',
          currency: price.currency,
          subtotalAmount: amount,
          feeAmount: uniqueCode,
          totalAmount,
          paymentExpiresAt,
          termsVersion: offer.termsVersion,
          refundPolicyVersion: offer.refundPolicyVersion,
          consentSnapshot: {
            accepted: true,
            acceptedAt: now.toISOString(),
            termsVersion: offer.termsVersion,
            refundPolicyVersion: offer.refundPolicyVersion,
          },
          idempotencyKey: input.idempotencyKey,
        },
      });
      const item = await tx.orderItem.create({
        data: {
          orderId: created.id,
          planOfferId: offer.id,
          accessPlanId: offer.accessPlan.id,
          offerSnapshot: {
            code: offer.code,
            slug: offer.slug,
            name: offer.name,
            billingModel: offer.billingModel,
            accessDurationDays: offer.accessDurationDays,
          },
          priceSnapshot: {
            currency: price.currency,
            amount: price.amount.toString(),
            compareAtAmount: price.compareAtAmount?.toString() ?? null,
            taxMode: price.taxMode,
            taxRate: price.taxRate?.toString() ?? null,
          },
          unitAmount: amount,
          lineTotal: amount,
        },
      });
      await tx.purchaseBeneficiary.create({
        data: {
          orderItemId: item.id,
          beneficiaryType: 'USER',
          userId: user.userId,
          schoolId: null,
          verificationStatus: purchaserStudent ? 'VERIFIED' : 'PENDING',
        },
      });
      await tx.paymentAttempt.create({
        data: {
          orderId: created.id,
          provider: 'MANUAL_REVIEW',
          methodType: 'PAYMENT_INSTRUCTION',
          status: 'PENDING',
          requestedAmount: totalAmount,
          currency: price.currency,
          providerReference: orderNumber,
          paymentUrlExpiresAt: paymentExpiresAt,
        },
      });
      await tx.billingAuditEvent.create({
        data: {
          organizationId: user.organizationId ?? null,
          actorId: user.userId,
          action: 'ORDER_CREATED',
          resource: 'order',
          resourceId: created.id,
          safeDetails: { orderNumber, offerCode: offer.code, amount: amount.toString(), uniqueCode, totalAmount: totalAmount.toString(), currency: price.currency },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude });
    });

    return this.toResponse(order);
  }

  async listMine(user: CommerceUser) {
    await this.expirePendingOrders({ purchaserUserId: user.userId });
    const orders = await this.prisma.order.findMany({
      where: { purchaserUserId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
    });
    const responses = [];
    for (const order of orders) {
      const needsPaymentCode = order.status === 'PENDING_PAYMENT'
        && Number(order.feeAmount.toString()) === 0
        && Boolean(order.paymentExpiresAt && order.paymentExpiresAt > new Date());
      responses.push(this.toResponse(needsPaymentCode ? await this.ensurePaymentCode(order.id) : order));
    }
    return responses;
  }

  async findMine(user: CommerceUser, orderId: string) {
    await this.expirePendingOrders({ id: orderId, purchaserUserId: user.userId });
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, purchaserUserId: user.userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    const needsPaymentCode = order.status === 'PENDING_PAYMENT'
      && Number(order.feeAmount.toString()) === 0
      && Boolean(order.paymentExpiresAt && order.paymentExpiresAt > new Date());
    return this.toResponse(needsPaymentCode ? await this.ensurePaymentCode(order.id) : order);
  }

  async listApprovalOrders(user: CommerceUser) {
    const organizationId = this.requireOrganization(user);
    await this.expirePendingOrders({ organizationId });
    const where: Prisma.OrderWhereInput = {
      organizationId,
      status: { in: ['PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED'] },
    };

    if (user.schoolId) {
      const scopedUsers = await this.prisma.user.findMany({
        where: {
          organizationId,
          OR: [
            { student: { is: { schoolId: user.schoolId } } },
            { userRoles: { some: { schoolId: user.schoolId } } },
          ],
        },
        select: { id: true },
      });
      where.OR = [
        { purchaserUserId: { in: scopedUsers.map((item) => item.id) } },
        { items: { some: { beneficiaries: { some: { schoolId: user.schoolId } } } } },
      ];
    } else if (!user.schoolAccess?.organizationWide) {
      throw new ForbiddenException('Pilih sekolah sebelum membuka approval pembayaran');
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: orderInclude,
    });
    const userIds = new Set<string>();
    for (const order of orders) {
      userIds.add(order.purchaserUserId);
      for (const item of order.items) {
        for (const beneficiary of item.beneficiaries) if (beneficiary.userId) userIds.add(beneficiary.userId);
        for (const grant of item.accessGrants) if (grant.userId) userIds.add(grant.userId);
      }
    }
    const identities = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        student: { select: { fullName: true, studentNumber: true, schoolId: true, school: { select: { name: true } } } },
      },
    });
    const identityById = new Map(identities.map((identity) => [identity.id, identity]));
    return orders.map((order) => this.toAdminResponse(order, identityById));
  }

  async listEligibleStudents(user: CommerceUser) {
    const organizationId = this.requireOrganization(user);
    const students = await this.prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        school: { organizationId },
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      },
      orderBy: [{ fullName: 'asc' }],
      select: {
        id: true,
        userId: true,
        fullName: true,
        studentNumber: true,
        schoolId: true,
        school: { select: { name: true } },
        user: { select: { email: true } },
      },
    });
    return students.map((student) => ({
      id: student.id,
      userId: student.userId,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
      email: student.user.email,
      schoolId: student.schoolId,
      schoolName: student.school.name,
    }));
  }

  async approveOrder(user: CommerceUser, orderId: string, input: ApproveOrderInput) {
    const organizationId = this.requireOrganization(user);
    const paymentReference = input.paymentReference.trim();
    const note = input.note.trim();
    if (paymentReference.length < 3) throw new BadRequestException('Referensi transfer wajib diisi');
    if (note.length < 5) throw new BadRequestException('Catatan pemeriksaan wajib diisi');
    await this.expirePendingOrders({ id: orderId, organizationId });
    const target = await this.prisma.student.findFirst({
      where: {
        userId: input.beneficiaryUserId,
        status: 'ACTIVE',
        school: { organizationId },
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      },
      select: { userId: true, schoolId: true, fullName: true },
    });
    if (!target) throw new BadRequestException('Penerima akses harus siswa aktif dalam sekolah yang dikelola');

    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const order = await tx.order.findFirst({ where: { id: orderId, organizationId }, include: orderInclude });
      if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
      if (order.status === 'PAID') return order;
      if (order.status !== 'PENDING_PAYMENT') throw new ConflictException('Pesanan ini tidak lagi menunggu approval');
      if (order.purchaserUserId === user.userId) {
        throw new ForbiddenException('Pembayaran harus diverifikasi oleh admin lain, bukan pembuat pesanan');
      }
      if (isPendingPaymentExpired(order.status, order.paymentExpiresAt, now)) {
        await this.markOrderExpired(tx, order, now);
        return null;
      }
      const duplicateReference = await tx.paymentAttempt.findFirst({
        where: {
          provider: 'MANUAL_REVIEW',
          providerReference: paymentReference,
          status: 'SETTLED',
          orderId: { not: order.id },
        },
        select: { orderId: true },
      });
      if (duplicateReference) {
        throw new ConflictException('Referensi transfer sudah digunakan pada pesanan lain');
      }
      const item = order.items[0];
      if (!item || order.items.length !== 1 || item.quantityOrSeats !== 1) {
        throw new BadRequestException('Pesanan berbayar harus berisi tepat satu paket untuk satu siswa');
      }

      const endsAt = item.planOffer.accessDurationDays
        ? new Date(now.getTime() + item.planOffer.accessDurationDays * 24 * 60 * 60 * 1000)
        : null;
      await tx.purchaseBeneficiary.updateMany({
        where: { orderItemId: item.id },
        data: {
          beneficiaryType: 'USER',
          userId: target.userId,
          schoolId: null,
          verificationStatus: 'VERIFIED',
        },
      });
      const grant = await tx.accessGrant.create({
        data: {
          organizationId,
          userId: target.userId,
          targetType: 'USER',
          accessPlanId: item.accessPlan.id,
          orderItemId: item.id,
          source: 'PURCHASE',
          status: 'ACTIVE',
          startsAt: now,
          endsAt,
          reason: `Pembayaran ${order.orderNumber} disetujui untuk satu siswa`,
          grantedBy: user.userId,
        },
      });
      await tx.accessGrantEvent.create({
        data: {
          accessGrantId: grant.id,
          eventType: 'CREATED',
          actorId: user.userId,
          reason: note,
          metadata: {
            orderNumber: order.orderNumber,
            planCode: item.accessPlan.code,
            beneficiaryUserId: target.userId,
            pricingUnit: 'PER_STUDENT',
          },
        },
      });
      await tx.orderItem.update({
        where: { id: item.id },
        data: { accessStartsAt: now, accessEndsAt: endsAt },
      });
      await tx.paymentAttempt.updateMany({
        where: { orderId: order.id, status: { in: ['CREATED', 'PENDING', 'AUTHORIZED'] } },
        data: {
          status: 'SETTLED',
          settledAmount: order.totalAmount,
          settledAt: now,
          providerReference: paymentReference,
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: now } });
      await tx.billingAuditEvent.create({
        data: {
          organizationId,
          actorId: user.userId,
          action: 'PAYMENT_APPROVED_AND_ACCESS_GRANTED',
          resource: 'order',
          resourceId: order.id,
          safeDetails: {
            orderNumber: order.orderNumber,
            beneficiaryUserId: target.userId,
            schoolId: target.schoolId,
            planCode: item.accessPlan.code,
            paymentReference,
            pricingUnit: 'PER_STUDENT',
          },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    });
    if (!outcome) throw new ConflictException('Batas pembayaran telah lewat. Buat pesanan baru untuk memperoleh kode unik baru.');
    await this.access.invalidateOrganizationAccess(organizationId);
    return this.toResponse(outcome);
  }

  async rejectOrder(user: CommerceUser, orderId: string, input: RejectOrderInput) {
    const organizationId = this.requireOrganization(user);
    await this.expirePendingOrders({ id: orderId, organizationId });
    const rejected = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, organizationId } });
      if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
      if (order.status !== 'PENDING_PAYMENT') throw new ConflictException('Pesanan ini tidak lagi menunggu approval');
      await tx.paymentAttempt.updateMany({
        where: { orderId, status: { in: ['CREATED', 'PENDING', 'AUTHORIZED'] } },
        data: { status: 'FAILED', failedAt: new Date(), failureCode: 'MANUAL_REJECTED' },
      });
      await tx.purchaseBeneficiary.updateMany({
        where: { orderItem: { orderId } },
        data: { verificationStatus: 'REJECTED' },
      });
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'FAILED' }, include: orderInclude });
      await tx.billingAuditEvent.create({
        data: {
          organizationId,
          actorId: user.userId,
          action: 'PAYMENT_REJECTED',
          resource: 'order',
          resourceId: orderId,
          safeDetails: { orderNumber: order.orderNumber, reason: input.reason.trim() },
        },
      });
      return updated;
    });
    return this.toResponse(rejected);
  }

  async cancelMine(user: CommerceUser, orderId: string) {
    await this.expirePendingOrders({ id: orderId, purchaserUserId: user.userId });
    const order = await this.prisma.order.findFirst({ where: { id: orderId, purchaserUserId: user.userId } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (!['DRAFT', 'PENDING_PAYMENT'].includes(order.status)) {
      throw new ForbiddenException('Pesanan ini tidak dapat dibatalkan');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.paymentAttempt.updateMany({
        where: { orderId, status: { in: ['CREATED', 'PENDING', 'AUTHORIZED'] } },
        data: { status: 'CANCELLED' },
      });
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: orderInclude,
      });
      await tx.billingAuditEvent.create({
        data: {
          organizationId: user.organizationId ?? null,
          actorId: user.userId,
          action: 'ORDER_CANCELLED',
          resource: 'order',
          resourceId: orderId,
          safeDetails: { orderNumber: order.orderNumber },
        },
      });
      return updated;
    });
    return this.toResponse(cancelled);
  }

  private toResponse(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotalAmount: order.subtotalAmount.toString(),
      discountAmount: order.discountAmount.toString(),
      feeAmount: order.feeAmount.toString(),
      totalAmount: order.totalAmount.toString(),
      paymentExpiresAt: order.paymentExpiresAt,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt,
      items: order.items.map((item) => ({
        id: item.id,
        quantityOrSeats: item.quantityOrSeats,
        unitAmount: item.unitAmount.toString(),
        lineTotal: item.lineTotal.toString(),
        accessStartsAt: item.accessStartsAt,
        accessEndsAt: item.accessEndsAt,
        plan: item.accessPlan,
        offer: item.planOffer,
        beneficiaries: item.beneficiaries,
        accessGrants: item.accessGrants,
      })),
      pricingUnit: 'PER_STUDENT',
      payment: order.paymentAttempts[0]
        ? { ...order.paymentAttempts[0], requestedAmount: order.paymentAttempts[0].requestedAmount.toString() }
        : null,
      paymentInstructions: order.status === 'PENDING_PAYMENT' && !isPendingPaymentExpired(order.status, order.paymentExpiresAt)
        ? {
            method: 'BANK_TRANSFER',
            ...paymentAccount,
            baseAmount: order.subtotalAmount.toString(),
            uniqueCode: Number(order.feeAmount.toString()),
            transferAmount: order.totalAmount.toString(),
            expiresAt: order.paymentExpiresAt,
          }
        : null,
      nextAction: order.status === 'PENDING_PAYMENT' && !isPendingPaymentExpired(order.status, order.paymentExpiresAt)
        ? {
            type: 'BANK_TRANSFER',
            message: `Transfer tepat sesuai total hingga kode unik ke ${paymentAccount.bankName} ${paymentAccount.accountNumber} a.n. ${paymentAccount.accountHolder}. Akses aktif setelah pembayaran terverifikasi.`,
          }
        : null,
    };
  }

  private toAdminResponse(
    order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
    identityById: Map<string, any>,
  ) {
    const beneficiaryUserId = order.items
      .flatMap((item) => [
        ...item.accessGrants.map((grant) => grant.userId),
        ...item.beneficiaries.map((beneficiary) => beneficiary.userId),
      ])
      .find((userId): userId is string => Boolean(userId));
    return {
      ...this.toResponse(order),
      purchaser: this.identitySummary(identityById.get(order.purchaserUserId)),
      beneficiary: beneficiaryUserId ? this.identitySummary(identityById.get(beneficiaryUserId)) : null,
    };
  }

  private identitySummary(identity: any) {
    if (!identity) return null;
    return {
      userId: identity.id,
      email: identity.email,
      fullName: identity.student?.fullName || [identity.firstName, identity.lastName].filter(Boolean).join(' '),
      studentNumber: identity.student?.studentNumber ?? null,
      schoolId: identity.student?.schoolId ?? null,
      schoolName: identity.student?.school?.name ?? null,
      isStudent: Boolean(identity.student),
    };
  }

  private requireOrganization(user: CommerceUser) {
    if (!user.organizationId) throw new ForbiddenException('Konteks organisasi diperlukan');
    return user.organizationId;
  }

  private async expirePendingOrders(scope: Prisma.OrderWhereInput) {
    const now = new Date();
    const candidates = await this.prisma.order.findMany({
      where: {
        AND: [
          scope,
          { status: 'PENDING_PAYMENT' },
          { paymentExpiresAt: { lte: now } },
        ],
      },
      select: { id: true },
    });

    for (const candidate of candidates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candidate.id}))`;
        const order = await tx.order.findFirst({
          where: { id: candidate.id, status: 'PENDING_PAYMENT' },
          select: { id: true, orderNumber: true, organizationId: true, paymentExpiresAt: true },
        });
        if (!order || !isPendingPaymentExpired('PENDING_PAYMENT', order.paymentExpiresAt, now)) return;
        await this.markOrderExpired(tx, order, now);
      });
    }
  }

  private async markOrderExpired(
    tx: Prisma.TransactionClient,
    order: { id: string; orderNumber: string; organizationId: string | null },
    now: Date,
  ) {
    await tx.order.update({ where: { id: order.id }, data: { status: 'EXPIRED' } });
    await tx.paymentAttempt.updateMany({
      where: { orderId: order.id, status: { in: ['CREATED', 'PENDING', 'AUTHORIZED'] } },
      data: { status: 'EXPIRED', failedAt: now, failureCode: 'PAYMENT_DEADLINE_EXPIRED' },
    });
    await tx.billingAuditEvent.create({
      data: {
        organizationId: order.organizationId,
        action: 'ORDER_EXPIRED',
        resource: 'order',
        resourceId: order.id,
        safeDetails: { orderNumber: order.orderNumber, expiredAt: now.toISOString() },
      },
    });
  }

  private async allocateUniqueCode(tx: Prisma.TransactionClient, now: Date, currency: string, amount: Prisma.Decimal) {
    // Serialize allocation so concurrent checkouts cannot receive the same
    // three-digit code for the same base amount while both remain active.
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(3151262625::bigint)');
    const active = await tx.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        paymentExpiresAt: { gt: now },
        currency,
        subtotalAmount: amount,
        feeAmount: { gt: 0 },
      },
      select: { feeAmount: true },
    });
    const used = new Set(active.map((order) => Number(order.feeAmount.toString())));
    const start = randomInt(1, 1000);
    for (let offset = 0; offset < 999; offset += 1) {
      const candidate = ((start + offset - 1) % 999) + 1;
      if (!used.has(candidate)) return candidate;
    }
    throw new ConflictException('Kode unik pembayaran sedang penuh. Coba lagi setelah pesanan lain kedaluwarsa.');
  }

  private async ensurePaymentCode(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(3151262625::bigint)');
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const isActiveWithoutCode = current.status === 'PENDING_PAYMENT'
        && Number(current.feeAmount.toString()) === 0
        && Boolean(current.paymentExpiresAt && current.paymentExpiresAt > new Date());

      if (isActiveWithoutCode) {
        const uniqueCode = await this.allocateUniqueCode(tx, new Date(), current.currency, current.subtotalAmount);
        const totalAmount = current.totalAmount.plus(uniqueCode);
        await tx.order.update({
          where: { id: current.id },
          data: { feeAmount: uniqueCode, totalAmount },
        });
        await tx.paymentAttempt.updateMany({
          where: { orderId: current.id, status: { in: ['CREATED', 'PENDING', 'AUTHORIZED'] } },
          data: { requestedAmount: totalAmount },
        });
        await tx.billingAuditEvent.create({
          data: {
            organizationId: current.organizationId,
            actorId: current.purchaserUserId,
            action: 'PAYMENT_UNIQUE_CODE_ASSIGNED',
            resource: 'order',
            resourceId: current.id,
            safeDetails: { uniqueCode, totalAmount: totalAmount.toString(), currency: current.currency },
          },
        });
      }

      return tx.order.findUniqueOrThrow({ where: { id: current.id }, include: orderInclude });
    });
  }
}
