import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ObservabilityService } from './observability.service';

describe('operational metrics', () => {
  it('calculates latency percentiles and server error rate', () => {
    const metrics = new ObservabilityService();
    [10, 20, 30, 40].forEach((duration, index) => metrics.recordHttp(index === 3 ? 500 : 200, duration, '/api/v1/test'));
    const snapshot = metrics.snapshot(15);
    assert.equal(snapshot.requests, 4);
    assert.equal(snapshot.serverErrors, 1);
    assert.equal(snapshot.errorRate, 0.25);
    assert.equal(snapshot.latencyMs.p50, 20);
    assert.equal(snapshot.latencyMs.p95, 40);
  });
});
