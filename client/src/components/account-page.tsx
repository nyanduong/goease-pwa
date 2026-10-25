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
  UserRound,
  Mail,
  CalendarDays,
  RefreshCw,
  ShieldCheck,
  LockKeyhole,
  KeyRound,
  CircleCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AvatarPicker } from './avatar-picker';
import { useAutomaticRetry } from '../use-automatic-retry';
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
      <header className="account-heading">
        <span className="journey-eyebrow">TÀI KHOẢN CỦA BẠN</span>
        <h1>
          Trung tâm <span>cá nhân</span>
        </h1>
        <p>Quản lý thông tin và bảo mật tài khoản</p>
      </header>
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
            displayName={data.user.displayName}
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
          <div className="account-date-fields">
            <label>
              <span>
                <CalendarDays size={15} /> Ngày tham gia
              </span>
              <input readOnly value={accountDate(data.createdAt)} />
            </label>
            <label>
              <span>
                <RefreshCw size={15} /> Cập nhật lần cuối
              </span>
              <input readOnly value={accountDate(data.updatedAt)} />
            </label>
          </div>
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
          className="journey-primary"
          disabled={profileBusy}
          type="submit"
        >
          {profileBusy ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
      </form>
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
            <p>Các phiên đăng nhập khác sẽ bị thu hồi sau khi đổi mật khẩu.</p>
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
                onChange={setOldPassword}
                autoComplete="current-password"
                Icon={LockKeyhole}
              />
              <PasswordField
                label="Mật khẩu mới"
                value={newPassword}
                onChange={setNewPassword}
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

function accountDate(value: string | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
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
