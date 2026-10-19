import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncryptionService } from '../common/services/encryption.service';
import { prepareStudentImportPayload } from './imports.service';

describe('student import staging payload', () => {
  it('encrypts NISN before a row is persisted', () => {
    const encryption = new EncryptionService();
    const payload = prepareStudentImportPayload(
      {
        email: ' Student@Example.com ',
        studentNumber: ' 001 ',
        fullName: ' Siswa Contoh ',
        nisn: '1234567890',
      },
      encryption,
    );

    assert.equal(payload.email, 'student@example.com');
    assert.equal(payload.studentNumber, '001');
    assert.equal(payload.fullName, 'Siswa Contoh');
    assert.equal(payload.nisnLast4, '7890');
    assert.equal(encryption.decrypt(payload.nisnEncrypted), '1234567890');
    assert.equal(JSON.stringify(payload).includes('1234567890'), false);
    assert.equal(Object.hasOwn(payload, 'nisn'), false);
  });
});
