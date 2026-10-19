import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IdentityDocumentsService } from './identity.service';

const context = { userId: 'student-user', studentId: 'student-a', organizationId: 'org-a', schoolId: 'school-a' };

describe('IdentityDocumentsService sensitive workflow', () => {
  it('rejects a stale or cross-tenant student context before creating an upload URL', async () => {
    const prisma = { student: { findFirst: async () => null } };
    const service = new IdentityDocumentsService(prisma as any, {} as any, {} as any, {} as any);
    await assert.rejects(
      service.createUploadUrl(context, { fileName: 'identity.pdf', mimeType: 'application/pdf', sizeBytes: 100 }),
      ForbiddenException,
    );
  });

  it('requires guardian consent for a minor before touching the uploaded object', async () => {
    const prisma = {
      student: { findFirst: async () => ({ id: 'student-a', birthDate: new Date() }) },
      identityDocument: { count: async () => 0 },
      consent: { count: async () => 0 },
    };
    const service = new IdentityDocumentsService(prisma as any, {} as any, {} as any, {} as any);
    await assert.rejects(
      service.submit(context, {
        nik: '3174000012345678',
        type: 'KIA',
        storageKey: 'org-a/school-a/student-a/file.png',
        fileName: 'file.png',
        mimeType: 'image/png',
        sizeBytes: 100,
        consent: true,
      }),
      ForbiddenException,
    );
  });

  it('prevents a second submission while an active document exists', async () => {
    const prisma = {
      student: { findFirst: async () => ({ id: 'student-a', birthDate: new Date('2000-01-01') }) },
      identityDocument: { count: async () => 1 },
    };
    const service = new IdentityDocumentsService(prisma as any, {} as any, {} as any, {} as any);
    await assert.rejects(
      service.submit(context, {
        nik: '3174000012345678',
        type: 'KTP',
        storageKey: 'org-a/school-a/student-a/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        consent: true,
      }),
      ConflictException,
    );
  });

  it('only permits a decision for a clean document still pending verification', async () => {
    let capturedWhere: any;
    const prisma = {
      identityDocument: {
        findFirst: async (args: any) => {
          capturedWhere = args.where;
          return null;
        },
      },
    };
    const service = new IdentityDocumentsService(prisma as any, {} as any, {} as any, {} as any);
    await assert.rejects(
      service.updateStatus('document-a', 'VALID', undefined, undefined, 'verifier-a', 'org-a', 'school-a'),
      NotFoundException,
    );
    assert.equal(capturedWhere.documentStatus, 'PENDING_VERIFICATION');
    assert.equal(capturedWhere.scanStatus, 'CLEAN');
  });
});
