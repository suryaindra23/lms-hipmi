import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateTotpSecret, totp, verifyTotp } from './totp.util';

describe('TOTP MFA', () => {
  it('generates base32 secrets and verifies current or adjacent time windows', () => {
    const secret = generateTotpSecret();
    assert.match(secret, /^[A-Z2-7]{32}$/);
    const now = Date.UTC(2026, 7, 6, 10, 0, 0);
    assert.equal(verifyTotp(totp(secret, now), secret, now), true);
    assert.equal(verifyTotp(totp(secret, now - 30_000), secret, now), true);
    assert.equal(verifyTotp('000000', secret, now), false);
  });
});
