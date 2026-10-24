import { images } from '@goease/media';
import { useState } from 'react';
import type { UserDto } from '@goease/contracts';

const fallback = images.defaultAvatar;
export function AccountAvatar({ user }: { user?: UserDto | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src =
    user?.avatarUrl && user.avatarUrl !== failedUrl ? user.avatarUrl : fallback;
  return (
    <img
      className="account-avatar"
      src={src}
      width={40}
      height={40}
      alt={user ? `Ảnh đại diện của ${user.displayName}` : 'Đăng nhập'}
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== fallback) setFailedUrl(src);
      }}
    />
  );
}
