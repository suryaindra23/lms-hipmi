import { Injectable } from '@nestjs/common';

type RequestMetric = { at: number; status: number; durationMs: number; route: string };

@Injectable()
export class ObservabilityService {
  private readonly startedAt = Date.now();
  private readonly requests: RequestMetric[] = [];
  private readonly retentionMs = 60 * 60 * 1000;
  private readonly maxSamples = 10_000;

  recordHttp(status: number, durationMs: number, route: string) {
    const now = Date.now();
    this.requests.push({ at: now, status, durationMs, route });
    while (this.requests.length > this.maxSamples || this.requests[0]?.at < now - this.retentionMs) this.requests.shift();
  }

  snapshot(windowMinutes = 15) {
    const cutoff = Date.now() - Math.max(1, Math.min(windowMinutes, 60)) * 60_000;
    const samples = this.requests.filter((sample) => sample.at >= cutoff);
    const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const errors = samples.filter((sample) => sample.status >= 500).length;
    const clientErrors = samples.filter((sample) => sample.status >= 400 && sample.status < 500).length;
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      windowMinutes,
      requests: samples.length,
      serverErrors: errors,
      clientErrors,
      errorRate: samples.length ? Number((errors / samples.length).toFixed(4)) : 0,
      latencyMs: {
        p50: percentile(durations, 0.5),
        p95: percentile(durations, 0.95),
        max: durations[durations.length - 1] || 0,
      },
    };
  }
}

function percentile(sorted: number[], ratio: number) {
  if (!sorted.length) return 0;
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] * 10) / 10;
}
