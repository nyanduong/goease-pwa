import nodemailer from 'nodemailer';
import type { Config } from '../../config.js';

export type RegistrationEmail = { to: string; code: string; minutes: number };
export type RegistrationEmailSender = {
  configured: boolean;
  send: (message: RegistrationEmail) => Promise<void>;
};
export function registrationEmailSender(
  config: Config,
): RegistrationEmailSender {
  const configured = Boolean(
    config.SMTP_HOST &&
    config.SMTP_USER &&
    config.SMTP_PASS &&
    config.MAIL_FROM,
  );
  const transport = configured
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        requireTLS: config.SMTP_PORT !== 465,
        auth: { user: config.SMTP_USER!, pass: config.SMTP_PASS! },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      })
    : null;
  return {
    configured,
    async send(message) {
      if (!transport) throw new Error('REGISTRATION_EMAIL_UNAVAILABLE');
      try {
        const result = await transport.sendMail({
          from: { name: 'GoEase', address: config.MAIL_FROM! },
          to: [{ address: message.to, name: '' }],
          subject: 'Mã xác nhận đăng ký GoEase',
          text: `Mã xác nhận đăng ký GoEase của bạn là: ${message.code}\n\nMã có hiệu lực ${message.minutes} phút và chỉ dùng một lần. Không chia sẻ mã này với người khác.\nNếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.`,
        });
        if (result.accepted.length !== 1 || result.rejected.length)
          throw new Error('Rejected');
      } catch {
        throw new Error('REGISTRATION_EMAIL_DELIVERY_FAILED');
      }
    },
  };
}
