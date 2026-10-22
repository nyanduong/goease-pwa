import { useEffect, useState } from 'react';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  resetRequestMessage,
} from '@goease/contracts';
import { api } from '../api';
import type { Link } from '../App';
import { Field, Goe, Notice } from './ui';

export function PasswordRecovery({
  reset,
  link,
  onReset,
}: {
  reset: boolean;
  link: Link;
  onReset: () => void;
}) {
  const [token, setToken] = useState(() => location.hash.slice(1));
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0),
    [show, setShow] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  const validToken = /^[a-zA-Z0-9_-]{43}$/.test(token);
  async function submit() {
    if (busy || (!reset && cooldown)) return;
    setError('');
    const value = reset
      ? resetPasswordSchema.safeParse({ token, newPassword: password })
      : forgotPasswordSchema.safeParse({ email });
    if (!value.success || (reset && password !== confirm)) {
      setError(
        reset
          ? 'Mật khẩu cần 12–128 ký tự và xác nhận phải trùng khớp.'
          : 'Nhập địa chỉ email hợp lệ.',
      );
      return;
    }
    setBusy(true);
    try {
      await api(reset ? '/auth/reset-password' : '/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(value.data),
      });
      setDone(true);
      if (reset) {
        onReset();
        setPassword('');
        setConfirm('');
        setToken('');
        history.replaceState({}, '', '/reset-password');
      } else setCooldown(60);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa hoàn tất. Vui lòng thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-layout">
      <div className="auth-story">
        <p className="eyebrow">GOEASE · TÀI KHOẢN CỦA BẠN</p>
        <h1>Mình lại đi nhé.</h1>
        <p>Lấy lại quyền truy cập để tiếp tục những hành trình đã lưu.</p>
        <Goe size="large" />
      </div>
      <div className="auth-card">
        <div className="auth-card-header">
          <h1>{reset ? 'Đặt lại mật khẩu' : 'Quên mật khẩu?'}</h1>
          <p>
            {reset
              ? 'Chọn mật khẩu mới cho GoEase. Sau khi đổi, mọi phiên đăng nhập cũ sẽ bị thu hồi.'
              : 'Nhập email bạn đã dùng để đăng ký bằng mật khẩu. Nếu dùng Google, hãy đăng nhập bằng Google.'}
          </p>
        </div>
        {done && (
          <div>
            <Notice>
              {reset
                ? 'Đã đặt lại mật khẩu và thu hồi các phiên cũ. Đăng nhập lại bằng mật khẩu mới.'
                : resetRequestMessage}
            </Notice>
          </div>
        )}
        {reset && !validToken && !done ? (
          <Notice error>
            Link không hợp lệ hoặc bị thiếu.{' '}
            {link('/forgot-password', 'Yêu cầu link mới', 'text-link')}
          </Notice>
        ) : (
          (!reset || !done) && (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset disabled={busy} className="recovery-fields">
                {reset ? (
                  <>
                    <Field label="Mật khẩu mới">
                      <input
                        type={show ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label="Xác nhận mật khẩu mới">
                      <input
                        type={show ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </Field>
                    <button
                      type="button"
                      aria-pressed={show}
                      onClick={() => setShow((v) => !v)}
                    >
                      {show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    </button>
                  </>
                ) : (
                  <Field label="Email đăng ký">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </Field>
                )}
                {error && <Notice error>{error}</Notice>}
                <button
                  type="submit"
                  className="button button-primary full-width"
                  disabled={busy || (!reset && cooldown > 0)}
                >
                  {busy
                    ? 'Đang xử lý…'
                    : reset
                      ? 'Lưu mật khẩu mới'
                      : cooldown
                        ? `Gửi lại sau ${cooldown}s`
                        : 'Gửi yêu cầu đặt lại'}
                </button>
              </fieldset>
            </form>
          )
        )}
        <p className="auth-switch">
          {link('/login', 'Về đăng nhập', 'text-link')}
        </p>
        {reset && !done && (
          <p>{link('/forgot-password', 'Yêu cầu link mới', 'text-link')}</p>
        )}
      </div>
    </section>
  );
}
