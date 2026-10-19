import assert from 'node:assert/strict';
import test from 'node:test';
import { absoluteActionUrl, emailProviderConfigured, escapeEmailHtml, publicAppUrl } from './email.service';

test('email provider is only ready when explicitly enabled with SMTP configuration', () => {
  assert.equal(emailProviderConfigured({ EMAIL_PROVIDER_ENABLED: 'false', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', EMAIL_FROM: 'test@example.test' }), false);
  assert.equal(emailProviderConfigured({ EMAIL_PROVIDER_ENABLED: 'true', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', EMAIL_FROM: 'test@example.test' }), true);
  assert.equal(emailProviderConfigured({ EMAIL_PROVIDER_ENABLED: 'true', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587' }), false);
});

test('email action links use the configured public application URL', () => {
  const environment = { NEXT_PUBLIC_SITE_URL: 'https://academy.example.test/' };
  assert.equal(publicAppUrl(environment), 'https://academy.example.test');
  assert.equal(absoluteActionUrl('/aktivasi?token=abc', environment), 'https://academy.example.test/aktivasi?token=abc');
  assert.equal(absoluteActionUrl('https://invalid.example.test', environment), 'https://academy.example.test/');
});

test('email HTML escapes user-controlled content', () => {
  assert.equal(escapeEmailHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
