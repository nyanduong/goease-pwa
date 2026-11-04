import { AppInfo } from './app-info';
import { DataCredits } from './data-credits';
import { MascotSettings } from '../mascot/settings';
import { Bell, LogOut } from '../customer-icons';
import { confirmAction } from '../confirmation';
import { useEffect, useRef, useState } from 'react';
import {
  profileUpdateSchema,
  passwordChangeSchema,
  type AccountDto,
  type UserDto,
  type AvatarUploadDto,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';
import {
  Pencil,
  Globe2,
  ArrowLeft,
  Settings,
  UserRound,
  Bookmark,
  Map,
  ChevronRight,
  Mail,
  ShieldCheck,
  LockKeyhole,
  KeyRound,
  CircleCheck,
  Eye,
  EyeOff,
} from '../customer-icons';
import { AvatarPicker } from './avatar-picker';
import { AccountAvatar } from './account-avatar';
import { useAutomaticRetry } from '../use-automatic-retry';
export function AccountPage({
  page = 'overview',
  onSaved,
  onLogout,
  onNavigate,
}: {
  page?: 'overview' | 'profile' | 'password' | 'preferences' | 'credits';
  onNavigate: (path: string) => void;
  onSaved: (user: UserDto) => void;
  onLogout?: () => void;
}) {
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
  const [otp, setOtp] = useState(''),
    [otpSent, setOtpSent] = useState(false),
    [resendAt, setResendAt] = useState(0);
  const pending = useRef<{ key: string; body: string } | null>(null);
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const uploadedAvatar = useRef<{ file: Blob; url: string } | null>(null);
  useAutomaticRetry(loadError ? 'error' : loading ? 'loading' : 'ready', () =>
    setReload((value) => value + 1),
  );
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
          setAvatarFile(null);
          uploadedAvatar.current = null;
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
        avatarFile ||
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
    avatarFile,
  ]);
  async function saveProfile() {
    if (!data || profileBusy) return;
    const parsed = profileUpdateSchema.safeParse({
      displayName: name,
      avatarUrl: avatar.trim() || null,
      expectedRevision: data.revision,
    });
    if (!parsed.success) {
      setProfileError('Tên hiển thị cần từ 1–100 ký tự. Kiểm tra lại hồ sơ.');
      return;
    }
    setProfileBusy(true);
    setProfileError('');
    setProfileNotice('');
    try {
      let avatarUrl = parsed.data.avatarUrl;
      if (avatarFile) {
        if (uploadedAvatar.current?.file !== avatarFile) {
          const uploaded = await api<AvatarUploadDto>('/me/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: avatarFile,
            signal: AbortSignal.timeout(45000),
          });
          uploadedAvatar.current = {
            file: avatarFile,
            url: uploaded.avatarUrl,
          };
        }
        avatarUrl = uploadedAvatar.current.url;
      }
      const result = await api<AccountDto>('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ...parsed.data, avatarUrl }),
      });
      setData(result);
      setName(result.user.displayName);
      setAvatar(result.user.avatarUrl ?? '');
      setAvatarFile(null);
      uploadedAvatar.current = null;
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
      if (!otpSent) {
        setPasswordBusy(true);
        setPasswordError('');
        try {
          await api('/me/password/otp', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
          });
          setOtpSent(true);
          setResendAt(Date.now() + 60000);
          setPasswordNotice(
            'Đã gửi mã xác thực về email tài khoản. Mã có hiệu lực 10 phút.',
          );
        } catch (e) {
          setPasswordError(
            e instanceof Error ? e.message : 'Chưa gửi được mã.',
          );
        } finally {
          setPasswordBusy(false);
        }
        return;
      }
      if (!/^\d{6}$/.test(otp)) {
        setPasswordError('Nhập mã xác thực 6 chữ số.');
        return;
      }
      pending.current = {
        key: crypto.randomUUID(),
        body: JSON.stringify({ ...parsed.data, otp }),
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
      setOtp('');
      setOtpSent(false);
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
    <section className="account-page" data-page={page}>
      <header className="account-heading">
        {page !== 'overview' && (
          <button
            type="button"
            className="account-back"
            aria-label="Quay lại tài khoản"
            onClick={async () => {
              const dirty =
                avatarFile ||
                oldPassword ||
                newPassword ||
                confirmation ||
                name !== data.user.displayName ||
                avatar !== (data.user.avatarUrl ?? '');
              if (profileBusy || passwordBusy) return;
              if (
                dirty &&
                !(await confirmAction(
                  'Thay đổi chưa được lưu. Bạn muốn rời trang?',
                  {
                    title: 'Bỏ thay đổi?',
                    confirmLabel: 'Rời trang',
                    cancelLabel: 'Tiếp tục chỉnh sửa',
                    tone: 'warning',
                  },
                ))
              )
                return;
              onNavigate('/account');
            }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1>
          {page === 'credits'
            ? 'Bản quyền dữ liệu'
            : page === 'profile'
              ? 'Chỉnh sửa hồ sơ'
              : page === 'password'
                ? 'Đổi mật khẩu'
                : page === 'preferences'
                  ? 'Tùy chọn Goe'
                  : 'Tài khoản'}
        </h1>
      </header>
      {page === 'overview' && (
        <>
          <button
            type="button"
            className="account-identity"
            aria-label="Chỉnh sửa hồ sơ cá nhân"
            onClick={() => onNavigate('/account/profile')}
          >
            <AccountAvatar user={data.user} />
            <div>
              <strong>{data.user.displayName}</strong>

              <small>
                {data.user.emailVerified
                  ? 'Email đã xác minh'
                  : 'Email chưa xác minh'}
              </small>
            </div>
            <Pencil className="account-edit-icon" size={18} />
          </button>
          <nav className="customer-account-links" aria-label="Nội dung của tôi">
            <a
              href="/trips"
              onClick={(event) => {
                event.preventDefault();
                onNavigate('/trips');
              }}
            >
              <Map size={20} />
              <span>Chuyến đi của tôi</span>
              <ChevronRight size={17} />
            </a>
            <a
              href="/saved"
              onClick={(event) => {
                event.preventDefault();
                onNavigate('/saved');
              }}
            >
              <Bookmark size={20} />
              <span>Địa điểm đã lưu</span>
              <ChevronRight size={17} />
            </a>
            <a
              href="/notifications"
              onClick={(event) => {
                event.preventDefault();
                onNavigate('/notifications');
              }}
            >
              <Bell size={20} />
              <span>Thông báo</span>
              <ChevronRight size={17} />
            </a>
          </nav>
          <nav
            className="customer-account-links account-settings-links"
            aria-label="Cài đặt tài khoản"
          >
            {[
              {
                path: '/account/profile',
                label: 'Chỉnh sửa hồ sơ',
                Icon: UserRound,
              },
              {
                path: '/account/password',
                label: 'Đổi mật khẩu',
                Icon: ShieldCheck,
              },
              {
                path: '/account/credits',
                label: 'Bản quyền dữ liệu',
                Icon: Globe2,
              },
              {
                path: '/account/preferences',
                label: 'Tùy chọn Goe',
                Icon: Settings,
              },
            ].map(({ path, label, Icon }) => (
              <a
                key={path}
                href={path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(path);
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
                <ChevronRight size={17} />
              </a>
            ))}
          </nav>
        </>
      )}
      {page === 'profile' && (
        <section className="account-profile-editor">
          <form
            className="expense-form account-card account-profile-card"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <h2 className="sr-only">Hồ sơ cá nhân</h2>
            <fieldset disabled={profileBusy}>
              <AvatarPicker
                displayName={name}
                emailVerified={data.user.emailVerified}
                avatarUrl={avatar}
                file={avatarFile}
                disabled={profileBusy}
                onCrop={(file) => {
                  setAvatarFile(file);
                  uploadedAvatar.current = null;
                  setProfileError('');
                  setProfileNotice('');
                }}
                onReset={() => {
                  setAvatar('');
                  setAvatarFile(null);
                  uploadedAvatar.current = null;
                }}
              />
              <label>
                <span>
                  <UserRound size={15} /> Tên hiển thị
                </span>
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                <span>
                  <Mail size={15} /> Email (cố định)
                </span>
                <input type="email" readOnly value={data.user.email} />
              </label>
            </fieldset>
            {profileError && (
              <p role="alert">
                {profileError}{' '}
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      await confirmAction(
                        'Tải hồ sơ mới và bỏ thay đổi đang nhập?',
                        {
                          title: 'Tải lại dữ liệu đã lưu?',
                          confirmLabel: 'Tải lại dữ liệu',
                          cancelLabel: 'Giữ nội dung đang nhập',
                          tone: 'warning',
                        },
                      )
                    )
                      setReload((v) => v + 1);
                  }}
                >
                  Tải lại hồ sơ
                </button>
              </p>
            )}
            {profileNotice && <p role="status">{profileNotice}</p>}
            <button
              className="journey-primary account-save"
              disabled={profileBusy}
              type="submit"
            >
              {profileBusy
                ? 'Đang lưu…'
                : avatarFile
                  ? 'Lưu hồ sơ và ảnh đại diện'
                  : 'Lưu thay đổi'}
            </button>
          </form>
        </section>
      )}
      {page === 'password' && (
        <section className="account-security-group">
          <form
            className="expense-form account-card account-security-card"
            onSubmit={(e) => {
              e.preventDefault();
              void changePassword();
            }}
          >
            <header className="account-security-heading">
              <span className="account-security-icon">
                <ShieldCheck size={26} />
              </span>
              <div>
                <h2>Đổi mật khẩu</h2>
                <p>Tăng cường bảo mật tài khoản</p>
              </div>
            </header>
            {data.canChangePassword ? (
              <>
                <AppInfo title="Sau khi đổi mật khẩu">
                  <p>
                    Các phiên đăng nhập khác sẽ bị thu hồi; phiên hiện tại được
                    giữ.
                  </p>
                </AppInfo>
                <fieldset disabled={passwordBusy || uncertain}>
                  <input
                    hidden
                    readOnly
                    autoComplete="username"
                    value={data.user.email}
                  />
                  <PasswordField
                    label="Mật khẩu hiện tại"
                    value={oldPassword}
                    onChange={(v) => {
                      setOldPassword(v);
                      setOtpSent(false);
                      setOtp('');
                      setPasswordNotice('');
                    }}
                    autoComplete="current-password"
                    Icon={LockKeyhole}
                  />
                  <PasswordField
                    label="Mật khẩu mới"
                    value={newPassword}
                    onChange={(v) => {
                      setNewPassword(v);
                      setOtpSent(false);
                      setOtp('');
                      setPasswordNotice('');
                    }}
                    autoComplete="new-password"
                    Icon={KeyRound}
                    minLength={12}
                  />
                  <PasswordField
                    label="Xác nhận mật khẩu mới"
                    value={confirmation}
                    onChange={setConfirmation}
                    autoComplete="new-password"
                    Icon={CircleCheck}
                    minLength={12}
                  />
                  {otpSent && (
                    <label>
                      <span>Mã xác thực email</span>
                      <input
                        aria-label="Mã xác thực email"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, ''))
                        }
                      />
                    </label>
                  )}
                </fieldset>
                {passwordError && <p role="alert">{passwordError}</p>}
                {uncertain && (
                  <p role="alert">
                    Chưa rõ kết quả. Thử lại cùng thao tác; nếu rời trang, hãy
                    thử đăng nhập bằng mật khẩu mới trước.
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
                      : otpSent
                        ? 'Xác nhận đổi mật khẩu'
                        : 'Gửi mã xác thực'}
                </button>
                {otpSent && (
                  <button
                    type="button"
                    disabled={passwordBusy}
                    onClick={() => {
                      if (Date.now() < resendAt) {
                        setPasswordError(
                          'Vui lòng đợi 60 giây trước khi gửi lại.',
                        );
                        return;
                      }
                      setOtpSent(false);
                      setOtp('');
                      setPasswordNotice('Nhấn Gửi mã xác thực để nhận mã mới.');
                    }}
                  >
                    Gửi lại mã
                  </button>
                )}
              </>
            ) : (
              <p>
                Bạn đăng nhập bằng Google và chưa có mật khẩu GoEase. Quản lý
                mật khẩu tại tài khoản Google.
              </p>
            )}
          </form>
        </section>
      )}
      {page === 'preferences' && <MascotSettings />}
      {page === 'credits' && <DataCredits />}
      {page === 'overview' && onLogout && (
        <button type="button" className="account-logout" onClick={onLogout}>
          <LogOut size={17} /> Đăng xuất
        </button>
      )}
    </section>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  Icon,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  Icon: typeof Eye;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="account-password-label">
      <span>{label}</span>
      <span className="account-password-input">
        <Icon size={19} aria-hidden="true" />
        <input
          required
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </label>
  );
}
