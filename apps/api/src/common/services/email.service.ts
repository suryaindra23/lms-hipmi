import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type EmailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  replyTo?: string;
  rejectUnauthorized: boolean;
};

export function emailProviderConfigured(environment: NodeJS.ProcessEnv = process.env) {
  return environment.EMAIL_PROVIDER_ENABLED === 'true'
    && Boolean(environment.SMTP_HOST && environment.SMTP_PORT && environment.EMAIL_FROM)
    && Boolean((environment.SMTP_USER && environment.SMTP_PASSWORD) || (!environment.SMTP_USER && !environment.SMTP_PASSWORD));
}

export function publicAppUrl(environment: NodeJS.ProcessEnv = process.env) {
  const configured = environment.APP_PUBLIC_URL || environment.NEXT_PUBLIC_SITE_URL || environment.CORS_ORIGIN?.split(',')[0];
  return (configured || 'http://localhost:3001').replace(/\/$/, '');
}

export function absoluteActionUrl(path: string, environment: NodeJS.ProcessEnv = process.env) {
  const safePath = path.startsWith('/') ? path : '/';
  return `${publicAppUrl(environment)}${safePath}`;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] || character);
}

function configuration(environment: NodeJS.ProcessEnv): EmailConfiguration {
  if (!emailProviderConfigured(environment)) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const port = Number(environment.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT_INVALID');
  return {
    host: environment.SMTP_HOST!,
    port,
    secure: environment.SMTP_SECURE === 'true' || port === 465,
    user: environment.SMTP_USER || undefined,
    password: environment.SMTP_PASSWORD || undefined,
    from: environment.EMAIL_FROM!,
    replyTo: environment.EMAIL_REPLY_TO || undefined,
    rejectUnauthorized: environment.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
  };
}

export async function sendTransactionalEmail(message: TransactionalEmail, environment: NodeJS.ProcessEnv = process.env) {
  const config = configuration(environment);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    tls: { rejectUnauthorized: config.rejectUnauthorized },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const result = await transporter.sendMail({
    from: config.from,
    replyTo: config.replyTo,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { provider: 'SMTP', messageId: result.messageId };
}

function actionEmail(input: { heading: string; intro: string; buttonLabel: string; actionUrl: string; expiresText: string }) {
  const heading = escapeEmailHtml(input.heading);
  const intro = escapeEmailHtml(input.intro);
  const buttonLabel = escapeEmailHtml(input.buttonLabel);
  const actionUrl = escapeEmailHtml(input.actionUrl);
  const expiresText = escapeEmailHtml(input.expiresText);
  return `<!doctype html><html lang="id"><body style="margin:0;background:#fffaf2;color:#0f172a;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="border-top:5px solid #f97316;background:#ffffff;padding:30px;border-radius:14px"><p style="margin:0 0 8px;color:#ea580c;font-size:12px;font-weight:700;letter-spacing:.12em">SUNRISE ACADEMY</p><h1 style="margin:0 0 16px;font-size:26px">${heading}</h1><p style="margin:0 0 24px;line-height:1.7;color:#475569">${intro}</p><a href="${actionUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">${buttonLabel}</a><p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">${expiresText}<br>Jika tombol tidak dapat dibuka, salin alamat berikut:<br><span style="word-break:break-all">${actionUrl}</span></p></div><p style="margin:18px 0 0;text-align:center;font-size:12px;color:#94a3b8">Abaikan email ini jika Anda tidak meminta atau mengharapkan tindakan tersebut.</p></div></body></html>`;
}

@Injectable()
export class EmailService {
  isConfigured() {
    return emailProviderConfigured();
  }

  async sendInvitation(input: { to: string; firstName: string; token: string; expiresAt: Date }) {
    const actionUrl = absoluteActionUrl(`/aktivasi?token=${encodeURIComponent(input.token)}`);
    const name = input.firstName.trim() || 'Pengguna';
    return sendTransactionalEmail({
      to: input.to,
      subject: 'Aktifkan akun Sunrise Academy Anda',
      text: `Halo ${name}, akun Sunrise Academy Anda sudah disiapkan. Aktifkan akun melalui ${actionUrl}. Tautan berlaku sampai ${input.expiresAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.`,
      html: actionEmail({
        heading: `Selamat datang, ${name}.`,
        intro: 'Akun Sunrise Academy Anda sudah disiapkan oleh sekolah. Buat kata sandi untuk mulai menggunakan ruang belajar.',
        buttonLabel: 'Aktifkan akun',
        actionUrl,
        expiresText: `Tautan ini hanya dapat digunakan satu kali dan berlaku sampai ${input.expiresAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.`,
      }),
    });
  }

  async sendPasswordReset(input: { to: string; firstName: string; token: string }) {
    const actionUrl = absoluteActionUrl(`/reset-password?token=${encodeURIComponent(input.token)}`);
    const name = input.firstName.trim() || 'Pengguna';
    return sendTransactionalEmail({
      to: input.to,
      subject: 'Atur ulang kata sandi Sunrise Academy',
      text: `Halo ${name}, gunakan tautan berikut untuk mengatur ulang kata sandi: ${actionUrl}. Tautan berlaku selama 30 menit.`,
      html: actionEmail({
        heading: 'Atur ulang kata sandi',
        intro: `Halo ${name}, kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.`,
        buttonLabel: 'Atur ulang kata sandi',
        actionUrl,
        expiresText: 'Tautan ini hanya dapat digunakan satu kali dan berlaku selama 30 menit.',
      }),
    });
  }
}
