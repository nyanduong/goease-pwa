import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { refreshCatalogQueries, useCatalogQuery } from '../admin-catalog-query';
import { adminSections } from '../admin-navigation-config';
import { AdminVisitProgress } from './admin-visit-progress';
import { AdminSources } from './admin-sources';
import { AdminSettingsPage } from './admin-settings';
import { AdminCampaigns } from './admin-campaigns';
import { AdminHistory } from './admin-history';
import { AdminSchedules } from './admin-schedules';
import { AdminPageHeader } from './admin-visuals';
import { AdminReviewQueue } from './admin-review-queue';
import { ReviewDetail } from './admin-review-detail';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type {
  CatalogOperationsDto,
  CatalogHistoryListDto,
  CatalogHistoryQuery,
  CatalogReviewDto,
  CatalogReviewListDto,
  DestinationDto,
} from '@goease/contracts';
import { api } from '../api';
import { AdminCatalog } from './admin-catalog';
import { AdminDashboard } from './admin-dashboard';
import { AdminTopbar } from './admin-topbar';
import {
  LayoutDashboard,
  ListTodo,
  MapPin,
  RefreshCw,
  History as HistoryIcon,
  Activity,
  Database,
  Settings,
  CalendarClock,
} from '../icons';

const tabs = Object.fromEntries(
  adminSections.map(({ key, label }) => [key, label]),
) as Record<(typeof adminSections)[number]['key'], string>;
const navIcons = {
  overview: LayoutDashboard,
  work: ListTodo,
  places: MapPin,
  automatic: RefreshCw,
  progress: Activity,
  history: HistoryIcon,
  sources: Database,
  settings: Settings,
  rules: CalendarClock,
};
type Tab = keyof typeof tabs;
const currentTab = (): Tab => {
  const key = location.hash.slice(1).split('?')[0]!;
  return key in tabs ? (key as Tab) : 'overview';
};
export function AdminNavigation() {
  const [tab, setTab] = useState(currentTab);
  useEffect(() => {
    const changed = () => setTab(currentTab());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  return (
    <nav className="admin-navigation" aria-label="Quản trị danh mục">
      {Object.entries(tabs).map(([key, label]) => (
        <Fragment key={key}>
          {key === 'sources' && (
            <small className="admin-nav-section">DỮ LIỆU & HỆ THỐNG</small>
          )}
          <a href={`#${key}`} aria-current={tab === key ? 'page' : undefined}>
            {(() => {
              const Icon = navIcons[key as Tab];
              return <Icon size={20} />;
            })()}
            {label}
          </a>
        </Fragment>
      ))}
    </nav>
  );
}
export function AdminWorkspace(props: { destinations: DestinationDto[] }) {
  // App keys this workspace by admin identity, so cached data is session-local.
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AdminWorkspaceContent {...props} />
    </QueryClientProvider>
  );
}
function AdminWorkspaceContent({
  destinations: initialDestinations,
}: {
  destinations: DestinationDto[];
}) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [destinationReload, setDestinationReload] = useState(0);
  const [destinationError, setDestinationError] = useState('');
  useEffect(() => {
    const changed = () => setDestinationReload((v) => v + 1);
    window.addEventListener('goease-admin-destinations-changed', changed);
    return () =>
      window.removeEventListener('goease-admin-destinations-changed', changed);
  }, []);
  const [scope, setScope] = useState(
    () =>
      new URLSearchParams(location.hash.split('?')[1] ?? '').get(
        'destinationId',
      ) ??
      localStorage.getItem('goease-admin-view-scope') ??
      '',
  );
  const client = useQueryClient();
  useEffect(() => {
    localStorage.setItem('goease-admin-view-scope', scope);
    setNotice('');
    setError('');
    setDetail(null);
    setData(null);
    setOffset(0);
  }, [scope]);
  const [workSort, setWorkSort] = useState<'priority' | 'newest'>('priority');
  const [workQuery, setWorkQuery] = useState(''),
    [workKind, setWorkKind] = useState('');
  const [locationKey, setLocationKey] = useState(location.hash);
  useEffect(() => {
    let active = true;
    setDestinationError('');
    void (async () => {
      const all: DestinationDto[] = [];
      let offset = 0,
        more = true;
      while (more) {
        const value = await api<{ items: DestinationDto[]; hasMore: boolean }>(
          `/admin/destinations?offset=${offset}&limit=20`,
        );
        all.push(...value.items);
        more = value.hasMore;
        offset += value.items.length;
        if (!value.items.length) break;
      }
      if (active) setDestinations(all);
    })().catch(() => {
      if (active)
        setDestinationError(
          'Chưa tải được toàn bộ điểm đến quản trị. Thử tải lại trang để chọn điểm đến nháp/lưu trữ.',
        );
    });
    return () => {
      active = false;
    };
  }, [destinationReload]);
  const [tab, setTab] = useState<Tab>(currentTab);
  const [settingsOpened, setSettingsOpened] = useState(
    () => currentTab() === 'settings',
  );
  const [historyView, setHistoryView] = useState<'events' | 'reviews'>(
    'events',
  );
  const [data, setData] = useState<CatalogOperationsDto | null>(null);
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<CatalogReviewDto | null>(null);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilters, setHistoryFilters] = useState<
    Omit<CatalogHistoryQuery, 'offset'>
  >({ q: '', kind: 'all', period: 'all' });
  useEffect(() => {
    if (historyFilters.q === historySearch) return;
    const timer = setTimeout(() => {
      setHistoryFilters((value) => ({ ...value, q: historySearch }));
      setHistoryOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [historyFilters.q, historySearch]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openPlace, setOpenPlace] = useState<{
    id: string;
    request: number;
  } | null>(null);
  useEffect(() => {
    const changed = () => {
      setTab(currentTab());
      if (currentTab() === 'settings') setSettingsOpened(true);
      const target = new URLSearchParams(location.hash.split('?')[1] ?? '').get(
        'destinationId',
      );
      if (target && /^[a-f0-9]{24}$/.test(target)) setScope(target);
      const place = new URLSearchParams(location.hash.split('?')[1] ?? '').get(
        'place',
      );
      if (place && /^[a-f0-9]{24}$/.test(place))
        setOpenPlace({ id: place, request: Date.now() });
      setLocationKey(location.hash);
      setNotice('');
      setError('');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', changed);
    changed();
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const reviewing =
    tab === 'work' || (tab === 'history' && historyView === 'reviews');
  const viewingHistory = tab === 'history' && historyView === 'events';
  const history = useCatalogQuery<CatalogHistoryListDto>(
    '/admin/catalog/history',
    { offset: String(historyOffset), ...historyFilters },
    viewingHistory,
    true,
  );
  const scoped = scope ? { destinationId: scope } : {};
  const reviews = useCatalogQuery<CatalogReviewListDto>(
    '/admin/catalog/reviews',
    {
      offset: String(offset),
      q: workQuery,
      sort: workSort,
      ...scoped,
      ...(workKind ? { kind: workKind } : {}),
    },
    reviewing,
    true,
  );
  const operations = useCatalogQuery<CatalogOperationsDto>(
    '/admin/catalog/operations',
    scope ? { destinationId: scope } : {},
    reviewing,
    true,
  );
  const reviewError = reviews.error ?? operations.error;
  const loadError = viewingHistory
    ? history.error?.message
    : reviewing
      ? reviewError?.message
      : error;
  const items = reviews.data?.items ?? [];
  const reviewTotal = reviews.data?.total;
  useEffect(() => {
    if (
      reviewing &&
      reviewTotal !== undefined &&
      offset > 0 &&
      offset >= reviewTotal
    )
      setOffset(Math.max(0, Math.ceil(reviewTotal / 20) - 1) * 20);
  }, [reviewing, reviewTotal, offset]);
  const refreshGeneration = useRef(0);
  const refresh = useCallback(
    async (quiet = false) => {
      const generation = ++refreshGeneration.current;
      if (!['overview', 'automatic'].includes(tab)) return;
      if (!quiet) {
        setLoading(true);
        setError('');
      }
      try {
        const state = await api<CatalogOperationsDto>(
          `/admin/catalog/operations${scope ? `?destinationId=${scope}` : ''}`,
        );
        if (generation !== refreshGeneration.current) return;
        setData(state);
      } catch (e) {
        if (generation !== refreshGeneration.current) return;
        setError(
          e instanceof Error
            ? e.message
            : 'Chưa tải được dữ liệu. Hãy thử lại.',
        );
      } finally {
        if (generation === refreshGeneration.current) setLoading(false);
      }
    },
    [tab, scope],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!['overview', 'automatic'].includes(tab)) return;
    const timer = setInterval(() => {
      void refresh(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh, tab]);
  function edit(id: string) {
    setOpenPlace({ id, request: Date.now() });
    location.hash = 'places';
    setDetail(null);
  }
  return (
    <>
      <AdminTopbar
        destinations={destinations}
        scope={scope}
        onScope={setScope}
        pageLabel={tabs[tab]}
        icon={navIcons[tab]}
        {...(tab === 'rules' ||
        tab === 'automatic' ||
        tab === 'settings' ||
        (tab === 'history' && historyView === 'events')
          ? {
              contextLabel:
                tab === 'rules'
                  ? 'Lịch theo khu vực'
                  : tab === 'automatic'
                    ? 'Các đợt thu thập'
                    : tab === 'settings'
                      ? 'Thiết lập hệ thống'
                      : 'Nhật ký toàn hệ thống',
            }
          : {
              scopeHint:
                tab === 'sources'
                  ? 'Khu vực của kho địa điểm'
                  : 'Phạm vi dữ liệu',
            })}
      />
      {destinationError && (
        <div className="admin-alert" role="alert">
          {destinationError}
          <button onClick={() => setDestinationReload((v) => v + 1)}>
            Tải lại điểm đến quản trị
          </button>
        </div>
      )}
      <div hidden={tab !== 'places'}>
        <AdminCatalog
          destinations={destinations}
          openPlace={openPlace}
          scope={scope}
          locationKey={locationKey}
          active={tab === 'places'}
        />
      </div>
      {tab === 'sources' && (
        <AdminSources
          scope={scope}
          region={
            destinations.find((d) => d.id === scope)?.name ?? 'tất cả khu vực'
          }
        />
      )}
      <div hidden={tab !== 'settings'}>
        {settingsOpened && <AdminSettingsPage destinations={destinations} />}
      </div>
      {tab === 'overview' && (
        <AdminDashboard
          scope={scope}
          operations={data}
          onOpen={edit}
          destinations={destinations}
        />
      )}
      {tab === 'progress' && (
        <AdminVisitProgress
          scope={scope}
          region={
            destinations.find((d) => d.id === scope)?.name ?? 'Tất cả khu vực'
          }
          onOpen={edit}
        />
      )}
      {tab === 'automatic' && (
        <section className="admin-v2-content">
          <AdminCampaigns
            destinations={destinations}
            scope={scope}
            operations={data}
            onRefresh={() => refresh(true)}
          />
        </section>
      )}
      {tab === 'rules' && <AdminSchedules destinations={destinations} />}
      {![
        'places',
        'overview',
        'sources',
        'settings',
        'automatic',
        'rules',
        'progress',
      ].includes(tab) && (
        <section className="admin-catalog admin-operations">
          <AdminPageHeader
            title={tabs[tab]}
            region={
              tab === 'history' && historyView === 'events'
                ? 'Toàn hệ thống'
                : (destinations.find((d) => d.id === scope)?.name ??
                  'Tất cả khu vực')
            }
            description={
              tab === 'work'
                ? 'Kiểm tra dữ liệu trước khi đưa đến khách hàng.'
                : tab === 'automatic'
                  ? 'Thiết lập và chạy tự động thu thập, cập nhật địa điểm từ các nguồn dữ liệu bên ngoài.'
                  : historyView === 'events'
                    ? 'Tra cứu thao tác đã thực hiện và xử lý những việc đang chờ duyệt.'
                    : 'Kiểm tra và quyết định những việc đang chờ xử lý.'
            }
            actions={
              tab === 'work' ? (
                <a className="journey-outline" href="#history">
                  Lịch sử xử lý ↗
                </a>
              ) : tab === 'history' && historyView === 'events' ? (
                <button
                  className="history-refresh"
                  disabled={history.isFetching}
                  onClick={() => void history.refetch()}
                >
                  <RefreshCw size={16} /> Làm mới
                </button>
              ) : undefined
            }
          />

          {loadError && (
            <div className="admin-alert" role="alert">
              {loadError === 'An unexpected error occurred'
                ? 'Chưa tải được dữ liệu. Vui lòng thử lại sau.'
                : loadError}{' '}
              <button
                onClick={() => {
                  if (viewingHistory) void history.refetch();
                  if (reviewing && reviews.isError) void reviews.refetch();
                  if (reviewing && operations.isError)
                    void operations.refetch();
                }}
              >
                Thử tải lại
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="admin-success">
              {notice}
            </p>
          )}
          {!viewingHistory && !reviewing && loading && !data ? (
            <p role="status">Đang tải dữ liệu…</p>
          ) : (
            (reviewing ||
              data ||
              (tab === 'history' && historyView === 'events')) && (
              <>
                {tab === 'history' && (
                  <div
                    className="admin-history-tabs"
                    role="group"
                    aria-label="Xem lịch sử hoặc việc chờ duyệt"
                  >
                    <button
                      aria-pressed={historyView === 'events'}
                      onClick={() => setHistoryView('events')}
                    >
                      Nhật ký hoạt động
                    </button>
                    <button
                      aria-pressed={historyView === 'reviews'}
                      onClick={() => setHistoryView('reviews')}
                    >
                      Việc chờ duyệt
                    </button>
                  </div>
                )}
                {(tab === 'work' ||
                  (tab === 'history' && historyView === 'reviews')) && (
                  <AdminReviewQueue
                    items={items}
                    total={reviews.data?.total ?? 0}
                    counts={
                      reviews.data?.counts ?? {
                        draft: 0,
                        duplicate: 0,
                        source: 0,
                        price: 0,
                        quality: 0,
                      }
                    }
                    publishedCount={reviews.data?.publishedCount ?? 0}
                    offset={offset}
                    hasMore={reviews.data?.hasMore ?? false}
                    loading={reviews.isLoading}
                    failedToLoad={reviews.isError}
                    query={workQuery}
                    kind={workKind}
                    sort={workSort}
                    selectedId={
                      items.find((item) => item.id === detail?.id)?.id ??
                      items[0]?.id ??
                      null
                    }
                    onSelect={(item) => {
                      setDetail(item);
                      if (window.matchMedia('(max-width:760px)').matches)
                        requestAnimationFrame(() =>
                          document
                            .querySelector('.admin-check-inspector')
                            ?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            }),
                        );
                    }}
                    onQuery={(value) => {
                      setWorkQuery(value);
                      setOffset(0);
                      setDetail(null);
                    }}
                    onKind={(value) => {
                      setWorkKind(value);
                      setOffset(0);
                      setDetail(null);
                    }}
                    onSort={(value) => {
                      setWorkSort(value);
                      setOffset(0);
                      setDetail(null);
                    }}
                    onPage={(value) => {
                      setOffset(value);
                      setDetail(null);
                    }}
                    run={operations.data?.runs[0]}
                  >
                    {(() => {
                      const selected =
                        items.find((item) => item.id === detail?.id) ??
                        items[0];
                      return selected ? (
                        <ReviewDetail
                          key={`${selected.id}:${selected.revision}`}
                          review={selected}
                          onBack={() => {
                            setDetail(null);
                            document
                              .querySelector('.admin-check-list')
                              ?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                              });
                          }}
                          onEdit={() => edit(selected.place.id)}
                          onInspectDuplicate={edit}
                          onDone={async (message) => {
                            setNotice(message);
                            setDetail(null);
                            await refreshCatalogQueries(client);
                          }}
                          onReload={async () => {
                            await refreshCatalogQueries(client);
                          }}
                        />
                      ) : null;
                    })()}
                  </AdminReviewQueue>
                )}
                {tab === 'progress' && (
                  <AdminVisitProgress
                    scope={scope}
                    region={
                      destinations.find((d) => d.id === scope)?.name ??
                      'Tất cả khu vực'
                    }
                    onOpen={edit}
                  />
                )}
                {tab === 'history' && historyView === 'events' && (
                  <AdminHistory
                    items={history.data?.items ?? []}
                    total={history.data?.total ?? 0}
                    offset={historyOffset}
                    hasMore={history.data?.hasMore ?? false}
                    loading={history.isLoading}
                    failedToLoad={history.isError}
                    onPage={setHistoryOffset}
                    onOpen={edit}
                    search={historySearch}
                    kind={historyFilters.kind}
                    period={historyFilters.period}
                    onSearch={setHistorySearch}
                    onKind={(kind) => {
                      setHistoryFilters((value) => ({ ...value, kind }));
                      setHistoryOffset(0);
                    }}
                    onPeriod={(period) => {
                      setHistoryFilters((value) => ({ ...value, period }));
                      setHistoryOffset(0);
                    }}
                  />
                )}
              </>
            )
          )}
        </section>
      )}
    </>
  );
}
