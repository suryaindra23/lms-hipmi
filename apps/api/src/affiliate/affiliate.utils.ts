import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

export const AFFILIATE_PLATFORMS = ['TIKTOK', 'SHOPEE', 'INSTAGRAM', 'YOUTUBE'] as const;
export type AffiliatePlatform = (typeof AFFILIATE_PLATFORMS)[number];

const PLATFORM_HOSTS: Record<AffiliatePlatform, string[]> = {
  TIKTOK: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'],
  SHOPEE: ['shopee.co.id', 'www.shopee.co.id', 'shopee.com', 'www.shopee.com', 's.shopee.co.id'],
  INSTAGRAM: ['instagram.com', 'www.instagram.com'],
  YOUTUBE: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
};

const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'igshid', 'spm', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term']);

export function normalizeAffiliateUrl(value: string, platform: AffiliatePlatform): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException('URL konten tidak valid');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestException('URL konten harus menggunakan HTTP atau HTTPS');
  if (url.username || url.password) throw new BadRequestException('URL konten tidak boleh memuat kredensial');
  const hostname = url.hostname.toLowerCase();
  if (!PLATFORM_HOSTS[platform].includes(hostname)) {
    throw new BadRequestException(`Domain URL tidak sesuai dengan platform ${platform}`);
  }
  url.protocol = 'https:';
  url.hostname = hostname;
  url.hash = '';
  const searchKeys: string[] = [];
  url.searchParams.forEach((_value, key) => searchKeys.push(key));
  for (const key of searchKeys) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  if (url.pathname !== '/' && url.searchParams.size === 0) url.search = '';
  return url.toString().replace(/\/$/, '');
}

export function normalizePublicUrl(value: string, label = 'URL bukti'): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException(`${label} tidak valid`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestException(`${label} harus menggunakan HTTP atau HTTPS`);
  if (url.username || url.password) throw new BadRequestException(`${label} tidak boleh memuat kredensial`);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isPrivateHostname(hostname)) throw new BadRequestException(`${label} harus mengarah ke alamat publik`);
  url.protocol = 'https:';
  url.hostname = hostname;
  url.hash = '';
  return url.toString();
}

export function extractAffiliateUsername(normalizedUrl: string, platform: AffiliatePlatform): string | undefined {
  const segments = new URL(normalizedUrl).pathname.split('/').filter(Boolean);
  if (platform === 'TIKTOK' && segments[0]?.startsWith('@')) return segments[0].slice(1).toLowerCase();
  if (platform === 'INSTAGRAM' && segments[0] && !['p', 'reel', 'reels'].includes(segments[0])) return segments[0].replace(/^@/, '').toLowerCase();
  return undefined;
}

function isPrivateHostname(hostname: string) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
  if (hostname === 'metadata.google.internal' || hostname === '169.254.169.254') return true;
  const version = isIP(hostname);
  if (version === 4) {
    const [a, b] = hostname.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (version === 6) {
    const lower = hostname.toLowerCase();
    return lower === '::' || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || lower.startsWith('::ffff:127.') || lower.startsWith('::ffff:10.') || lower.startsWith('::ffff:192.168.');
  }
  return false;
}

export function extractAffiliateExternalId(normalizedUrl: string, platform: AffiliatePlatform): string | undefined {
  const url = new URL(normalizedUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  if (platform === 'YOUTUBE') return url.hostname === 'youtu.be' ? segments[0] : url.searchParams.get('v') || segments[segments.length - 1];
  if (platform === 'TIKTOK') {
    const videoIndex = segments.indexOf('video');
    return videoIndex >= 0 ? segments[videoIndex + 1] : undefined;
  }
  if (platform === 'INSTAGRAM') return ['reel', 'reels', 'p'].includes(segments[0]) ? segments[1] : undefined;
  return segments[segments.length - 1];
}

export interface MetricInput {
  views: number;
  clicks: number;
  orders: number;
  gmv: number;
  commission: number;
  unitsSold?: number;
  refunds?: number;
}

export function deriveAffiliateMetrics(input: MetricInput) {
  return {
    ctr: input.views > 0 ? (input.clicks / input.views) * 100 : 0,
    conversionRate: input.clicks > 0 ? (input.orders / input.clicks) * 100 : 0,
    averageOrderValue: input.orders > 0 ? input.gmv / input.orders : 0,
    commissionRate: input.gmv > 0 ? (input.commission / input.gmv) * 100 : 0,
  };
}

export function detectAffiliateDataFlags(
  input: MetricInput & { evidenceUrl?: string; snapshotDate: Date },
  previous?: MetricInput & { views: number; snapshotDate: Date },
  duplicateTimestamp = false,
): string[] {
  const flags: string[] = [];
  if (input.clicks > input.views) flags.push('CLICK_EXCEEDS_VIEWS');
  if (input.orders > input.clicks) flags.push('ORDERS_EXCEED_CLICKS');
  if ((input.refunds || 0) > input.orders) flags.push('REFUNDS_EXCEED_ORDERS');
  if ((input.unitsSold || 0) < input.orders) flags.push('UNITS_BELOW_ORDERS');
  if (input.orders === 0 && input.gmv > 0) flags.push('GMV_WITHOUT_ORDERS');
  if (input.gmv === 0 && input.commission > 0) flags.push('COMMISSION_WITHOUT_GMV');
  if (input.gmv > 0 && input.commission / input.gmv > 0.5) flags.push('SUSPICIOUS_COMMISSION_RATE');
  if (!input.evidenceUrl) flags.push('EVIDENCE_MISSING');
  if (duplicateTimestamp) flags.push('DUPLICATE_TIMESTAMP');
  if (previous && input.snapshotDate > previous.snapshotDate) {
    if (input.views < previous.views || input.clicks < previous.clicks || input.orders < previous.orders || input.gmv < previous.gmv || input.commission < previous.commission) {
      flags.push('LIFETIME_METRIC_DECREASE');
    }
    if (previous.views > 0 && input.views > previous.views * 10 && input.views - previous.views > 1_000) flags.push('EXTREME_CHANGE');
  }
  return [...new Set(flags)];
}

export function roundMetric(value: number) {
  return Number(value.toFixed(2));
}
