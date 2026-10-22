import nodemailer from 'nodemailer';
import type { Config } from '../../config.js';
export type ResetEmail = { to: string; url: string; minutes: number };
export type ResetEmailSender = {
  configured: boolean;
  send: (message: ResetEmail) => Promise<void>;
};
export function resetEmailSender(config: Config): ResetEmailSender {
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
    async send({ to, url, minutes }) {
      if (!transport) throw new Error('RESET_EMAIL_UNAVAILABLE');
      // Fixed text and one structured recipient: no HTML, attachment or header input from requests.
      try {
        const result = await transport.sendMail({
          from: { name: 'GoEase', address: config.MAIL_FROM! },
          to: [{ address: to, name: '' }],
          subject: 'Đặt lại mật khẩu GoEase',
          text: `Bạn vừa yêu cầu đặt lại mật khẩu GoEase.\n\nMở link sau để chọn mật khẩu mới:\n${url}\n\nLink có hiệu lực ${minutes} phút và chỉ dùng một lần. Các phiên đăng nhập cũ sẽ bị thu hồi sau khi đổi. Nếu không yêu cầu, hãy bỏ qua email này.`,
        });
        if (result.accepted.length !== 1 || result.rejected.length)
          throw new Error('Rejected');
      } catch {
        throw new Error('RESET_EMAIL_DELIVERY_FAILED');
      }
    },
  };
}
