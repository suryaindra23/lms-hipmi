import assert from 'node:assert/strict';
import test from 'node:test';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { TENANT_KEY, TenantGuard } from './tenant.guard';

function context(request: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function createGuard(allowedSchoolId = 'school-a') {
  const prisma = {
    school: {
      count: async ({ where }: any) =>
        where.id === allowedSchoolId && where.organizationId === 'org-a' ? 1 : 0,
    },
  };
  return new TenantGuard(new Reflector(), prisma as any);
}

test('tenant guard attaches a verified tenant context', async () => {
  const request: any = {
    user: { organizationId: 'org-a', schoolId: 'school-a', roles: ['teacher'] },
    params: {},
    query: {},
    body: {},
  };
  assert.equal(await createGuard().canActivate(context(request)), true);
  assert.deepEqual(request[TENANT_KEY], { organizationId: 'org-a', schoolId: 'school-a' });
});

test('tenant guard rejects cross-school access', async () => {
  const request: any = {
    user: { organizationId: 'org-a', schoolId: 'school-a', roles: ['teacher'] },
    params: {},
    query: { schoolId: 'school-b' },
    body: {},
  };
  await assert.rejects(() => createGuard().canActivate(context(request)), ForbiddenException);
});

test('tenant guard rejects schools outside the organization for organization admins', async () => {
  const request: any = {
    user: { organizationId: 'org-a', roles: ['super-admin'] },
    params: {},
    query: { schoolId: 'school-b' },
    body: {},
  };
  await assert.rejects(() => createGuard().canActivate(context(request)), ForbiddenException);
});

test('tenant guard applies an allowed school selected by an organization administrator', async () => {
  const request: any = {
    user: {
      organizationId: 'org-a',
      roles: ['super-admin'],
      schoolAccess: { organizationWide: true, schoolIds: [] },
    },
    params: {},
    query: { schoolId: 'school-a' },
    body: {},
  };
  assert.equal(await createGuard().canActivate(context(request)), true);
  assert.equal(request.user.schoolId, 'school-a');
  assert.deepEqual(request[TENANT_KEY], { organizationId: 'org-a', schoolId: 'school-a' });
});

test('tenant guard rejects organization switching through request body', async () => {
  const request: any = {
    user: { organizationId: 'org-a', schoolId: 'school-a', roles: ['school-admin'] },
    params: {}, query: {}, body: { organizationId: 'org-b' },
  };
  await assert.rejects(() => createGuard().canActivate(context(request)), ForbiddenException);
});

test('tenant guard rejects school switching through route params', async () => {
  const request: any = {
    user: { organizationId: 'org-a', schoolId: 'school-a', roles: ['teacher'] },
    params: { schoolId: 'school-b' }, query: {}, body: {},
  };
  await assert.rejects(() => createGuard().canActivate(context(request)), ForbiddenException);
});
