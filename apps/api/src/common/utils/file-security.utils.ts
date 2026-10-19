import { BadRequestException } from '@nestjs/common';

const EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
};

export type FileInspection = {
  clean: boolean;
  reason?: 'EMPTY_FILE' | 'INVALID_FILE_SIZE' | 'FILE_SIGNATURE_MISMATCH' | 'MALWARE_SIGNATURE' | 'ACTIVE_CONTENT';
};

export function validateUploadMetadata(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  allowedMimeTypes: readonly string[],
  maxBytes: number,
) {
  if (!allowedMimeTypes.includes(mimeType)) throw new BadRequestException('Format file tidak diizinkan');
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxBytes) {
    throw new BadRequestException(`Ukuran file maksimal ${Math.floor(maxBytes / 1024 / 1024)} MB`);
  }
  const normalized = fileName.normalize('NFKC').trim();
  if (!normalized || normalized.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(normalized)) {
    throw new BadRequestException('Nama file tidak valid');
  }
  const extension = normalized.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension || !EXTENSIONS_BY_MIME[mimeType]?.includes(extension)) {
    throw new BadRequestException('Ekstensi file tidak sesuai dengan format yang dipilih');
  }
  return { normalizedFileName: normalized, extension: `.${extension}` };
}

export function inspectFileBuffer(bytes: Buffer, mimeType: string, maxBytes: number): FileInspection {
  if (bytes.length === 0) return { clean: false, reason: 'EMPTY_FILE' };
  if (bytes.length > maxBytes) return { clean: false, reason: 'INVALID_FILE_SIZE' };

  const signatureMatches =
    (mimeType === 'application/pdf' && bytes.length >= 5 && bytes.subarray(0, 5).toString() === '%PDF-') ||
    (mimeType === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mimeType === 'image/png' && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mimeType === 'image/webp' && bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') ||
    (mimeType === 'video/mp4' && bytes.length >= 12 && bytes.subarray(4, 8).toString() === 'ftyp');
  if (!signatureMatches) return { clean: false, reason: 'FILE_SIGNATURE_MISMATCH' };

  const sample = bytes.subarray(0, Math.min(bytes.length, 1024 * 1024)).toString('latin1');
  if (sample.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) return { clean: false, reason: 'MALWARE_SIGNATURE' };
  if (/<script[\s>]/i.test(sample) || /javascript\s*:/i.test(sample)) return { clean: false, reason: 'ACTIVE_CONTENT' };
  if (mimeType === 'application/pdf' && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/i.test(sample)) {
    return { clean: false, reason: 'ACTIVE_CONTENT' };
  }
  return { clean: true };
}
