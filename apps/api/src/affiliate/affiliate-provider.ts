import { AffiliatePlatform } from './affiliate.utils';

export interface AffiliateProviderSnapshot {
  capturedAt: Date;
  rawValues: Record<string, string | number | null>;
}

export interface AffiliateProviderAdapter {
  readonly platform: AffiliatePlatform;
  readonly supportsOAuth: boolean;
  readonly supportsMetricSync: boolean;
  fetchSnapshot?(externalAccountId: string, contentExternalId: string): Promise<AffiliateProviderSnapshot>;
}

export const AFFILIATE_PROVIDER_CAPABILITIES: AffiliateProviderAdapter[] = [
  { platform: 'TIKTOK', supportsOAuth: false, supportsMetricSync: false },
  { platform: 'SHOPEE', supportsOAuth: false, supportsMetricSync: false },
  { platform: 'INSTAGRAM', supportsOAuth: false, supportsMetricSync: false },
  { platform: 'YOUTUBE', supportsOAuth: false, supportsMetricSync: false },
];
