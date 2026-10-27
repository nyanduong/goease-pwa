import { useEffect, useRef, useState } from 'react';
import { adminSections } from '../admin-navigation-config';
import {
  Bell,
  ChevronRight,
  Globe2,
  MapPin,
  Search,
  List,
  type AppIcon,
} from '../icons';
import type { DestinationDto } from '@goease/contracts';

export function AdminTopbar({
  destinations,
  scope,
  onScope,
  pageLabel,
  icon: Icon,
  scopeHint,
  contextLabel,
}: {
  destinations: DestinationDto[];
  scope: string;
  onScope: (value: string) => void;
  pageLabel: string;
  icon: AppIcon;
  scopeHint?: string;
  contextLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 1001px)').matches,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (sidebarOpen && window.matchMedia('(max-width: 1000px)').matches)
      document
        .querySelector<HTMLAnchorElement>('#admin-sidebar a[aria-current]')
        ?.focus();
  }, [sidebarOpen]);
  const fold = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase();
  const matches = adminSections.filter((section) =>
    fold(`${section.label} ${section.keywords}`).includes(fold(query.trim())),
  );
  useEffect(() => {
    const close = () => {
      if (window.matchMedia('(max-width: 1000px)').matches)
        setSidebarOpen(false);
      setSearchOpen(false);
      setQuery('');
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (window.matchMedia('(max-width: 1000px)').matches)
          setSidebarOpen(false);
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        if (document.activeElement?.closest('#admin-sidebar'))
          menuRef.current?.focus();
        if (window.matchMedia('(max-width: 1000px)').matches)
          setSidebarOpen(false);
        setSearchOpen(false);
      }
    };
    const media = window.matchMedia('(min-width: 1001px)');
    const resize = () => setSidebarOpen(media.matches);
    media.addEventListener('change', resize);
    window.addEventListener('hashchange', close);
    window.addEventListener('keydown', shortcut);
    return () => {
      media.removeEventListener('change', resize);
      window.removeEventListener('hashchange', close);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);
  return (
    <header
      role="banner"
      className="admin-topbar admin-unified-header"
      aria-label="Thanh đầu trang quản trị"
    >
      <button
        className="admin-mobile-nav-toggle"
        ref={menuRef}
        type="button"
        aria-label={sidebarOpen ? 'Đóng menu quản trị' : 'Mở menu quản trị'}
        aria-expanded={sidebarOpen}
        aria-controls="admin-sidebar"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <List size={22} aria-hidden="true" />
      </button>
      {sidebarOpen && (
        <button
          className="admin-nav-backdrop"
          type="button"
          aria-label="Đóng menu quản trị"
          onClick={() => setSidebarOpen(false)}
        />
      )}
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
      <form
        className="admin-nav-search"
        role="search"
        aria-label="Tìm trang quản trị"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim() && matches[0]) {
            location.hash = matches[0].key;
            setSearchOpen(false);
            searchRef.current?.blur();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setSearchOpen(false);
        }}
      >
        <Search size={19} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Tìm trang quản trị"
          placeholder="Tìm trang, chức năng quản trị…"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.currentTarget.closest('form')?.querySelector('a')?.focus();
            }
          }}
        />
        {searchOpen && (
          <div className="admin-nav-search-results">
            <small>ĐI ĐẾN TRANG</small>
            {matches.length ? (
              matches.map((section) => (
                <a
                  key={section.key}
                  href={`#${section.key}`}
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  {section.label}
                  <ChevronRight size={15} aria-hidden="true" />
                </a>
              ))
            ) : (
              <p>Không tìm thấy trang phù hợp.</p>
            )}
          </div>
        )}
      </form>
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
      </div>
    </header>
  );
}
