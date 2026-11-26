import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useMatches } from 'react-router';
import { travelerSections } from '../config/traveler-sections';

export function TravelerLayout() {
  const { pathname } = useLocation();
  const activePath = useMatches().at(-1)?.id;
  const activeSection = travelerSections.find(
    ({ path }) => path === activePath,
  );
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    document.title = activeSection
      ? `${activeSection.label} · GoEase`
      : 'Không tìm thấy trang · GoEase';
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname, activeSection]);

  return (
    <>
      <a href="#main" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="traveler-header">
        <div className="shell-width flex min-h-14 items-center justify-between gap-5">
          <Link to="/" className="brand-link">
            <img src="/brand/goease-g-32.svg" width="32" height="32" alt="" />
            <span>GoEase</span>
          </Link>
          <nav aria-label="Điều hướng chính" className="traveler-nav">
            {travelerSections.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                aria-current={path === activePath ? 'page' : undefined}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main
        id="main"
        className="shell-width traveler-main"
        tabIndex={-1}
        ref={main}
      >
        <Outlet />
      </main>
    </>
  );
}
