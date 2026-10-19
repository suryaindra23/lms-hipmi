import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CommerceService } from './commerce.service';

test('expired orders cannot be approved and are persisted as expired', async () => {
  const updates: Array<{ target: string; data: unknown }> = [];
  let accessGrantCreated = false;
  const expiredOrder = {
    id: 'order-expired',
    orderNumber: 'SA-EXPIRED',
    organizationId: 'org-1',
    status: 'PENDING_PAYMENT',
    paymentExpiresAt: new Date(Date.now() - 60_000),
  };
  const tx = {
    $executeRaw: async () => 0,
    order: {
      findFirst: async () => expiredOrder,
      update: async ({ data }: any) => {
        updates.push({ target: 'order', data });
        return { ...expiredOrder, ...data };
      },
    },
    paymentAttempt: {
      updateMany: async ({ data }: any) => {
        updates.push({ target: 'payment', data });
        return { count: 1 };
      },
    },
    billingAuditEvent: {
      create: async ({ data }: any) => {
        updates.push({ target: 'audit', data });
        return data;
      },
    },
    accessGrant: {
      create: async () => {
        accessGrantCreated = true;
        throw new Error('expired order must not create an access grant');
      },
    },
  };
  const prisma = {
    order: { findMany: async () => [] },
    student: {
      findFirst: async () => ({ userId: 'student-1', schoolId: 'school-1', fullName: 'Siswa Uji' }),
    },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  };
  const service = new CommerceService(prisma as any, { invalidateOrganizationAccess: async () => undefined } as any);

  await assert.rejects(
    service.approveOrder(
      { userId: 'admin-1', organizationId: 'org-1', schoolAccess: { organizationWide: true } },
      expiredOrder.id,
      { beneficiaryUserId: 'student-1', paymentReference: 'MUTASI-001', note: 'Nominal dan pengirim sesuai' },
    ),
    (error: unknown) => error instanceof ConflictException,
  );

  assert.equal(accessGrantCreated, false);
  assert.deepEqual(updates.find((entry) => entry.target === 'order')?.data, { status: 'EXPIRED' });
  assert.equal((updates.find((entry) => entry.target === 'payment')?.data as any).status, 'EXPIRED');
  assert.equal((updates.find((entry) => entry.target === 'audit')?.data as any).action, 'ORDER_EXPIRED');
});

test('the purchaser cannot approve their own manual payment', async () => {
  const order = {
    id: 'order-self-approval',
    orderNumber: 'SA-SELF',
    organizationId: 'org-1',
    purchaserUserId: 'admin-1',
    status: 'PENDING_PAYMENT',
    paymentExpiresAt: new Date(Date.now() + 60_000),
    items: [],
  };
  const tx = {
    $executeRaw: async () => 0,
    order: { findFirst: async () => order },
    paymentAttempt: { findFirst: async () => null },
  };
  const prisma = {
    order: { findMany: async () => [] },
    student: { findFirst: async () => ({ userId: 'student-1', schoolId: 'school-1', fullName: 'Siswa Uji' }) },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  };
  const service = new CommerceService(prisma as any, { invalidateOrganizationAccess: async () => undefined } as any);

  await assert.rejects(
    service.approveOrder(
      { userId: 'admin-1', organizationId: 'org-1', schoolAccess: { organizationWide: true } },
      order.id,
      { beneficiaryUserId: 'student-1', paymentReference: 'MUTASI-SELF', note: 'Nominal dan pengirim sesuai' },
    ),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('a settled bank reference cannot be replayed for another order', async () => {
  const order = {
    id: 'order-replayed-reference',
    orderNumber: 'SA-REPLAY',
    organizationId: 'org-1',
    purchaserUserId: 'student-1',
    status: 'PENDING_PAYMENT',
    paymentExpiresAt: new Date(Date.now() + 60_000),
    items: [],
  };
  const tx = {
    $executeRaw: async () => 0,
    order: { findFirst: async () => order },
    paymentAttempt: { findFirst: async () => ({ orderId: 'another-order' }) },
  };
  const prisma = {
    order: { findMany: async () => [] },
    student: { findFirst: async () => ({ userId: 'student-1', schoolId: 'school-1', fullName: 'Siswa Uji' }) },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  };
  const service = new CommerceService(prisma as any, { invalidateOrganizationAccess: async () => undefined } as any);

  await assert.rejects(
    service.approveOrder(
      { userId: 'admin-2', organizationId: 'org-1', schoolAccess: { organizationWide: true } },
      order.id,
      { beneficiaryUserId: 'student-1', paymentReference: 'MUTASI-DUPLIKAT', note: 'Nominal dan pengirim sesuai' },
    ),
    (error: unknown) => error instanceof ConflictException,
  );
});
