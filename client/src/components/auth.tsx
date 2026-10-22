import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { UserDto } from '@goease/contracts';
import { api } from '../api';
import { errorText, type Link } from '../App';
import { Field, Goe, Notice } from './ui';

export function AuthPage({
  register,
  google,
  link,
  onDone,
}: {
  register: boolean;
  google: boolean;
  link: Link;
  onDone: (user: UserDto) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const googleError = new URLSearchParams(location.search).get('google');
  const [message, setMessage] = useState(
    googleError === 'link_required'
      ? 'Email này đã thuộc một tài khoản khác. Hãy đăng nhập bằng phương thức hiện có; GoEase không tự gộp tài khoản theo email.'
      : googleError
        ? 'Chưa đăng nhập được bằng Google. Hãy thử lại hoặc dùng email và mật khẩu.'
        : '',
  );
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
          <h2>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</h2>
          <p className="auth-card-sub">
            {register
              ? 'Bắt đầu bằng những điều đơn giản.'
              : 'Lịch trình của bạn đang chờ ở đây.'}
          </p>
        </div>

        {register && (
          <details className="dev-notice">
            <summary>Lưu ý môi trường thử nghiệm (Local)</summary>
            <p>
              Bản local lưu email, mật khẩu đã băm và lịch trình trong MongoDB
              trên máy. Thư xác minh dùng hộp thư phát triển, chưa gửi email
              thật. Không dùng mật khẩu của tài khoản khác.
            </p>
          </details>
        )}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setMessage('');
            void api<{ user: UserDto; message?: string }>(
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
                if (register) {
                  setSent(true);
                  setMessage(
                    v.message ?? 'Hãy mở thư xác minh để hoàn tất tài khoản.',
                  );
                } else onDone(v.user);
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

          {message && <Notice error={!sent}>{message}</Notice>}

          {sent &&
            import.meta.env.DEV &&
            link(
              '/dev/mailbox',
              'Mở hộp thư phát triển để xác minh ↗',
              'dev-mailbox-link',
            )}

          <button
            type="submit"
            className="button button-primary full-width"
            disabled={busy}
          >
            {busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}{' '}
            <span>↗</span>
          </button>
        </form>

        <div className="divider">
          <span>hoặc</span>
        </div>

        <div className="auth-social">
          {google ? (
            <a
              className="button button-outline full-width google-btn"
              href="/api/v1/auth/google"
            >
              Tiếp tục với Google
            </a>
          ) : (
            <div className="google-disabled-group">
              <button
                type="button"
                className="button button-outline full-width google-btn"
                disabled
              >
                Google · Chưa khả dụng
              </button>
              <small className="muted text-center block">
                Google chưa được cấu hình trong môi trường này.
              </small>
            </div>
          )}
        </div>

        <p className="auth-switch">
          {register ? 'Đã có tài khoản? ' : 'Bạn mới đến? '}
          {link(
            register ? '/login' : '/register',
            register ? 'Đăng nhập' : 'Tạo tài khoản',
            'text-link',
          )}
        </p>
      </div>
    </section>
  );
}

export function VerifyPage({ link }: { link: Link }) {
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <section className="narrow-page panel">
      <div className="verify-header">
        <Goe size="medium" />
        <p className="eyebrow">
          <span></span>TÀI KHOẢN CỦA BẠN
        </p>
        <h1>Xác minh email</h1>
        <p className="verify-sub">
          Hoàn tất bước xác minh trước khi lưu chuyến đi vào tài khoản.
        </p>
      </div>

      {message && <Notice error={!done}>{message}</Notice>}

      <div className="verify-actions">
        {done ? (
          link('/login', 'Đến trang đăng nhập', 'button button-primary')
        ) : (
          <button
            type="button"
            className="button button-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void api('/auth/verify-email', {
                method: 'POST',
                body: JSON.stringify({
                  token: new URLSearchParams(location.search).get('token'),
                }),
              })
                .then(() => {
                  setDone(true);
                  setMessage('Email đã được xác minh. Bạn có thể đăng nhập.');
                  history.replaceState({}, '', '/verify-email');
                })
                .catch((e: unknown) => setMessage(errorText(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Đang xác minh…' : 'Xác minh email của tôi'}
          </button>
        )}
      </div>
    </section>
  );
}

type Mail = { id: string; to: string; url: string; createdAt: string };

export function Mailbox({ link }: { link: Link }) {
  const [items, setItems] = useState<Mail[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void api<{ items: Mail[] }>('/dev/mailbox')
      .then((v) => setItems(v.items))
      .catch((e: unknown) => setError(errorText(e)));
  }, [attempt]);

  return (
    <section className="page-section mailbox-section">
      <div className="mailbox-header">
        <p className="eyebrow">
          <span></span>CHỈ TRONG DEVELOPMENT
        </p>
        <h1>Hộp thư phát triển</h1>
        <Notice>
          Thư chỉ lưu trên máy phát triển, không được gửi tới email thật. Trang
          này không hoạt động trong production.
        </Notice>
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            setError('');
            setAttempt((v) => v + 1);
          }}
        >
          Tải lại hộp thư
        </button>
      </div>

      {error && <Notice error>{error}</Notice>}

      <div className="mailbox-list">
        {items.length ? (
          items.map((m) => (
            <article className="mail-card" key={m.id}>
              <div className="mail-card-content">
                <strong>Xác minh tài khoản GoEase</strong>
                <p>
                  {m.to} · {new Date(m.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
              {link(
                new URL(m.url).pathname + new URL(m.url).search,
                'Mở thư xác minh ↗',
                'button button-outline button-small',
              )}
            </article>
          ))
        ) : (
          <p className="muted empty-mailbox-text">
            Chưa có thư. Đăng ký một tài khoản để nhận thư xác minh local.
          </p>
        )}
      </div>
    </section>
  );
}
