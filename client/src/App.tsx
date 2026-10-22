import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  tripInputSchema,
  type DestinationDto,
  type TripDto,
  type TripInput,
  type UserDto,
} from '@goease/contracts';
import { Foundation } from './Foundation';
import { api, ApiFailure } from './api';
import { Brand, Goe, Notice, HeroArtwork } from './components/ui';
import { AuthPage, VerifyPage, Mailbox } from './components/auth';
import { TripEditor } from './components/trip-editor';
import { initialDraft, inputFromTrip } from './trip-draft';

export type Link = (
  to: string,
  children: ReactNode,
  className?: string,
) => ReactNode;

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Có lỗi xảy ra. Hãy thử lại.';

export function App() {
  const [path, setPath] = useState(location.pathname);
  const [user, setUser] = useState<UserDto | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [destinations, setDestinations] = useState<DestinationDto[]>([]);
  const [google, setGoogle] = useState(false);
  const [draft, setDraft] = useState<TripInput>(initialDraft);
  const [loaded, setLoaded] = useState<TripDto | null>(null);
  const [list, setList] = useState<TripDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [saveState, setSaveState] = useState<
    'dirty' | 'saving' | 'saved' | 'error'
  >('dirty');

  const changeDraft = (value: TripInput) => {
    setDraft(value);
    setSaveState('dirty');
    setMessage('');
  };

  const saveKey = useRef({ payload: '', key: '' });

  const go = (next: string) => {
    history.pushState({}, '', next);
    setPath(location.pathname);
    setMessage('');
    window.scrollTo(0, 0);
  };

  const link: Link = (to, children, className = '') => (
    <a
      className={className}
      href={to}
      onClick={(e) => {
        e.preventDefault();
        go(to);
      }}
    >
      {children}
    </a>
  );

  useEffect(() => {
    const pop = () => {
      setPath(location.pathname);
      setMessage('');
    };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);

  // Fetch initial auth, destinations, and options
  useEffect(() => {
    let active = true;
    void api<{ user: UserDto | null }>('/auth/me')
      .then((v) => {
        if (active) {
          setUser(v.user);
          setSessionError('');
        }
      })
      .catch((e: unknown) => {
        if (active) setSessionError(errorText(e));
      });
    void api<{ items: DestinationDto[] }>('/destinations')
      .then((v) => {
        if (active) setDestinations(v.items);
      })
      .catch((e: unknown) => {
        if (active) setSessionError(errorText(e));
      });
    void api<{ google: boolean }>('/auth/options')
      .then((v) => {
        if (active) setGoogle(v.google);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [retry]);

  // Fetch user trips when on /trips or on / when logged in
  useEffect(() => {
    if (!user || (path !== '/trips' && path !== '/')) return;
    let active = true;
    if (path === '/trips') setBusy(true);
    setMessage('');
    void api<{ items: TripDto[] }>('/trips')
      .then((v) => {
        if (active) setList(v.items);
      })
      .catch((e: unknown) => {
        if (active && path === '/trips') setMessage(errorText(e));
      })
      .finally(() => {
        if (active && path === '/trips') setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [path, user, retry]);

  // Fetch individual trip when visiting /trips/:id
  useEffect(() => {
    if (!/^\/trips\/[a-f0-9]{24}$/.test(path)) return;
    let active = true;
    setBusy(true);
    setLoaded(null);
    void api<{ trip: TripDto }>(path)
      .then((v) => {
        if (active) {
          setLoaded(v.trip);
          setDraft(inputFromTrip(v.trip));
          setSaveState('saved');
        }
      })
      .catch((e: unknown) => {
        if (active) setMessage(errorText(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [path, retry]);

  const start = () => {
    setDraft(initialDraft());
    setLoaded(null);
    setSaveState('dirty');
    go('/trips/new');
  };

  const startWithDestination = (destId: string) => {
    const fresh = initialDraft();
    fresh.destinations = [{ destinationId: destId, order: 0 }];
    setDraft(fresh);
    setLoaded(null);
    setSaveState('dirty');
    go('/trips/new');
  };

  async function save() {
    if (!user) {
      go('/login?next=/trips/new');
      return;
    }
    const parsed = tripInputSchema.safeParse(draft);
    if (!parsed.success) {
      setSaveState('error');
      setMessage(
        'Kiểm tra tên chuyến, điểm đến, ngày, số người và giờ hoạt động. Mỗi hoạt động cần tên; giờ kết thúc phải sau giờ bắt đầu.',
      );
      return;
    }
    const payload = JSON.stringify({
      trip: parsed.data,
      ...(loaded ? { expectedRevision: loaded.revision } : {}),
    });
    const signature = `${loaded?.id ?? 'new'}:${payload}`;
    if (saveKey.current.payload !== signature)
      saveKey.current = { payload: signature, key: crypto.randomUUID() };
    setBusy(true);
    setSaveState('saving');
    setMessage('');
    try {
      const value = await api<{ trip: TripDto }>(
        loaded ? `/trips/${loaded.id}` : '/trips',
        {
          method: loaded ? 'PATCH' : 'POST',
          headers: { 'Idempotency-Key': saveKey.current.key },
          body: payload,
        },
      );
      setLoaded(value.trip);
      setDraft(inputFromTrip(value.trip));
      history.replaceState({}, '', `/trips/${value.trip.id}`);
      setPath(`/trips/${value.trip.id}`);
      setSaveState('saved');
      setMessage('Đã lưu chuyến đi vào tài khoản.');
    } catch (e) {
      setSaveState('error');
      if (e instanceof ApiFailure && e.status === 401) setUser(null);
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (path === '/dev/foundation')
    return import.meta.env.DEV ? (
      <Foundation />
    ) : (
      <main>Trang không tồn tại.</main>
    );

  const isEditor =
    path === '/trips/new' || /^\/trips\/[a-f0-9]{24}$/.test(path);
  const isAuth =
    path === '/login' ||
    path === '/register' ||
    path === '/verify-email' ||
    path === '/dev/mailbox';

  return (
    <div
      className={`app-shell ${
        isAuth
          ? 'auth-shell'
          : isEditor || path === '/trips'
            ? 'workspace-shell'
            : 'home-shell'
      }`}
    >
      {/* Site Header: distinct and uncluttered for auth vs app */}
      <header className={`site-header ${isAuth ? 'auth-site-header' : ''}`}>
        <div className="header-inner">
          <div className="header-brand-wrap">{link('/', <Brand />)}</div>

          {!isAuth ? (
            <>
              <nav aria-label="Điều hướng chính" className="main-nav">
                {link(
                  '/',
                  'Trang chủ',
                  `nav-link ${path === '/' ? 'active' : ''}`,
                )}
                {link(
                  '/trips',
                  'Chuyến đi của tôi',
                  `nav-link ${path.startsWith('/trips') ? 'active' : ''}`,
                )}
              </nav>

              <div className="account-nav">
                {user ? (
                  <div className="user-menu">
                    <span className="greeting" title={user.displayName}>
                      Chào, {user.displayName}
                    </span>
                    <button
                      type="button"
                      className="button button-subtle button-small"
                      onClick={() => {
                        void api('/auth/logout', { method: 'POST' })
                          .then(() => {
                            setUser(null);
                            setList([]);
                            setLoaded(null);
                            setDraft(initialDraft());
                            go('/');
                          })
                          .catch((e: unknown) => setMessage(errorText(e)));
                      }}
                    >
                      Đăng xuất
                    </button>
                  </div>
                ) : (
                  link(
                    '/login',
                    'Đăng nhập',
                    'button button-small button-outline',
                  )
                )}
              </div>
            </>
          ) : (
            <div className="auth-header-action" />
          )}
        </div>
      </header>

      {sessionError && (
        <div className="container">
          <Notice error>
            {sessionError}{' '}
            <button
              type="button"
              className="text-button inline-retry-btn"
              onClick={() => setRetry((v) => v + 1)}
            >
              Thử kết nối lại
            </button>
          </Notice>
        </div>
      )}

      <main className="container main-content-wrap">
        {message && !isEditor && path !== '/trips' && (
          <Notice error>{message}</Notice>
        )}

        {path === '/' ? (
          <>
            {/* Hero Section */}
            <section className="hero" aria-label="Giới thiệu GoEase">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span></span>VIỆT NAM · ĐI DỄ HƠN, ĐẸP HƠN
                </p>
                <h1>
                  Hôm nay,
                  <br />
                  mình đi đâu?
                </h1>
                <p className="hero-description">
                  Một nơi muốn đến. Những điều muốn thử. Cùng GoEase dành chỗ
                  cho chuyến đi tiếp theo của bạn.
                </p>
                <div className="hero-cta-group">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={start}
                  >
                    Tạo chuyến đi <span>↗</span>
                  </button>
                  <p className="hero-footnote">
                    Tự tay lên lịch · Lưu riêng trong tài khoản
                  </p>
                </div>
              </div>

              <div className="hero-visual">
                <HeroArtwork />
              </div>
            </section>

            {/* If logged in with real trips: showcase recent trips! */}
            {user && list.length > 0 && (
              <section
                className="home-recent-trips"
                aria-label="Chuyến đi gần đây của bạn"
              >
                <div className="section-header-compact">
                  <div>
                    <p className="eyebrow">
                      <span></span>GÓC HÀNH TRÌNH
                    </p>
                    <h2>Chuyến đi gần đây của bạn</h2>
                  </div>
                  {link('/trips', 'Xem tất cả ↗', 'text-button')}
                </div>
                <div className="trip-grid recent-trip-grid">
                  {list.slice(0, 3).map((trip) => (
                    <article className="trip-card" key={trip.id}>
                      <div className="trip-card-art">
                        <span className="trip-card-art-arrow">↗</span>
                        <span className="trip-card-art-dest">
                          {trip.destinationName}
                        </span>
                      </div>
                      <div className="trip-card-body">
                        <p className="eyebrow">
                          LỊCH TRÌNH THỦ CÔNG · RIÊNG TƯ
                        </p>
                        <h2>{link(`/trips/${trip.id}`, trip.title)}</h2>
                        <p>
                          {trip.startDate} → {trip.endDate} ·{' '}
                          {trip.travelers.totalCount} người
                        </p>
                        {link(
                          `/trips/${trip.id}`,
                          'Mở lịch trình ↗',
                          'text-button trip-open-link',
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Destination inspiration cards from real database */}
            {destinations.length > 0 && (
              <section
                className="home-destinations"
                aria-label="Điểm đến gợi ý"
              >
                <div className="section-header-compact">
                  <div>
                    <p className="eyebrow">
                      <span></span>GỢI Ý ĐIỂM ĐẾN
                    </p>
                    <h2>Khởi đầu nhẹ nhàng</h2>
                  </div>
                  <span className="muted-text">
                    Từ dữ liệu GoEase đã chuẩn bị
                  </span>
                </div>
                <div className="destinations-pills-row">
                  {destinations.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="destination-chip-card"
                      onClick={() => startWithDestination(d.id)}
                    >
                      <span className="dest-chip-name">{d.name}</span>
                      <span className="dest-chip-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 3 Steps Guide */}
            <section className="steps" aria-label="Bắt đầu dễ dàng">
              <div className="step-item">
                <span className="step-badge">01</span>
                <h2>Chọn nơi muốn đến</h2>
                <p>Ngày đi, bạn đồng hành và một chút mong đợi.</p>
              </div>
              <div className="step-item">
                <span className="step-badge">02</span>
                <h2>Vẽ nên từng ngày</h2>
                <p>Thêm hoạt động và khoảng nghỉ theo ý bạn.</p>
              </div>
              <div className="step-item">
                <span className="step-badge">03</span>
                <h2>Lưu lại, rồi lên đường</h2>
                <p>Mở lại lịch trình khi đăng nhập vào tài khoản.</p>
              </div>
            </section>

            {/* Bottom invitation banner */}
            <section className="home-next" aria-label="Bắt đầu chuyến đi">
              <div className="home-next-copy">
                <p className="eyebrow">
                  <span></span>GÓC HÀNH TRÌNH CỦA BẠN
                </p>
                <h2>Những chuyến đi đang chờ.</h2>
                <p>
                  {user
                    ? 'Tiếp tục những kế hoạch bạn đã lưu.'
                    : 'Đăng nhập để lưu và mở lại chuyến đi đầu tiên.'}
                </p>
              </div>
              <div className="home-next-action">
                {link(
                  user ? '/trips' : '/login',
                  user ? 'Mở chuyến đi của tôi ↗' : 'Đăng nhập ↗',
                  'button button-outline',
                )}
              </div>
            </section>
          </>
        ) : path === '/login' || path === '/register' ? (
          <AuthPage
            key={path}
            register={path === '/register'}
            google={google}
            link={link}
            onDone={(v) => {
              setUser(v);
              go(
                new URLSearchParams(location.search).get('next') ===
                  '/trips/new' ||
                  (!loaded && draft.title)
                  ? '/trips/new'
                  : '/trips',
              );
            }}
          />
        ) : path === '/verify-email' ? (
          <VerifyPage link={link} />
        ) : path === '/dev/mailbox' && import.meta.env.DEV ? (
          <Mailbox link={link} />
        ) : path === '/trips' ? (
          <section className="page-section trips-page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  <span></span>GÓC HÀNH TRÌNH
                </p>
                <h1>Chuyến đi của tôi</h1>
                <p>Mỗi kế hoạch là một điều đáng mong đợi.</p>
              </div>
              <button
                type="button"
                className="button button-primary"
                onClick={start}
              >
                ＋ Tạo chuyến đi
              </button>
            </div>

            {message && (
              <Notice error>
                {message}{' '}
                <button
                  type="button"
                  onClick={() => setRetry((v) => v + 1)}
                  className="text-button"
                >
                  Thử lại
                </button>
              </Notice>
            )}

            {!user ? (
              <div className="empty-state panel">
                <Goe size="medium" />
                <h2>Những chuyến đi đang chờ bạn.</h2>
                <p>Đăng nhập để lưu và mở lại lịch trình của riêng mình.</p>
                {link(
                  '/login',
                  'Đăng nhập để bắt đầu',
                  'button button-primary',
                )}
              </div>
            ) : busy ? (
              <Notice>Đang mở những chuyến đi…</Notice>
            ) : list.length ? (
              <div className="trip-grid">
                {list.map((trip) => (
                  <article className="trip-card" key={trip.id}>
                    <div className="trip-card-art">
                      <span className="trip-card-art-arrow">↗</span>
                      <span className="trip-card-art-dest">
                        {trip.destinationName}
                      </span>
                    </div>
                    <div className="trip-card-body">
                      <p className="eyebrow">LỊCH TRÌNH THỦ CÔNG · RIÊNG TƯ</p>
                      <h2>{link(`/trips/${trip.id}`, trip.title)}</h2>
                      <p>
                        {trip.startDate} → {trip.endDate} ·{' '}
                        {trip.travelers.totalCount} người
                      </p>
                      {link(
                        `/trips/${trip.id}`,
                        'Mở lịch trình ↗',
                        'text-button trip-open-link',
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              !message && (
                <div className="empty-state panel">
                  <Goe size="medium" />
                  <h2>Chuyến đi đầu tiên, bắt đầu thôi.</h2>
                  <p>
                    Chọn một nơi bạn muốn đến và tạo kế hoạch của riêng mình.
                  </p>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={start}
                  >
                    Tạo chuyến đi đầu tiên
                  </button>
                </div>
              )
            )}
          </section>
        ) : isEditor ? (
          <section className="page-section editor-page-section">
            <div className="page-heading editor-page-heading">
              <div>
                <p className="eyebrow">
                  <span></span>LỊCH TRÌNH THỦ CÔNG · RIÊNG TƯ
                </p>
                <h1>{loaded ? loaded.title : 'Một chuyến đi mới'}</h1>
                <p>Chậm lại một chút. Lên kế hoạch theo cách bạn thích.</p>
              </div>

              <div className="editor-top-actions">
                <p
                  className={`save-state save-${saveState}`}
                  role="status"
                  aria-label="Trạng thái lưu"
                >
                  {saveState === 'saving'
                    ? 'Đang lưu'
                    : saveState === 'saved'
                      ? 'Đã lưu'
                      : saveState === 'error'
                        ? 'Lưu thất bại'
                        : 'Chưa lưu'}
                </p>

                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {saveState === 'saving'
                    ? 'Đang lưu…'
                    : loaded
                      ? 'Lưu thay đổi'
                      : 'Tạo chuyến đi'}{' '}
                  <span>↗</span>
                </button>
              </div>
            </div>

            {!user && (
              <Notice>
                Đăng nhập để lưu vào tài khoản. Bạn có thể phác thảo trước ở
                đây.{' '}
                {link('/login?next=/trips/new', 'Đăng nhập', 'text-button')}
              </Notice>
            )}

            {message && (
              <Notice error={!message.startsWith('Đã lưu')}>{message}</Notice>
            )}

            {busy && path !== '/trips/new' && !loaded ? (
              <Notice>Đang mở lịch trình…</Notice>
            ) : path !== '/trips/new' && !loaded ? (
              <Notice error>
                Chưa mở được chuyến đi.{' '}
                {link('/trips', 'Về danh sách', 'text-button')}{' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Thử lại
                </button>
              </Notice>
            ) : (
              <fieldset className="editor-fieldset" disabled={busy}>
                <TripEditor
                  draft={draft}
                  onChange={changeDraft}
                  destinations={destinations}
                />
              </fieldset>
            )}
          </section>
        ) : (
          <section className="empty-state panel">
            <h1>Chưa tìm thấy trang này.</h1>
            {link('/', 'Về trang chủ', 'button button-primary')}
          </section>
        )}
      </main>

      {/* Clean, quiet footer */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand-line">
            <Brand />
            <span className="footer-tagline">
              Ít loay hoay hơn. Nhiều trải nghiệm hơn.
            </span>
          </div>
          <span className="footer-note">Made for your next little escape.</span>
        </div>
      </footer>

      {/* Mobile persistent bottom navigation bar */}
      {!isAuth && (
        <nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
          {link(
            '/',
            <>
              <span className="bottom-nav-icon" aria-hidden="true">
                ⌂
              </span>
              <span>Trang chủ</span>
            </>,
            `mobile-nav-item ${path === '/' ? 'active' : ''}`,
          )}
          {link(
            '/trips',
            <>
              <span className="bottom-nav-icon" aria-hidden="true">
                ↗
              </span>
              <span>Chuyến đi của tôi</span>
            </>,
            `mobile-nav-item ${path.startsWith('/trips') ? 'active' : ''}`,
          )}
        </nav>
      )}
    </div>
  );
}
