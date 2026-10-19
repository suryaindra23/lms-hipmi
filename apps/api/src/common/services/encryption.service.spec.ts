import assert from 'node:assert/strict';
import test from 'node:test';
import { EncryptionService } from './encryption.service';

test('sensitive values encrypt with randomized ciphertext and decrypt correctly', () => {
  const service = new EncryptionService();
  const first = service.encrypt('9999000012345678');
  const second = service.encrypt('9999000012345678');
  assert.notEqual(first, second);
  assert.equal(service.decrypt(first), '9999000012345678');
});

test('blind index is deterministic, normalized, and namespaced', () => {
  const service = new EncryptionService();
  assert.equal(service.blindIndex(' 9912345678 ', 'NISN'), service.blindIndex('9912345678', 'NISN'));
  assert.notEqual(service.blindIndex('9912345678', 'NISN'), service.blindIndex('9912345678', 'NIK'));
  assert.doesNotMatch(service.blindIndex('9912345678', 'NISN'), /9912345678/);
});
