import { ExplorePage, PlaceDetail, placeActivity } from './components/explore';
import { AccountAvatar } from './components/account-avatar';
import { Compass, Map, House, Bird, Bookmark } from 'lucide-react';
import { HomeDiscovery } from './components/home-discovery';
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
import { JourneyList, TripWorkspace } from './components/trip-workspace';
import { BudgetPreview } from './components/budget-screen';
import { GoeChat } from './components/goe-chat';
import { initialDraft, inputFromTrip, withDays } from './trip-draft';

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
    if (
      (path === '/trips/new' || /^\/trips\/[a-f0-9]{24}$/.test(path)) &&
      next.split('?')[0] !== path &&
      saveState !== 'saved' &&
      (draft.title || draft.days.some((d) => d.activities.length)) &&
      !confirm(
        'Chuyến đi có thay đổi chưa lưu. Rời trang mà chưa lưu thay đổi?',
      )
    )
      return;
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
      saveState !== 'saved' &&
      (draft.title ||
        draft.notes ||
        draft.days.some((d) => d.activities.length) ||
        draft.destinations.length)
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
    setDraft(initialDraft());
    setLoaded(null);
    setSaveState('dirty');
    go('/trips/new');
  };

  const startWithDestination = (destId: string) => {
    if (!user) {
      go('/login');
      return;
    }
    if (
      saveState !== 'saved' &&
      (draft.title || draft.days.some((d) => d.activities.length)) &&
      !confirm('Bỏ bản nháp chưa lưu và tạo chuyến đi mới?')
    )
      return;
    const updated: TripInput = withDays({
      ...initialDraft(),
      destinations: [{ destinationId: destId, order: 0 }],
    });
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
  const isJourney = isEditor || ['/trips', '/budget', '/goe'].includes(path);
  const isAuth = path === '/login' || path === '/register';
  const isWelcome = path === '/welcome';
  const isPlaceDetail = path.startsWith('/places/');
  const isExplore = path === '/explore';
  const isDiscovery = ['/', '/explore', '/saved', '/goe'].includes(path);
  const setOnboardingSeen = (seen: boolean) => {
    setWelcomeSeenInMemory(seen);
    try {
      localStorage.setItem('goease:onboarding:seen:v1', String(seen));
    } catch {
      /* in-memory navigation still works */
    }
  };
  const markWelcomeSeen = () => setOnboardingSeen(true);

  return (
    <div
      className={`app-shell ${
        isWelcome
          ? 'welcome-shell'
          : isPlaceDetail
            ? 'place-shell'
            : isExplore
              ? 'explore-shell'
              : isAuth
                ? 'auth-shell'
                : isJourney
                  ? 'workspace-shell journey-shell'
                  : 'home-shell'
      }`}
    >
      {/* Site Header: distinct and uncluttered for auth vs app */}
      {!isWelcome && !isExplore && !isPlaceDetail && !isJourney && (
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
                    `nav-link ${path.startsWith('/trips') || path === '/budget' ? 'active' : ''}`,
                  )}
                </nav>

                <div className="account-nav">
                  {sessionStatus === 'loading' ? (
                    <span role="status">Đang kiểm tra phiên…</span>
                  ) : user ? (
                    <div className="user-menu">
                      <AccountAvatar user={user} />
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
                    link('/login', <AccountAvatar />, 'home-avatar-link')
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

      {isEditor && destinationStatus === 'error' && (
        <Notice error>
          Chưa tải được danh mục điểm đến.{' '}
          <button
            className="text-button"
            onClick={() => setDestinationRetry((v) => v + 1)}
          >
            Thử lại
          </button>
        </Notice>
      )}
      <main
        className={
          isWelcome
            ? 'welcome-main'
            : isPlaceDetail
              ? 'place-main'
              : isExplore
                ? 'explore-main'
                : isJourney
                  ? 'journey-main'
                  : 'container main-content-wrap'
        }
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
            <div className="welcome-hero">
              <img
                className="welcome-landscape"
                src="/images/welcome-halong-bay.png"
                alt=""
              />
              <div className="welcome-heading">
                <Brand />
                <h1 id="welcome-title">
                  Just go.
                  <br />
                  <em>We’ll plan.</em>
                </h1>
                <p className="welcome-subtitle">Việt Nam, theo cách của bạn.</p>
              </div>
              <svg
                className="welcome-route"
                viewBox="0 0 320 240"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M22 210C35 179 104 205 130 152S213 134 250 41"
                  stroke="#fffdf3"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                />
                {[
                  { x: 22, y: 205 },
                  { x: 140, y: 146 },
                  { x: 250, y: 36 },
                ].map(({ x, y }) => (
                  <g key={x} transform={`translate(${x} ${y})`}>
                    <path
                      d="M0 5C-3 1-8-4-8-9a8 8 0 1 1 16 0c0 5-5 10-8 14Z"
                      fill="#fffdf3"
                    />
                    <circle cy="-9" r="3" fill="#c9d1ba" />
                  </g>
                ))}
              </svg>
              <img
                className="welcome-mascot"
                src="/images/goe-mascot-cutout.png"
                alt="Goe, linh thú du lịch GoEase"
              />
            </div>
            <div className="welcome-actions">
              <p className="welcome-promise">
                Bạn chọn niềm vui.
                <br />
                Goe lo phần kế hoạch.
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  markWelcomeSeen();
                  go('/');
                }}
              >
                Bắt đầu hành trình →
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
              <small>Không cần tài khoản để bắt đầu</small>
            </div>
          </section>
        ) : isExplore ? (
          <ExplorePage
            key={user?.id ?? 'guest'}
            signedIn={Boolean(user)}
            onNavigate={go}
          />
        ) : isPlaceDetail ? (
          <PlaceDetail
            key={`${path}:${user?.id ?? 'guest'}`}
            id={path.split('/')[2] ?? ''}
            signedIn={Boolean(user)}
            onNavigate={go}
            onNewTrip={(place, note) => {
              if (!user) {
                go('/login');
                return;
              }
              if (
                (draft.title ||
                  draft.notes ||
                  draft.destinations.length ||
                  draft.days.some((d) => d.activities.length)) &&
                !confirm(
                  'Bạn đang có bản nháp. Tạo bản nháp mới cho địa điểm này?',
                )
              )
                return;
              const next = withDays({
                ...initialDraft(),
                title: `Hành trình ${place.destinationName}`,
                destinations: [
                  { destinationId: place.destinationId, order: 0 },
                ],
              });
              if (next.days[0])
                next.days[0].activities.push(placeActivity(place, note, 0));
              setDraft(next);
              setLoaded(null);
              setSaveState('dirty');
              go('/trips/new');
              setMessage(
                'Địa điểm đã được thêm vào bản nháp. Nhấn Lưu để lưu chuyến đi.',
              );
            }}
          />
        ) : path === '/saved' ? (
          <>
            <ExplorePage
              key={user?.id ?? 'guest'}
              signedIn={Boolean(user)}
              onNavigate={go}
              savedOnly
            />
          </>
        ) : path === '/budget' ? (
          <BudgetPreview onBack={() => go('/trips')} />
        ) : path === '/goe' ? (
          <GoeChat signedIn={Boolean(user)} onNavigate={go} />
        ) : isDiscovery ? (
          <HomeDiscovery
            key={user?.id ?? 'guest'}
            mode={
              path === '/explore'
                ? 'explore'
                : path === '/saved'
                  ? 'saved'
                  : path === '/goe'
                    ? 'goe'
                    : 'home'
            }
            user={user}
            destinations={destinations}
            trips={list}
            tripsStatus={tripsStatus}
            onRetry={() => setTripsRetry((v) => v + 1)}
            onStart={(id) => (id ? startWithDestination(id) : start())}
            onNavigate={go}
          />
        ) : path === '/login' || path === '/register' ? (
          <AuthPage
            key={path}
            register={path === '/register'}
            link={link}
            onDone={(v) => {
              setUser(v);
              setExpiredSession(false);
              setOnboardingSeen(false);
              go('/');
            }}
          />
        ) : path === '/trips' ? (
          <JourneyList
            trips={list}
            signedIn={Boolean(user)}
            loading={
              sessionStatus === 'loading' ||
              (Boolean(user) &&
                (tripsStatus === 'loading' || tripsStatus === 'idle'))
            }
            error={
              sessionStatus === 'error'
                ? 'Chưa kiểm tra được phiên đăng nhập.'
                : tripsStatus === 'error'
                  ? 'Chưa tải được danh sách chuyến đi.'
                  : message
            }
            onRetry={() =>
              sessionStatus === 'error'
                ? setSessionRetry((v) => v + 1)
                : setTripsRetry((v) => v + 1)
            }
            onStart={start}
            onNavigate={go}
          />
        ) : isEditor ? (
          busy && path !== '/trips/new' && !loaded ? (
            <Notice>Đang mở lịch trình…</Notice>
          ) : path !== '/trips/new' && !loaded ? (
            <div className="journey-empty">
              <h1>Chưa mở được chuyến đi.</h1>
              <p>{message}</p>
              <button
                className="journey-primary"
                onClick={() => setDetailRetry((v) => v + 1)}
              >
                Thử lại
              </button>
              <button className="journey-outline" onClick={() => go('/trips')}>
                Về danh sách
              </button>
            </div>
          ) : (
            <TripWorkspace
              key={loaded?.id ?? 'new'}
              draft={draft}
              onChange={changeDraft}
              destinations={destinations}
              loaded={loaded}
              busy={busy}
              saveState={saveState}
              message={message}
              signedIn={Boolean(user)}
              onSave={() => void save()}
              onOpenGoe={(day) =>
                go(loaded ? `/goe?trip=${loaded.id}&day=${day}` : '/goe')
              }
              onBack={() => go('/trips')}
            />
          )
        ) : (
          <section className="empty-state panel">
            <h1>Chưa tìm thấy trang này.</h1>
            {link('/', 'Về trang chủ', 'button button-primary')}
          </section>
        )}
      </main>

      {/* Clean, quiet footer */}
      {!isWelcome && !isExplore && !isPlaceDetail && !isJourney && (
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
      {!isAuth && !isWelcome && !isPlaceDetail && path !== '/trips/new' && (
        <nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
          {[
            { to: '/explore', label: 'Khám phá', Icon: Compass },
            { to: '/trips', label: 'Chuyến đi', Icon: Map },
            { to: '/', label: 'Trang chủ', Icon: House },
            { to: '/goe', label: 'Goe', Icon: Bird },
            { to: '/saved', label: 'Đã lưu', Icon: Bookmark },
          ].map(({ to, label, Icon }) => (
            <a
              key={to}
              href={to}
              aria-current={
                path === to ||
                (to === '/trips' &&
                  (path.startsWith('/trips') || path === '/budget'))
                  ? 'page'
                  : undefined
              }
              className={`mobile-nav-item ${to === '/' ? 'mobile-nav-home' : ''} ${path === to || (to === '/trips' && (path.startsWith('/trips') || path === '/budget')) ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                go(!user && to !== '/' ? '/login' : to);
              }}
            >
              <span className="bottom-nav-icon">
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
