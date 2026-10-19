const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'mfasecret',
  'nik',
  'nikencrypted',
  'documentstoragekey',
  'quarantinestoragekey',
  'cleanstoragekey',
  'valueencrypted',
  'blindindex',
  'nisn',
  'authorization',
  'cookie',
  'setcookie',
  'clientsecret',
  'apikey',
  'privatekey',
]);

function isSensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key.replace(/[-_]/g, '').toLowerCase());
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? '[REDACTED]' : redactSensitive(nestedValue),
    ]),
  );
}

export function auditFieldSummary(value: unknown): { fields: string[] } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return { fields: Object.keys(value).filter((key) => !isSensitiveKey(key)).sort() };
}

export function assertProductionSecrets(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV !== 'production') return;
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ENCRYPTION_KEY',
    'BLIND_INDEX_KEY',
    'CORS_ORIGIN',
    'OBJECT_STORAGE_ENDPOINT',
    'OBJECT_STORAGE_PUBLIC_ENDPOINT',
    'OBJECT_STORAGE_ACCESS_KEY',
    'OBJECT_STORAGE_SECRET_KEY',
    'CLAMAV_HOST',
    'PAYMENT_BANK_NAME',
    'PAYMENT_BANK_ACCOUNT_NUMBER',
    'PAYMENT_BANK_ACCOUNT_HOLDER',
  ];
  const missing = required.filter((name) => !environment[name] || environment[name]!.includes('change-me'));
  if (missing.length > 0) throw new Error(`Missing secure production configuration: ${missing.join(', ')}`);
  const weakSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'BLIND_INDEX_KEY', 'OBJECT_STORAGE_SECRET_KEY'].filter(
    (name) => environment[name]!.length < 32,
  );
  if (weakSecrets.length > 0) throw new Error(`Production secrets are too short: ${weakSecrets.join(', ')}`);
  if (Buffer.byteLength(environment.ENCRYPTION_KEY!) !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes');
  }
  if (environment.CORS_ORIGIN!.split(',').some((origin) => origin.trim() === '*' || !origin.trim().startsWith('https://'))) {
    throw new Error('CORS_ORIGIN must contain explicit HTTPS origins in production');
  }
  if (!environment.OBJECT_STORAGE_PUBLIC_ENDPOINT!.startsWith('https://')) {
    throw new Error('OBJECT_STORAGE_PUBLIC_ENDPOINT must use HTTPS in production');
  }
  if (environment.EMAIL_PROVIDER_ENABLED === 'true') {
    const emailRequired = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM', 'NEXT_PUBLIC_SITE_URL'];
    const missingEmail = emailRequired.filter((name) => !environment[name]);
    if (missingEmail.length > 0) throw new Error(`Missing production email configuration: ${missingEmail.join(', ')}`);
    const hasUser = Boolean(environment.SMTP_USER);
    const hasPassword = Boolean(environment.SMTP_PASSWORD);
    if (hasUser !== hasPassword) throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
    const smtpPort = Number(environment.SMTP_PORT);
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT must be a valid TCP port');
    if (!environment.NEXT_PUBLIC_SITE_URL!.startsWith('https://')) throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS for email links in production');
  }
  if (environment.REQUIRE_ADMIN_MFA !== 'true') {
    throw new Error('REQUIRE_ADMIN_MFA must be true in production');
  }
  if (environment.MALWARE_SCANNER_REQUIRED !== 'true') {
    throw new Error('MALWARE_SCANNER_REQUIRED must be true in production');
  }
}

export function csvCell(value: unknown): string {
  let normalized = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replace(/"/g, '""')}"`;
}
