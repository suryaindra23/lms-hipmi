import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService tenant scope', () => {
  it('adds school membership scope to list queries for school admins', async () => {
    let capturedWhere: any;
    const prisma = {
      user: {
        findMany: async (args: any) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    };
    const service = new UsersService(prisma as any);

    await service.findAll({
      organizationId: 'org-1',
      schoolId: 'school-a',
      organizationWide: false,
      page: 1,
      pageSize: 20,
    });

    assert.equal(capturedWhere.AND[0].organizationId, 'org-1');
    assert.ok(capturedWhere.AND[0].OR.some((clause: any) => clause.userRoles?.some?.schoolId === 'school-a'));
    assert.ok(capturedWhere.AND[0].OR.some((clause: any) => clause.student?.is?.schoolId === 'school-a'));
  });

  it('allows organization-wide users to list the organization without selecting a school', async () => {
    let capturedWhere: any;
    const prisma = {
      user: {
        findMany: async (args: any) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    };
    const service = new UsersService(prisma as any);

    await service.findAll({
      organizationId: 'org-1',
      organizationWide: true,
      page: 1,
      pageSize: 20,
    });

    assert.deepEqual(capturedWhere.AND[0], { organizationId: 'org-1' });
  });

  it('rejects an unscoped school-level request', async () => {
    const service = new UsersService({ user: {} } as any);
    await assert.rejects(
      service.findAll({ organizationId: 'org-1', organizationWide: false, page: 1, pageSize: 20 }),
      ForbiddenException,
    );
  });

  it('does not update a user outside the selected school', async () => {
    const prisma = {
      user: { findFirst: async () => null },
      userSession: {},
    };
    const service = new UsersService(prisma as any);
    await assert.rejects(
      service.updateStatus(
        'user-b',
        { organizationId: 'org-1', schoolId: 'school-a', organizationWide: false },
        'ARCHIVED',
        'admin-a',
      ),
      NotFoundException,
    );
  });
});
