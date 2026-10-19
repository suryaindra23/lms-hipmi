import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

function context(user: any): any {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

function guard(required: Array<{ resource: string; action: string }>) {
  return new PermissionsGuard({ getAllAndOverride: () => required } as any);
}

test('permission guard allows an exact resource/action grant', () => {
  const allowed = guard([{ resource: 'master-data', action: 'read' }]).canActivate(
    context({ roles: ['school-admin'], permissions: [{ resource: 'master-data', action: 'read' }] }),
  );
  assert.equal(allowed, true);
});

test('permission guard rejects a different action on the same resource', () => {
  assert.throws(
    () => guard([{ resource: 'master-data', action: 'update' }]).canActivate(
      context({ roles: ['teacher'], permissions: [{ resource: 'master-data', action: 'read' }] }),
    ),
    ForbiddenException,
  );
});

test('super admin bypass remains explicit', () => {
  assert.equal(
    guard([{ resource: 'master-data', action: 'delete' }]).canActivate(
      context({ roles: ['super-admin'], permissions: [] }),
    ),
    true,
  );
});

test('privileged mutation requires a verified MFA session when enforcement is enabled', () => {
  const previous = process.env.REQUIRE_ADMIN_MFA;
  process.env.REQUIRE_ADMIN_MFA = 'true';
  try {
    assert.throws(
      () => guard([{ resource: 'identity', action: 'verify' }]).canActivate(
        context({ roles: ['super-admin'], permissions: [], mfaVerified: false }),
      ),
      ForbiddenException,
    );
    assert.equal(
      guard([{ resource: 'identity', action: 'verify' }]).canActivate(
        context({ roles: ['super-admin'], permissions: [], mfaVerified: true }),
      ),
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_ADMIN_MFA;
    else process.env.REQUIRE_ADMIN_MFA = previous;
  }
});

test('reading an identity document is treated as a sensitive MFA-protected action', () => {
  const previous = process.env.REQUIRE_ADMIN_MFA;
  process.env.REQUIRE_ADMIN_MFA = 'true';
  try {
    assert.throws(
      () => guard([{ resource: 'identity.document', action: 'read' }]).canActivate(
        context({
          roles: ['identity-verifier'],
          permissions: [{ resource: 'identity.document', action: 'read' }],
          mfaVerified: false,
        }),
      ),
      ForbiddenException,
    );
  } finally {
    process.env.REQUIRE_ADMIN_MFA = previous;
  }
});
