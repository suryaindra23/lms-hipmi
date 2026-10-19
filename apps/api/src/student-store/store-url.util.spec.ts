import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { normalizePublicStoreUrl } from './store-url.util';

describe('normalizePublicStoreUrl', () => {
  it('normalizes a supported public URL without tracking data', () => {
    assert.equal(
      normalizePublicStoreUrl('http://seller.shopee.co.id/demo/?token=secret#panel', 'SHOPEE'),
      'https://seller.shopee.co.id/demo',
    );
  });

  it('rejects credentials embedded in a URL', () => {
    assert.throws(
      () => normalizePublicStoreUrl('https://student:password@shopee.co.id/shop', 'SHOPEE'),
      BadRequestException,
    );
  });

  it('rejects private and metadata hosts', () => {
    for (const url of [
      'http://127.0.0.1/store',
      'http://2130706433/store',
      'http://0x7f000001/store',
      'http://192.168.1.5/store',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/store',
      'http://metadata.google.internal/',
      'file:///etc/passwd',
    ]) {
      assert.throws(() => normalizePublicStoreUrl(url, 'OTHER'), BadRequestException);
    }
  });

  it('rejects a domain that does not match the selected platform', () => {
    assert.throws(() => normalizePublicStoreUrl('https://tokopedia.com/demo', 'SHOPEE'), BadRequestException);
  });

  it('supports the configured social-commerce and independent website platforms', () => {
    assert.equal(normalizePublicStoreUrl('https://www.instagram.com/demo/?ref=profile', 'INSTAGRAM_SHOP'), 'https://www.instagram.com/demo');
    assert.equal(normalizePublicStoreUrl('https://example-store.id/catalog', 'WEBSITE'), 'https://example-store.id/catalog');
  });
});
