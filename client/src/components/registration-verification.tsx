import { useEffect, useRef, useState } from 'react';
import type { RegistrationPending } from '@goease/contracts';
import { Field, Notice } from './ui';

export function RegistrationVerification({
  pending,
  email,
  onVerify,
  onResend,
  onCancel,
}: {
  pending: RegistrationPending;
  email: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(
    Date.now() + pending.retryAfterSeconds * 1000,
  );
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setCode('');
    setError('');
    setRetryAt(Date.now() + pending.retryAfterSeconds * 1000);
    input.current?.focus();
  }, [pending.challenge, pending.retryAfterSeconds]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa xác nhận được. Hãy thử lại.',
      );
      if (e && typeof e === 'object' && 'status' in e && e.status === 429)
        setRetryAt(Date.now() + 60000);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-form" style={{ display: 'grid', gap: 16 }}>
      <p>
        Nhập mã 6 số được gửi tới{' '}
        <strong style={{ overflowWrap: 'anywhere' }}>{email}</strong>. Kiểm tra
        cả thư rác. Tài khoản chỉ được tạo sau khi xác nhận mã.
      </p>
      <form
        style={{ display: 'grid', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void perform(() => onVerify(code));
        }}
      >
        <Field
          label="Mã xác nhận email"
          hint="Mã có hiệu lực 10 phút. Chỉ mã mới nhất dùng được."
        >
          <input
            ref={input}
            name="registrationCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
            value={code}
            disabled={busy}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            style={{
              letterSpacing: '.28em',
              fontSize: 22,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        </Field>
        {error && <Notice error>{error}</Notice>}
        <button
          className="button button-primary full-width"
          type="submit"
          disabled={busy || code.length !== 6}
        >
          {busy ? 'Đang xử lý…' : 'Xác nhận & tạo tài khoản'}
        </button>
      </form>
      <button
        className="button button-outline full-width"
        type="button"
        disabled={busy || remaining > 0}
        onClick={() => void perform(onResend)}
      >
        {remaining ? `Gửi lại sau ${remaining} giây` : 'Gửi mã mới'}
      </button>
      <button
        className="text-link"
        type="button"
        disabled={busy}
        onClick={onCancel}
      >
        Đổi email hoặc thông tin đăng ký
      </button>
    </div>
  );
}
