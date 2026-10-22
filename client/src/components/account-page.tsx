import { useEffect, useRef, useState } from 'react';
import {
  profileUpdateSchema,
  passwordChangeSchema,
  type AccountDto,
  type UserDto,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { AccountAvatar } from './account-avatar';
export function AccountPage({ onSaved }: { onSaved: (user: UserDto) => void }) {
  const [data, setData] = useState<AccountDto | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [reload, setReload] = useState(0);
  const [name, setName] = useState(''),
    [avatar, setAvatar] = useState(''),
    [profileError, setProfileError] = useState(''),
    [profileNotice, setProfileNotice] = useState(''),
    [profileBusy, setProfileBusy] = useState(false);
  const [oldPassword, setOldPassword] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [passwordError, setPasswordError] = useState(''),
    [passwordNotice, setPasswordNotice] = useState(''),
    [passwordBusy, setPasswordBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const pending = useRef<{ key: string; body: string } | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setProfileError('');
    setProfileNotice('');
    void api<AccountDto>('/me/profile')
      .then((v) => {
        if (active) {
          setData(v);
          onSaved(v.user);
          setName(v.user.displayName);
          setAvatar(v.user.avatarUrl ?? '');
        }
      })
      .catch((e) => {
        if (active)
          setLoadError(e instanceof Error ? e.message : 'Chưa tải được hồ sơ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, onSaved]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (
        profileBusy ||
        passwordBusy ||
        uncertain ||
        oldPassword ||
        newPassword ||
        (data &&
          (name !== data.user.displayName ||
            avatar !== (data.user.avatarUrl ?? '')))
      )
        e.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [
    profileBusy,
    passwordBusy,
    uncertain,
    oldPassword,
    newPassword,
    data,
    name,
    avatar,
  ]);
  async function saveProfile() {
    if (!data || profileBusy) return;
    const parsed = profileUpdateSchema.safeParse({
      displayName: name,
      avatarUrl: avatar.trim() || null,
      expectedRevision: data.revision,
    });
    if (!parsed.success) {
      setProfileError(
        'Tên từ 1–100 ký tự; ảnh là URL HTTPS không chứa tài khoản/mật khẩu, tối đa 2048 ký tự.',
      );
      return;
    }
    setProfileBusy(true);
    setProfileError('');
    setProfileNotice('');
    try {
      const result = await api<AccountDto>('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      });
      setData(result);
      setName(result.user.displayName);
      setAvatar(result.user.avatarUrl ?? '');
      onSaved(result.user);
      setProfileNotice('Đã lưu hồ sơ.');
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Chưa lưu được hồ sơ.');
    } finally {
      setProfileBusy(false);
    }
  }
  async function changePassword() {
    if (passwordBusy) return;
    if (!pending.current) {
      const parsed = passwordChangeSchema.safeParse({
        currentPassword: oldPassword,
        newPassword,
      });
      if (!parsed.success || newPassword !== confirmation) {
        setPasswordError(
          'Nhập mật khẩu hiện tại, mật khẩu mới khác mật khẩu cũ (12–128 ký tự) và xác nhận trùng khớp.',
        );
        return;
      }
      pending.current = {
        key: crypto.randomUUID(),
        body: JSON.stringify(parsed.data),
      };
    }
    setPasswordBusy(true);
    setPasswordError('');
    setPasswordNotice('');
    try {
      await api('/me/password', {
        method: 'POST',
        body: pending.current.body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
      pending.current = null;
      setUncertain(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmation('');
      setPasswordNotice(
        'Đã đổi mật khẩu và đăng xuất các phiên khác. Phiên hiện tại vẫn được giữ.',
      );
    } catch (e) {
      setPasswordError(
        e instanceof Error ? e.message : 'Chưa đổi được mật khẩu.',
      );
      if (
        e instanceof ApiFailure &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408
      ) {
        pending.current = null;
        setUncertain(false);
      } else setUncertain(true);
    } finally {
      setPasswordBusy(false);
    }
  }
  if (loading) return <p role="status">Đang tải hồ sơ…</p>;
  if (loadError)
    return (
      <div role="alert">
        {loadError}
        <button onClick={() => setReload((v) => v + 1)}>Tải lại hồ sơ</button>
      </div>
    );
  if (!data) return null;
  return (
    <section className="account-page">
      <span className="journey-eyebrow">TÀI KHOẢN CỦA BẠN</span>
      <h1>Hồ sơ & bảo mật</h1>
      <div className="account-profile-head">
        <AccountAvatar user={data.user} />
        <div>
          <strong>{data.user.displayName}</strong>
          <p>{data.user.email}</p>
          <small>
            {data.user.emailVerified
              ? 'Email đã xác minh'
              : 'Email chưa xác minh'}
          </small>
        </div>
      </div>
      <form
        className="expense-form account-card"
        onSubmit={(e) => {
          e.preventDefault();
          void saveProfile();
        }}
      >
        <h2>Hồ sơ cá nhân</h2>
        <fieldset disabled={profileBusy}>
          <label>
            Tên hiển thị
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            URL ảnh đại diện
            <input
              type="url"
              maxLength={2048}
              placeholder="https://…"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
          </label>
          <small>
            Dùng link ảnh HTTPS, ví dụ Cloudinary. Chưa hỗ trợ tải ảnh từ thiết
            bị.
          </small>
          <button type="button" onClick={() => setAvatar('')}>
            Dùng avatar mặc định
          </button>
        </fieldset>
        {profileError && (
          <p role="alert">
            {profileError}{' '}
            <button
              type="button"
              onClick={() => {
                if (confirm('Tải hồ sơ mới và bỏ thay đổi đang nhập?'))
                  setReload((v) => v + 1);
              }}
            >
              Tải lại hồ sơ
            </button>
          </p>
        )}
        {profileNotice && <p role="status">{profileNotice}</p>}
        <button
          className="journey-primary"
          disabled={profileBusy}
          type="submit"
        >
          {profileBusy ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
      </form>
      <form
        className="expense-form account-card"
        onSubmit={(e) => {
          e.preventDefault();
          void changePassword();
        }}
      >
        <h2>Đổi mật khẩu</h2>
        {data.canChangePassword ? (
          <>
            <p>Các phiên đăng nhập khác sẽ bị thu hồi sau khi đổi mật khẩu.</p>
            <fieldset disabled={passwordBusy || uncertain}>
              <input
                hidden
                readOnly
                autoComplete="username"
                value={data.user.email}
              />
              <label>
                Mật khẩu hiện tại
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </label>
              <label>
                Mật khẩu mới
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label>
                Xác nhận mật khẩu mới
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
            </fieldset>
            {passwordError && <p role="alert">{passwordError}</p>}
            {uncertain && (
              <p role="alert">
                Chưa rõ kết quả. Thử lại cùng thao tác; nếu rời trang, hãy thử
                đăng nhập bằng mật khẩu mới trước.
              </p>
            )}
            {passwordNotice && <p role="status">{passwordNotice}</p>}
            <button
              className="journey-primary"
              disabled={passwordBusy}
              type="submit"
            >
              {passwordBusy
                ? 'Đang đổi…'
                : uncertain
                  ? 'Thử lại đổi mật khẩu'
                  : 'Đổi mật khẩu'}
            </button>
          </>
        ) : (
          <p>
            Bạn đăng nhập bằng Google và chưa có mật khẩu GoEase. Quản lý mật
            khẩu tại tài khoản Google.
          </p>
        )}
      </form>
    </section>
  );
}
