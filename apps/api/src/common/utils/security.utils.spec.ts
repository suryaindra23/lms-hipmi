import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductionSecrets, auditFieldSummary, csvCell, redactSensitive } from './security.utils';

test('redacts sensitive values recursively', () => {
  assert.deepEqual(redactSensitive({ email: 'user@example.test', Authorization: 'Bearer secret', nested: { nik: '1234', refresh_token: 'secret' } }), {
    email: 'user@example.test',
    Authorization: '[REDACTED]',
    nested: { nik: '[REDACTED]', refresh_token: '[REDACTED]' },
  });
});

test('audit summaries record field names without values or secret fields', () => {
  assert.deepEqual(auditFieldSummary({ phone: '08123', email: 'person@example.test', password: 'secret' }), {
    fields: ['email', 'phone'],
  });
});

test('production refuses placeholder secrets', () => {
  assert.throws(() => assertProductionSecrets({ NODE_ENV: 'production', DATABASE_URL: 'db', JWT_SECRET: 'change-me', JWT_REFRESH_SECRET: 'ok', ENCRYPTION_KEY: 'ok' }), /JWT_SECRET/);
});

test('production requires an explicit payment destination', () => {
  const environment = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://database.example.test/lms',
    REDIS_URL: 'rediss://redis.example.test',
    JWT_SECRET: 'j'.repeat(32),
    JWT_REFRESH_SECRET: 'r'.repeat(32),
    ENCRYPTION_KEY: 'e'.repeat(32),
    BLIND_INDEX_KEY: 'b'.repeat(32),
    CORS_ORIGIN: 'https://academy.example.test',
    OBJECT_STORAGE_ENDPOINT: 'https://storage.internal.example.test',
    OBJECT_STORAGE_PUBLIC_ENDPOINT: 'https://storage.example.test',
    OBJECT_STORAGE_ACCESS_KEY: 'storage-access',
    OBJECT_STORAGE_SECRET_KEY: 's'.repeat(32),
    CLAMAV_HOST: 'clamav.internal.example.test',
    REQUIRE_ADMIN_MFA: 'true',
    MALWARE_SCANNER_REQUIRED: 'true',
  };

  assert.throws(() => assertProductionSecrets(environment), /PAYMENT_BANK_NAME/);
});

test('enabled production email requires complete SMTP configuration', () => {
  const environment = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://database.example.test/lms',
    REDIS_URL: 'rediss://redis.example.test',
    JWT_SECRET: 'j'.repeat(32),
    JWT_REFRESH_SECRET: 'r'.repeat(32),
    ENCRYPTION_KEY: 'e'.repeat(32),
    BLIND_INDEX_KEY: 'b'.repeat(32),
    CORS_ORIGIN: 'https://academy.example.test',
    OBJECT_STORAGE_ENDPOINT: 'https://storage.internal.example.test',
    OBJECT_STORAGE_PUBLIC_ENDPOINT: 'https://storage.example.test',
    OBJECT_STORAGE_ACCESS_KEY: 'storage-access',
    OBJECT_STORAGE_SECRET_KEY: 's'.repeat(32),
    CLAMAV_HOST: 'clamav.internal.example.test',
    PAYMENT_BANK_NAME: 'BCA',
    PAYMENT_BANK_ACCOUNT_NUMBER: '1234567890',
    PAYMENT_BANK_ACCOUNT_HOLDER: 'Example Holder',
    REQUIRE_ADMIN_MFA: 'true',
    MALWARE_SCANNER_REQUIRED: 'true',
    EMAIL_PROVIDER_ENABLED: 'true',
  };

  assert.throws(() => assertProductionSecrets(environment), /SMTP_HOST/);
  assert.doesNotThrow(() => assertProductionSecrets({
    ...environment,
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-password',
    EMAIL_FROM: 'Sunrise Academy <no-reply@example.test>',
    NEXT_PUBLIC_SITE_URL: 'https://academy.example.test',
  }));
});

test('CSV cells neutralize spreadsheet formulas', () => {
  assert.equal(csvCell('=HYPERLINK("https://invalid.test")'), '"\'=HYPERLINK(""https://invalid.test"")"');
  assert.equal(csvCell('Nama biasa'), '"Nama biasa"');
});
