import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type {
  UserDto,
  RegistrationPending,
  RegistrationResponse,
} from '@goease/contracts';
import { RegistrationVerification } from './registration-verification';
import { api } from '../api';
import { errorText, type Link } from '../App';
import { Field, Goe, Notice } from './ui';

export function AuthPage({
  register,
  link,
  onDone,
}: {
  register: boolean;
  link: Link;
  onDone: (user: UserDto) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<RegistrationPending | null>(null);
  // Credentials stay in this mounted form's memory only; never storage or URLs.
  const [registrationInput, setRegistrationInput] = useState<{
    email: string;
    password: string;
    displayName: string;
  } | null>(null);
  const params = new URLSearchParams(location.search);
  const continuing = params.get('next') === '/trips/new';
  const destination = params.get('destination');
  const continuation = continuing
    ? `?next=/trips/new${destination && /^[a-f0-9]{24}$/.test(destination) ? `&destination=${destination}` : ''}`
    : '';

  return (
    <section className="auth-layout">
      {/* Brand story column - visible on tablet/desktop */}
      <div className="auth-story" aria-hidden="false">
        <p className="eyebrow">
          <span></span>ĐIỀU HAY ĐANG Ở PHÍA TRƯỚC
        </p>
        <h1>
          {register
            ? 'Một tài khoản.\nNhững hành trình mới.'
            : 'Chào bạn,\nmình lại đi nhé?'}
        </h1>
        <p className="auth-story-sub">
          Lưu những kế hoạch riêng và tiếp tục từ nơi bạn đã dừng lại.
        </p>
        <div className="auth-mascot-card">
          <Goe size="large" />
          <div className="auth-mascot-caption">
            <strong>Goe chờ bạn</strong>
            <span>Đồng hành từng chặng đường</span>
          </div>
        </div>
      </div>

      {/* Form card column */}
      <div className="auth-card">
        <div className="auth-card-header">
          <p className="eyebrow">
            <span></span>CHÀO MỪNG ĐẾN GOEASE
          </p>
          <h2>
            {pending
              ? 'Xác nhận email'
              : register
                ? 'Tạo tài khoản'
                : 'Đăng nhập'}
          </h2>
          <p className="auth-card-sub">
            {continuing
              ? 'Đăng nhập hoặc tạo tài khoản để lưu lịch riêng và nhờ Goe xếp lịch. Xong bước này, bạn sẽ tiếp tục tạo chuyến ngay.'
              : register
                ? 'Bắt đầu bằng những điều đơn giản.'
                : 'Lịch trình của bạn đang chờ ở đây.'}
          </p>
        </div>

        {pending && registrationInput ? (
          <RegistrationVerification
            pending={pending}
            email={registrationInput.email}
            onVerify={async (code) => {
              const result = await api<{ user: UserDto }>(
                '/auth/registration/verify',
                {
                  method: 'POST',
                  body: JSON.stringify({ challenge: pending.challenge, code }),
                },
              );
              setRegistrationInput(null);
              setPending(null);
              onDone(result.user);
            }}
            onResend={async () => {
              const result = await api<RegistrationResponse>('/auth/register', {
                method: 'POST',
                body: JSON.stringify(registrationInput),
              });
              if ('user' in result) {
                setRegistrationInput(null);
                setPending(null);
                onDone(result.user);
              } else setPending(result);
            }}
            onCancel={() => {
              setPending(null);
              setRegistrationInput(null);
            }}
          />
        ) : (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setMessage('');
              const credentials = {
                email: String(f.get('email') ?? ''),
                password: String(f.get('password') ?? ''),
                displayName: String(f.get('displayName') ?? ''),
              };
              void api<RegistrationResponse>(
                register ? '/auth/register' : '/auth/login',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    email: f.get('email'),
                    password: f.get('password'),
                    ...(register ? { displayName: f.get('displayName') } : {}),
                  }),
                },
              )
                .then((v) => {
                  if ('user' in v) onDone(v.user);
                  else {
                    setRegistrationInput(credentials);
                    setPending(v);
                  }
                })
                .catch((error: unknown) => setMessage(errorText(error)))
                .finally(() => setBusy(false));
            }}
          >
            {register && (
              <Field label="Tên của bạn">
                <input
                  name="displayName"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Bạn muốn GoEase gọi là gì?"
                />
              </Field>
            )}

            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="ban@example.com"
              />
            </Field>

            <div className="field">
              <label htmlFor="auth-password-input">Mật khẩu</label>
              <div className="input-with-action">
                <input
                  id="auth-password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  placeholder="Nhập mật khẩu của bạn"
                />
                <button
                  className="password-toggle-btn"
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff
                      className="password-toggle-icon"
                      size={20}
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      className="password-toggle-icon"
                      size={20}
                      aria-hidden="true"
                    />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  </span>
                </button>
              </div>
              {register && (
                <small>
                  Ít nhất 12 ký tự. Hãy dùng một mật khẩu riêng cho GoEase.
                </small>
              )}
            </div>

            {message && <Notice error>{message}</Notice>}

            <button
              type="submit"
              className="button button-primary full-width"
              disabled={busy}
            >
              {busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}{' '}
              <span>↗</span>
            </button>
          </form>
        )}

        {!register && (
          <p className="auth-switch">
            {link('/forgot-password', 'Quên mật khẩu?', 'text-link')}
          </p>
        )}
        <p className="auth-switch">
          {register ? 'Đã có tài khoản? ' : 'Bạn mới đến? '}
          {link(
            `${register ? '/login' : '/register'}${continuation}`,
            register ? 'Đăng nhập' : 'Tạo tài khoản',
            'text-link',
          )}
        </p>
      </div>
    </section>
  );
}
