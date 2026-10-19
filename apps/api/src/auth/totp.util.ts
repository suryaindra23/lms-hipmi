import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes));
}

export function verifyTotp(code: string, secret: string, now = Date.now(), window = 1) {
  if (!/^\d{6}$/.test(code)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = totp(secret, now + offset * 30_000);
    if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true;
  }
  return false;
}

export function totp(secret: string, now = Date.now()) {
  const counter = BigInt(Math.floor(now / 30_000));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

function base32Encode(value: Buffer) {
  let bits = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) {
    result += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function base32Decode(value: string) {
  let bits = '';
  for (const character of value.replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}
