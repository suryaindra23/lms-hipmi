import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { inspectFileBuffer, validateUploadMetadata } from './file-security.utils';

describe('upload abuse protection', () => {
  it('accepts metadata only when MIME, extension, and size agree', () => {
    assert.deepEqual(
      validateUploadMetadata('bukti.JPEG', 'image/jpeg', 1024, ['image/jpeg'], 2048),
      { normalizedFileName: 'bukti.JPEG', extension: '.jpeg' },
    );
  });

  it('rejects traversal, double-extension, mismatched MIME, and oversized files', () => {
    const cases: Array<() => unknown> = [
      () => validateUploadMetadata('../bukti.jpg', 'image/jpeg', 100, ['image/jpeg'], 1000),
      () => validateUploadMetadata('bukti.jpg.exe', 'image/jpeg', 100, ['image/jpeg'], 1000),
      () => validateUploadMetadata('bukti.pdf', 'image/jpeg', 100, ['image/jpeg'], 1000),
      () => validateUploadMetadata('bukti.jpg', 'image/jpeg', 1001, ['image/jpeg'], 1000),
    ];
    cases.forEach((run) => assert.throws(run, BadRequestException));
  });

  it('rejects spoofed signatures, EICAR, and active PDF content', () => {
    assert.equal(inspectFileBuffer(Buffer.from('not-a-jpeg'), 'image/jpeg', 1024).reason, 'FILE_SIGNATURE_MISMATCH');
    assert.equal(
      inspectFileBuffer(Buffer.from('%PDF-1.7 EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), 'application/pdf', 1024).reason,
      'MALWARE_SIGNATURE',
    );
    assert.equal(inspectFileBuffer(Buffer.from('%PDF-1.7 /JavaScript'), 'application/pdf', 1024).reason, 'ACTIVE_CONTENT');
  });

  it('accepts a signature-valid inert PNG', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    assert.deepEqual(inspectFileBuffer(png, 'image/png', 1024), { clean: true });
  });
});
