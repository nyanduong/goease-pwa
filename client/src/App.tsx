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
import { Brand, Goe, Notice } from './components/ui';
import { AuthPage } from './components/auth';
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
  const [sessionStatus, setSessionStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [expiredSession, setExpiredSession] = useState(false);
  const [welcomeSeenInMemory, setWelcomeSeenInMemory] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [destinations, setDestinations] = useState<DestinationDto[]>([]);
  const [destinationStatus, setDestinationStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [tripsStatus, setTripsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [draft, setDraft] = useState<TripInput>(initialDraft);
  const [loaded, setLoaded] = useState<TripDto | null>(null);
  const [list, setList] = useState<TripDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionRetry, setSessionRetry] = useState(0);
  const [destinationRetry, setDestinationRetry] = useState(0);
  const [tripsRetry, setTripsRetry] = useState(0);
  const [detailRetry, setDetailRetry] = useState(0);
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
        go(
          path === '/' &&
            sessionStatus === 'ready' &&
            !user &&
            !to.startsWith('/login')
            ? '/login'
            : to,
        );
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

  // Resolve the session before deciding whether a root visit should show welcome.
  useEffect(() => {
    let active = true;
    setSessionStatus('loading');
    void api<{ user: UserDto | null; expiredSession?: boolean }>('/auth/me')
      .then((v) => {
        if (active) {
          setUser(v.user);
          setExpiredSession(v.expiredSession ?? false);
          setSessionError('');
          setSessionStatus('ready');
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setSessionError(errorText(e));
          setSessionStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [sessionRetry]);

  useEffect(() => {
    let active = true;
    setDestinationStatus('loading');
    void api<{ items: DestinationDto[] }>('/destinations')
      .then((v) => {
        if (active) {
          setDestinations(v.items);
          setDestinationStatus('ready');
        }
      })
      .catch(() => {
        if (active) setDestinationStatus('error');
      });
    return () => {
      active = false;
    };
  }, [destinationRetry]);

  useEffect(() => {
    if (path !== '/' || sessionStatus !== 'ready' || user) return;
    let seen = false;
    try {
      seen = localStorage.getItem('goease:onboarding:seen:v1') === 'true';
    } catch {
      /* storage is optional */
    }
    if ((expiredSession || !seen) && !welcomeSeenInMemory) {
      history.replaceState({}, '', '/welcome');
      setPath('/welcome');
    }
  }, [path, sessionStatus, user, expiredSession, welcomeSeenInMemory]);

  useEffect(() => {
    setList([]);
    setTripsStatus('idle');
  }, [user?.id]);

  // Fetch user trips when on /trips or on / when logged in
  useEffect(() => {
    if (!user || (path !== '/trips' && path !== '/')) {
      setTripsStatus('idle');
      return;
    }
    let active = true;
    setTripsStatus('loading');
    void api<{ items: TripDto[] }>('/trips')
      .then((v) => {
        if (active) {
          setList(
            [...v.items].sort((a, b) =>
              (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
            ),
          );
          setTripsStatus('ready');
        }
      })
      .catch(() => {
        if (active) {
          setTripsStatus('error');
          setList([]);
        }
      });
    return () => {
      active = false;
    };
  }, [path, user, tripsRetry]);

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
  }, [path, detailRetry]);

  const start = () => {
    if (!user) {
      go('/login?next=/trips/new');
      return;
    }
    if (
      draft.title ||
      draft.notes ||
      draft.days.some((d) => d.activities.length) ||
      draft.destinations.length
    ) {
      if (
        !window.confirm(
          'Bạn đang có một bản nháp. Bỏ bản nháp và tạo chuyến mới?',
        )
      )
        return;
      setDraft(initialDraft());
      setLoaded(null);
      setSaveState('dirty');
    }
    go('/trips/new');
  };

  const startWithDestination = (destId: string) => {
    if (!user) {
      go('/login');
      return;
    }
    if (
      draft.title ||
      draft.notes ||
      draft.days.some((d) => d.activities.length) ||
      draft.destinations.length
    ) {
      if (
        !window.confirm(
          'Thay điểm đến cho bản nháp hiện tại? Các hoạt động sẽ được giữ lại.',
        )
      )
        return;
    }
    const updated: TripInput = {
      ...draft,
      destinations: [{ destinationId: destId, order: 0 }],
      days: draft.days.map((day) => ({ ...day, destinationId: destId })),
    };
    setDraft(updated);
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
  const isAuth = path === '/login' || path === '/register';
  const isWelcome = path === '/welcome';
  const setOnboardingSeen = (seen: boolean) => {
    setWelcomeSeenInMemory(seen);
    try {
      localStorage.setItem('goease:onboarding:seen:v1', String(seen));
    } catch {
      /* in-memory navigation still works */
    }
  };
  const markWelcomeSeen = () => setOnboardingSeen(true);
  const fold = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLocaleLowerCase('vi');
  const visibleDestinations = destinations.filter((d) =>
    fold(d.name).includes(fold(destinationQuery)),
  );

  return (
    <div
      className={`app-shell ${
        isWelcome
          ? 'welcome-shell'
          : isAuth
            ? 'auth-shell'
            : isEditor || path === '/trips'
              ? 'workspace-shell'
              : 'home-shell'
      }`}
    >
      {/* Site Header: distinct and uncluttered for auth vs app */}
      {!isWelcome && (
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
                  {sessionStatus === 'loading' ? (
                    <span role="status">Đang kiểm tra phiên…</span>
                  ) : user ? (
                    <div className="user-menu">
                      <span
                        className="home-avatar"
                        title={user.displayName}
                        aria-label={user.displayName}
                      >
                        {user.displayName
                          .trim()
                          .slice(0, 1)
                          .toLocaleUpperCase('vi')}
                      </span>
                      <button
                        type="button"
                        className="button button-subtle button-small"
                        onClick={() => {
                          void api('/auth/logout', { method: 'POST' })
                            .then(() => {
                              setUser(null);
                              setExpiredSession(false);
                              setOnboardingSeen(true);
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
                  ) : sessionStatus === 'error' ? (
                    <button
                      className="button button-small button-outline"
                      onClick={() => setSessionRetry((v) => v + 1)}
                    >
                      Thử kết nối lại
                    </button>
                  ) : (
                    link(
                      '/login',
                      <img
                        src="/images/goe-mascot-cutout.png"
                        alt="Đăng nhập"
                      />,
                      'home-avatar-link',
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="auth-header-action" />
            )}
          </div>
        </header>
      )}

      {sessionError && (
        <div className="container">
          <Notice error>
            {sessionError}{' '}
            <button
              type="button"
              className="text-button inline-retry-btn"
              onClick={() => setSessionRetry((v) => v + 1)}
            >
              Thử kết nối lại
            </button>
          </Notice>
        </div>
      )}

      <main
        className="container main-content-wrap"
        onClickCapture={
          path === '/' && sessionStatus === 'ready' && !user
            ? (event) => {
                const target = event.target as HTMLElement;
                if (
                  target.closest(
                    'a,button,input,label,select,textarea,[role="button"]',
                  )
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  go('/login');
                }
              }
            : undefined
        }
      >
        {message && !isEditor && path !== '/trips' && (
          <Notice error>{message}</Notice>
        )}

        {path === '/' && sessionStatus !== 'ready' ? (
          <section className="home-session-loading" aria-live="polite">
            <Goe size="small" />
            <p>
              {sessionStatus === 'loading'
                ? 'Đang kiểm tra phiên…'
                : 'Chưa kiểm tra được phiên đăng nhập.'}
            </p>
            {sessionStatus === 'error' && (
              <button
                className="button button-outline"
                onClick={() => setSessionRetry((v) => v + 1)}
              >
                Thử kết nối lại
              </button>
            )}
          </section>
        ) : path === '/welcome' ? (
          <section className="welcome-page" aria-labelledby="welcome-title">
            <div className="welcome-copy">
              <Brand />
              <h1 id="welcome-title">
                Just go.
                <br />
                <em>We’ll plan.</em>
              </h1>
              <p className="welcome-subtitle">Việt Nam, theo cách của bạn.</p>
              <div
                className="welcome-scene"
                role="img"
                aria-label="Vịnh Hạ Long trong ánh bình minh, cùng Goe"
              >
                <img
                  className="welcome-landscape"
                  src="/images/welcome-halong-bay.png"
                  alt="Vịnh Hạ Long trong ánh bình minh"
                />
                <img
                  className="welcome-mascot"
                  src="/images/goe-mascot-cutout.png"
                  alt="Goe, linh thú du lịch GoEase"
                />
              </div>
              <p className="welcome-promise">
                Bạn chọn niềm vui.
                <br />
                GoEase giúp bạn tự tay lên kế hoạch.
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  markWelcomeSeen();
                  go('/');
                }}
              >
                Bắt đầu hành trình ↗
              </button>
              <a
                href="/"
                className="welcome-explore"
                onClick={(e) => {
                  e.preventDefault();
                  markWelcomeSeen();
                  go('/');
                }}
              >
                Khám phá trước
              </a>
              <small>Không cần tài khoản để khám phá GoEase.</small>
            </div>
            {!user &&
              link(
                '/login',
                'Đăng nhập',
                'button button-small button-outline welcome-login',
              )}
          </section>
        ) : path === '/' ? (
          <>
            <section className="home-intro" aria-label="Chào bạn, mình là Goe">
              <p className="eyebrow">
                <span /> CHÀO BẠN, MÌNH LÀ GOE
              </p>
              <h1>
                Hôm nay, mình
                <br />
                đi đâu?
              </h1>
              <label className="home-search">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Tìm điểm đến ở Việt Nam"
                  type="search"
                  value={destinationQuery}
                  onChange={(e) => setDestinationQuery(e.target.value)}
                  placeholder="Tìm điểm đến ở Việt Nam"
                />
              </label>
            </section>

            <section className="home-plan-banner" aria-label="Tạo chuyến đi">
              <div className="home-plan-copy">
                <h2>
                  Một ý tưởng.
                  <br />
                  Cả một hành trình.
                </h2>
                <p>Theo sở thích và lịch trình của bạn</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={start}
                >
                  Tạo chuyến đi <span>↗</span>
                </button>
              </div>
              <img
                src="/images/goe-mascot-cutout.png"
                alt="Goe, linh thú du lịch GoEase"
                className="home-plan-mascot"
              />
              <span className="home-plan-glass" aria-hidden="true" />
            </section>

            {/* Destination catalog comes from the API; no category labels are invented. */}
            <section className="home-destinations" aria-label="Điểm đến gợi ý">
              <div className="section-header-compact">
                <div>
                  <p className="eyebrow">
                    <span /> GỢI Ý ĐIỂM ĐẾN
                  </p>
                  <h2>Đi gần hay đi xa?</h2>
                </div>
                <span className="muted-text">
                  Tìm trong các điểm đến đang có trên GoEase
                </span>
              </div>
              {destinationStatus === 'loading' ? (
                <Notice>Đang tải điểm đến…</Notice>
              ) : destinationStatus === 'error' ? (
                <Notice error>
                  Chưa tải được danh mục điểm đến.{' '}
                  <button
                    className="text-button"
                    onClick={() => setDestinationRetry((v) => v + 1)}
                  >
                    Thử lại
                  </button>
                </Notice>
              ) : destinations.length === 0 ? (
                <p>Danh mục điểm đến hiện chưa có dữ liệu.</p>
              ) : visibleDestinations.length === 0 ? (
                <p>
                  Không tìm thấy điểm đến phù hợp.{' '}
                  <button
                    className="text-button"
                    onClick={() => setDestinationQuery('')}
                  >
                    Xóa từ khóa
                  </button>
                </p>
              ) : (
                <div className="destinations-pills-row">
                  {visibleDestinations.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      className="destination-chip-card"
                      onClick={() => startWithDestination(d.id)}
                    >
                      <span className="dest-chip-name">{d.name}</span>
                      <span className="dest-chip-arrow">↗</span>
                      <small>Lên kế hoạch tại đây</small>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {user ? (
              <section
                className="home-recent-trips"
                aria-label="Chuyến đi của bạn"
              >
                <div className="section-header-compact">
                  <div>
                    <p className="eyebrow">
                      <span /> CHUYẾN ĐI CỦA BẠN
                    </p>
                    <h2>Những kế hoạch gần đây</h2>
                  </div>
                  {link('/trips', 'Xem tất cả ↗', 'text-button')}
                </div>
                {tripsStatus === 'loading' ? (
                  <Notice>Đang tải chuyến đi…</Notice>
                ) : tripsStatus === 'error' ? (
                  <Notice error>
                    Chưa tải được chuyến đi.{' '}
                    <button
                      className="text-button"
                      onClick={() => setTripsRetry((v) => v + 1)}
                    >
                      Thử lại
                    </button>
                  </Notice>
                ) : list.length === 0 ? (
                  <div className="empty-state panel">
                    <Goe size="small" />
                    <h2>Chưa có chuyến đi nào</h2>
                    <p>Tạo lịch trình đầu tiên và lưu vào tài khoản.</p>
                    <button className="button button-primary" onClick={start}>
                      Tạo chuyến đi
                    </button>
                  </div>
                ) : (
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
                          <h2>{link(`/trips/${trip.id}`, trip.title)}</h2>
                          <p>
                            {trip.destinationName} · {trip.startDate} →{' '}
                            {trip.endDate} · {trip.travelers.totalCount} người
                          </p>
                          {link(
                            `/trips/${trip.id}`,
                            'Mở lịch trình ↗',
                            'text-button',
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="home-recent-trips guest-trips">
                <h2>Chuyến đi của bạn</h2>
                <p>Đăng nhập để lưu và mở lại lịch trình của riêng mình.</p>
                {link('/login', 'Đăng nhập', 'button button-outline')}
              </section>
            )}
          </>
        ) : path === '/login' || path === '/register' ? (
          <AuthPage
            key={path}
            register={path === '/register'}
            link={link}
            onDone={(v) => {
              setUser(v);
              setExpiredSession(false);
              setOnboardingSeen(false);
              go(
                new URLSearchParams(location.search).get('next') ===
                  '/trips/new' ||
                  (!loaded && draft.title)
                  ? '/trips/new'
                  : '/trips',
              );
            }}
          />
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
                  onClick={() => setTripsRetry((v) => v + 1)}
                  className="text-button"
                >
                  Thử lại
                </button>
              </Notice>
            )}

            {!user && sessionStatus !== 'ready' ? (
              <Notice>
                {sessionStatus === 'loading'
                  ? 'Đang kiểm tra phiên…'
                  : 'Chưa kiểm tra được phiên đăng nhập.'}{' '}
                {sessionStatus === 'error' && (
                  <button
                    type="button"
                    onClick={() => setSessionRetry((v) => v + 1)}
                    className="text-button"
                  >
                    Thử lại
                  </button>
                )}
              </Notice>
            ) : !user ? (
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
            ) : tripsStatus === 'loading' ? (
              <Notice>Đang mở những chuyến đi…</Notice>
            ) : tripsStatus === 'error' ? (
              <Notice error>
                Chưa tải được danh sách chuyến đi.{' '}
                <button
                  type="button"
                  onClick={() => setTripsRetry((v) => v + 1)}
                  className="text-button"
                >
                  Thử lại
                </button>
              </Notice>
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
                  onClick={() => setDetailRetry((v) => v + 1)}
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
      {!isWelcome && (
        <footer className="site-footer">
          <div className="container footer-inner">
            <div className="footer-brand-line">
              <Brand />
              <span className="footer-tagline">
                Ít loay hoay hơn. Nhiều trải nghiệm hơn.
              </span>
            </div>
            <span className="footer-note">
              Made for your next little escape.
            </span>
          </div>
        </footer>
      )}

      {/* Mobile persistent bottom navigation bar */}
      {!isAuth && !isWelcome && (
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
