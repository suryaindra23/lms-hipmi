import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey = process.env.ENCRYPTION_KEY || 'a-very-secret-key-32-chars-long!!'; // Simpan di secret manager!
  private readonly key = scryptSync(this.secretKey, 'salt', 32);
  private readonly blindIndexKey = process.env.BLIND_INDEX_KEY || this.secretKey;

  encrypt(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(text: string): string {
    const buffer = Buffer.from(text, 'base64');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  }

  blindIndex(value: string, namespace: string): string {
    const normalized = value.replace(/\s+/g, '').toUpperCase();
    return createHmac('sha256', this.blindIndexKey).update(`${namespace}:${normalized}`).digest('hex');
  }
}
