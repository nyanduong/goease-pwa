import {
  Bell,
  ChevronRight,
  Globe2,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { DestinationDto } from '@goease/contracts';

export function AdminTopbar({
  destinations,
  scope,
  onScope,
  name,
  pageLabel,
  icon: Icon,
  scopeHint,
  contextLabel,
}: {
  destinations: DestinationDto[];
  scope: string;
  onScope: (value: string) => void;
  name: string;
  pageLabel: string;
  icon: LucideIcon;
  scopeHint?: string;
  contextLabel?: string;
}) {
  return (
    <header
      role="banner"
      className="admin-topbar admin-unified-header"
      aria-label="Thanh đầu trang quản trị"
    >
      <div className="admin-header-identity">
        <span className="admin-header-page-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <div>
          <nav
            className="admin-header-breadcrumb"
            aria-label="Đường dẫn quản trị"
          >
            <a href="#overview">Quản trị</a>
            <ChevronRight size={13} aria-hidden="true" />
            <span aria-current="page">{pageLabel}</span>
          </nav>
        </div>
      </div>
      <div className="admin-header-context">
        {scopeHint ? (
          <label className="admin-header-scope">
            <MapPin size={18} aria-hidden="true" />
            <span>
              <small>{scopeHint}</small>
              <select
                aria-label="Khu vực quản lý"
                value={scope}
                onChange={(e) => onScope(e.target.value)}
              >
                <option value="">Tất cả khu vực</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ) : (
          <span className="admin-header-context-label">
            <Globe2 size={16} aria-hidden="true" />
            {contextLabel ?? 'Toàn hệ thống'}
          </span>
        )}
      </div>
      <div className="admin-header-account">
        <a
          className="admin-header-inbox"
          href="#work"
          aria-label="Mở hàng chờ cần kiểm tra"
          title="Cần kiểm tra"
        >
          <Bell size={20} />
        </a>
        <div
          className="admin-header-profile"
          role="group"
          aria-label={`Tài khoản quản trị: ${name}`}
        >
          <span className="admin-header-avatar" aria-hidden="true">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <small>Quản trị viên</small>
          </div>
        </div>
      </div>
    </header>
  );
}
