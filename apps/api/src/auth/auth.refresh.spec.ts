import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

test('a concurrent refresh does not revoke the newly rotated session family', async () => {
  let familyRevocations = 0;
  const prisma = {
    userSession: {
      findUnique: async () => ({
        id: 'old-session',
        familyId: 'family-1',
        revokedAt: new Date(),
        rotatedAt: new Date(),
        revokeReason: 'ROTATED',
      }),
      updateMany: async () => {
        familyRevocations += 1;
        return { count: 1 };
      },
    },
  };
  const service = new AuthService(prisma as any, {} as any, {} as any, {} as any);

  await assert.rejects(service.refreshToken('already-rotated'), UnauthorizedException);
  assert.equal(familyRevocations, 0);
});
test('an old rotated refresh token still triggers reuse protection', async () => {
  let familyRevocations = 0;
  const prisma = {
    userSession: {
      findUnique: async () => ({
        id: 'old-session',
        familyId: 'family-1',
        revokedAt: new Date(Date.now() - 60_000),
        rotatedAt: new Date(Date.now() - 60_000),
        revokeReason: 'ROTATED',
      }),
      updateMany: async () => {
        familyRevocations += 1;
        return { count: 1 };
      },
    },
  };
  const service = new AuthService(prisma as any, {} as any, {} as any, {} as any);

  await assert.rejects(service.refreshToken('reused-later'), UnauthorizedException);
  assert.equal(familyRevocations, 1);
});
