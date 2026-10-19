import { BadRequestException } from '@nestjs/common';
import { StorePlatform } from '@prisma/client';
import { isIP } from 'net';

const platformHosts: Partial<Record<StorePlatform, string[]>> = {
  SHOPEE: ['shopee.co.id', 'shopee.com'],
  TIKTOK: ['tiktok.com'],
  TOKOPEDIA: ['tokopedia.com'],
  LAZADA: ['lazada.co.id', 'lazada.com'],
  INSTAGRAM_SHOP: ['instagram.com'],
  WHATSAPP_BUSINESS: ['wa.me', 'whatsapp.com'],
};

function isPrivateIpv4(host: string) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] >= 224 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && (parts[1] === 0 || parts[1] === 168)) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || parts[1] === 51)) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113);
}

export function normalizePublicStoreUrl(value: string, platform: StorePlatform) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException('URL toko tidak valid');
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new BadRequestException('URL toko harus menggunakan HTTP atau HTTPS');
  if (url.username || url.password) throw new BadRequestException('URL tidak boleh memuat credential');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const ipHost = host.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal' || isPrivateIpv4(ipHost) || isIP(ipHost) === 6) {
    throw new BadRequestException('URL internal atau privat tidak diizinkan');
  }
  const allowed = platformHosts[platform];
  if (allowed && !allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new BadRequestException(`Domain URL tidak sesuai platform ${platform}`);
  }
  url.protocol = 'https:';
  url.hostname = host;
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}
