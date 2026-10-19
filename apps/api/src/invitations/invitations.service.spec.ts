import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

describe('InvitationsService role delegation', () => {
  it('prevents a school admin from granting an organization-wide role', async () => {
    const prisma = {
      role: {
        findFirst: async () => ({ id: 'role-program-manager', slug: 'program-manager' }),
      },
    };
    const service = new InvitationsService(prisma as any, {} as any, {} as any);

    await assert.rejects(
      service.create(
        {
          email: 'manager@example.com',
          firstName: 'Program',
          lastName: 'Manager',
          roleSlug: 'program-manager',
        },
        {
          organizationId: 'org-1',
          schoolId: 'school-a',
          userId: 'admin-a',
          schoolAccess: { organizationWide: false, schoolIds: ['school-a'] },
        },
      ),
      ForbiddenException,
    );
  });

  it('limits school administrators to ordinary school user roles', async () => {
    const prisma = {
      role: {
        findFirst: async () => ({ id: 'role-school-admin', slug: 'school-admin' }),
      },
    };
    const service = new InvitationsService(prisma as any, {} as any, {} as any);

    await assert.rejects(
      service.create(
        {
          email: 'another-admin@example.com',
          firstName: 'Another',
          lastName: 'Admin',
          roleSlug: 'school-admin',
          schoolId: 'school-a',
        },
        {
          organizationId: 'org-1',
          schoolId: 'school-a',
          userId: 'admin-a',
          roles: ['school-admin'],
          schoolAccess: { organizationWide: false, schoolIds: ['school-a'] },
        },
      ),
      ForbiddenException,
    );
  });
});
