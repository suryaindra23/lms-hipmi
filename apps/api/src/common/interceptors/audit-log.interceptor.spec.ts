import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditLogInterceptor, resourceFromUrl } from './audit-log.interceptor';

function context(request: any): any {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe('tamper-resistant audit trail', () => {
  it('extracts the resource after the API version', () => {
    assert.equal(resourceFromUrl('/api/v1/students/123?token=hidden'), 'students');
  });

  it('records successful and failed mutations without body values', async () => {
    const records: any[] = [];
    const interceptor = new AuditLogInterceptor({ log: async (record: any) => records.push(record) } as any);
    const request = {
      method: 'POST', originalUrl: '/api/v1/students', body: { fullName: 'Rahasia', password: 'secret' },
      params: {}, ip: '127.0.0.1', requestId: 'req-1', user: { userId: 'actor', organizationId: 'org', schoolId: 'school' },
      get: () => 'agent',
    };
    await lastValueFrom(interceptor.intercept(context(request), { handle: () => of({ id: 'student-1' }) } as any));
    await assert.rejects(() => lastValueFrom(interceptor.intercept(context(request), { handle: () => throwError(() => new BadRequestException('bad')) } as any)));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(records.length, 2);
    assert.deepEqual(records[0].details.request, { fields: ['fullName'] });
    assert.equal(records[0].details.outcome, 'SUCCESS');
    assert.equal(records[1].details.outcome, 'FAILURE');
    assert.equal(records[1].details.statusCode, 400);
    assert.equal(records[0].correlationId, 'req-1');
  });
});
