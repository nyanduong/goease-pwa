import { AdminVisitProgress } from './admin-visit-progress';
import { AdminSources } from './admin-sources';
import { AdminSettingsPage } from './admin-settings';
import { AdminScopeSummary } from './admin-scope-summary';
import { AdminCampaigns } from './admin-campaigns';
import { AdminHistory, type HistoryEntry } from './admin-history';
import { AdminPolicies } from './admin-policies';
import { AdminPageHeader } from './admin-visuals';
import { AdminReviewQueue } from './admin-review-queue';
import { ReviewDetail } from './admin-review-detail';
import { catalogTime } from './admin-review-utils';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type {
  CatalogOperationsDto,
  CatalogHistoryListDto,
  CatalogHistoryQuery,
  CatalogReviewDto,
  CatalogReviewListDto,
  CatalogScheduleInput,
  DestinationDto,
} from '@goease/contracts';
import { api } from '../api';
import { AdminCatalog } from './admin-catalog';
import { AdminDashboard, AdminTopbar } from './admin-dashboard';
import {
  LayoutDashboard,
  ListTodo,
  MapPin,
  RefreshCw,
  History as HistoryIcon,
  Activity,
  Database,
  Settings,
} from 'lucide-react';

const tabs = {
  overview: 'Tổng quan',
  work: 'Cần kiểm tra',
  places: 'Địa điểm',
  automatic: 'Đợt thu thập',
  progress: 'Tiến trình lấy dữ liệu',
  history: 'Lịch sử & phê duyệt',
  sources: 'Nguồn dữ liệu',
  settings: 'Cài đặt',
  rules: 'Quy tắc & lịch',
};
const navIcons = {
  overview: LayoutDashboard,
  work: ListTodo,
  places: MapPin,
  automatic: RefreshCw,
  progress: Activity,
  history: HistoryIcon,
  sources: Database,
  settings: Settings,
  rules: Settings,
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
const runLabels = {
  paused: 'Đã tạm dừng',
  queued: 'Đang chờ',
  running: 'Đang lấy và kiểm tra',
  retry: 'Sẽ tự thử lại',
  succeeded: 'Đã hoàn tất',
  failed: 'Cần can thiệp',
};
export function AdminWorkspace({
  destinations: initialDestinations,
  name = 'Admin',
}: {
  destinations: DestinationDto[];
  name?: string;
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
  const [catalogRevision, setCatalogRevision] = useState(0);
  useEffect(() => {
    localStorage.setItem('goease-admin-view-scope', scope);
    setNotice('');
    setError('');
    setDetail(null);
    setData(null);
    setOffset(0);
  }, [scope]);
  const [workSort, setWorkSort] = useState<'priority' | 'newest'>('priority');
  const [reviewCounts, setReviewCounts] = useState<
    CatalogReviewListDto['counts']
  >({ draft: 0, duplicate: 0, source: 0, price: 0, quality: 0 });
  const [publishedCount, setPublishedCount] = useState(0);
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
  const [historyView, setHistoryView] = useState<'events' | 'reviews'>(
    'events',
  );
  const [data, setData] = useState<CatalogOperationsDto | null>(null);
  const [items, setItems] = useState<CatalogReviewDto[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [detail, setDetail] = useState<CatalogReviewDto | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilters, setHistoryFilters] = useState<
    Omit<CatalogHistoryQuery, 'offset'>
  >({ q: '', kind: 'all', period: 'all' });
  useEffect(() => {
    const timer = setTimeout(() => {
      setHistoryFilters((value) => ({ ...value, q: historySearch }));
      setHistoryOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [historySearch]);
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
      const target = new URLSearchParams(location.hash.split('?')[1] ?? '').get(
        'destinationId',
      );
      if (target && /^[a-f0-9]{24}$/.test(target)) setScope(target);
      setLocationKey(location.hash);
      setNotice('');
      setError('');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const refreshGeneration = useRef(0);
  const refresh = useCallback(
    async (quiet = false) => {
      const generation = ++refreshGeneration.current;
      if (!quiet) {
        setLoading(true);
        setError('');
      }
      try {
        if (tab === 'history' && historyView === 'events') {
          const value = await api<CatalogHistoryListDto>(
            `/admin/catalog/history?${new URLSearchParams({ offset: String(historyOffset), ...historyFilters })}`,
          );
          if (generation !== refreshGeneration.current) return;
          setHistory(value.items);
          setHistoryMore(value.hasMore);
          setHistoryTotal(value.total);
          setError('');
          return;
        }
        const state = await api<CatalogOperationsDto>(
          `/admin/catalog/operations${scope ? `?destinationId=${scope}` : ''}`,
        );
        if (generation !== refreshGeneration.current) return;
        setData(state);
        if (tab === 'work' || tab === 'history') {
          const work = await api<CatalogReviewListDto>(
            `/admin/catalog/reviews?${new URLSearchParams({ offset: String(offset), q: workQuery, sort: workSort, ...(scope ? { destinationId: scope } : {}), ...(workKind ? { kind: workKind } : {}) })}`,
          );
          if (generation !== refreshGeneration.current) return;
          setItems(work.items);
          setTotal(work.total);
          setMore(work.hasMore);
          setReviewCounts(work.counts);
          setPublishedCount(work.publishedCount);
        }
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
    [
      tab,
      offset,
      historyOffset,
      historyView,
      historyFilters,
      scope,
      workQuery,
      workKind,
      workSort,
    ],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
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
        name={name}
        compact={tab === 'sources' || tab === 'settings'}
        pageLabel={tab === 'settings' ? 'Cài đặt' : 'Nguồn dữ liệu'}
        showScope={
          tab !== 'automatic' &&
          tab !== 'settings' &&
          !(tab === 'history' && historyView === 'events')
        }
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
          adminName={name}
          destinations={destinations}
          openPlace={openPlace}
          scope={scope}
          locationKey={locationKey}
          refreshKey={catalogRevision}
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
      {tab === 'settings' && <AdminSettingsPage destinations={destinations} />}
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
      {tab === 'rules' && (
        <section className="admin-v2-content">
          <AdminPageHeader
            title="Quy tắc & lịch"
            description="Mô phỏng tác động trước khi áp dụng tự động."
          />
          <AdminPolicies scope={scope} />
          {scope && data ? (
            <Automatic
              key={scope}
              data={data}
              onChange={setData}
              onRefresh={() => refresh(true)}
            />
          ) : (
            <div className="admin-empty">
              Chọn một điểm đến cụ thể trên thanh phạm vi để cấu hình lịch.
            </div>
          )}
        </section>
      )}
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
                <a href="#history">Lịch sử xử lý ↗</a>
              ) : tab === 'history' && historyView === 'events' ? (
                <button
                  className="history-refresh"
                  disabled={loading}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={16} /> Làm mới
                </button>
              ) : undefined
            }
          />

          {error && (
            <div className="admin-alert" role="alert">
              {error}{' '}
              <button onClick={() => void refresh()}>Thử tải lại</button>
            </div>
          )}
          {notice && (
            <p role="status" className="admin-success">
              {notice}
            </p>
          )}
          {loading && !data ? (
            <p role="status">Đang tải dữ liệu…</p>
          ) : (
            (data || (tab === 'history' && historyView === 'events')) && (
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
                    total={total}
                    counts={reviewCounts}
                    publishedCount={publishedCount}
                    offset={offset}
                    hasMore={more}
                    loading={loading}
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
                    run={data?.runs[0]}
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
                            setCatalogRevision((v) => v + 1);
                            setDetail(null);
                            await refresh(true);
                          }}
                          onReload={async () => {
                            await refresh(true);
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
                {tab === 'automatic' && data && (
                  <Automatic
                    key={scope}
                    data={data}
                    onChange={setData}
                    onRefresh={() => refresh(true)}
                  />
                )}
                {tab === 'history' && historyView === 'events' && (
                  <AdminHistory
                    items={history}
                    total={historyTotal}
                    offset={historyOffset}
                    hasMore={historyMore}
                    loading={loading}
                    failedToLoad={!!error}
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

function Automatic({
  data,
  onChange,
  onRefresh,
}: {
  data: CatalogOperationsDto;
  onChange: (v: CatalogOperationsDto) => void;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<CatalogScheduleInput>({
    ...data.schedule,
    expectedRevision: data.schedule.revision,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const key = useRef({ payload: '', key: '' });
  async function save(enabled: boolean) {
    const {
      frequency,
      hour,
      minute,
      weekday,
      group,
      expectedRevision,
      destinationId,
    } = form;
    const body = JSON.stringify({
      enabled,
      destinationId,
      frequency,
      hour,
      minute,
      weekday,
      group,
      expectedRevision,
    });
    if (key.current.payload !== body)
      key.current = { payload: body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const v = await api<CatalogOperationsDto>('/admin/catalog/schedule', {
        method: 'PUT',
        headers: { 'Idempotency-Key': key.current.key },
        body,
      });
      onChange(v);
      setForm({ ...v.schedule, expectedRevision: v.schedule.revision });
      setNotice(
        enabled
          ? 'Đã lưu và bật tự động cập nhật.'
          : 'Đã tạm dừng tự động. Lượt đã nhận trước đó vẫn tiếp tục đến khi hoàn tất.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được cấu hình.');
    } finally {
      setBusy(false);
    }
  }
  const runKey = useRef('');
  async function run() {
    setBusy(true);
    setError('');
    setNotice('');
    runKey.current ||= crypto.randomUUID();
    try {
      await api('/admin/catalog/run', {
        method: 'POST',
        headers: { 'Idempotency-Key': runKey.current },
        body: JSON.stringify({ destinationId: data.schedule.destinationId }),
      });
      runKey.current = '';
      setNotice(
        'Đã nhận yêu cầu cập nhật. Kết quả sẽ xuất hiện bên dưới khi xử lý xong.',
      );
      await onRefresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa bắt đầu được lượt cập nhật.',
      );
    } finally {
      setBusy(false);
    }
  }
  const active = data.runs.some((r) =>
    ['queued', 'running', 'retry'].includes(r.state),
  );
  return (
    <>
      <div className="admin-automation-grid">
        <div>
          <div className="admin-source-status">
            <div>
              <h2>Geoapify · OpenStreetMap</h2>
              <p>
                {data.connected
                  ? 'Đã cấu hình kết nối nguồn'
                  : 'Chưa kết nối nguồn dữ liệu'}
              </p>
              <p>
                Theo khu vực đang chọn · phạm vi đã lưu trong Cài đặt · tối đa
                50 kết quả/lượt
              </p>
            </div>
            <button
              className="journey-outline"
              disabled={busy || active || !data.connected}
              onClick={() => void run()}
            >
              {active
                ? 'Đang cập nhật / chờ thử lại'
                : data.runs[0]?.state === 'failed'
                  ? 'Thử lại'
                  : 'Chạy ngay'}
            </button>
          </div>
          {!data.connected && (
            <div className="admin-alert">
              Nhờ người thiết lập kết nối Geoapify trước khi cập nhật.
              <details>
                <summary>Hướng dẫn cho người thiết lập</summary>Điền
                GEOAPIFY_API_KEY trong server/.env, rồi khởi động lại API. Khóa
                chỉ được lưu ở máy chủ.
              </details>
            </div>
          )}
          {error && (
            <div role="alert" className="admin-alert">
              {error}
              <button
                disabled={busy}
                onClick={() =>
                  setForm({
                    ...data.schedule,
                    expectedRevision: data.schedule.revision,
                  })
                }
              >
                Nạp cấu hình đã lưu để sửa lại
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="admin-success">
              {notice}
            </p>
          )}
          <AdminScopeSummary destinationId={data.schedule.destinationId} />
          <a href="#places?import=1" className="admin-dry-run journey-outline">
            Chạy thử & xem trước dữ liệu
          </a>
        </div>
        <form
          className="admin-schedule-card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          <fieldset disabled={busy} className="admin-form-fields">
            <legend>Lịch cập nhật</legend>
            <div className="admin-two">
              <label>
                Tần suất
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      frequency: e.target.value as 'daily' | 'weekly',
                    }))
                  }
                >
                  <option value="daily">Hằng ngày</option>
                  <option value="weekly">Hằng tuần</option>
                </select>
              </label>
              <label>
                Giờ chạy · Việt Nam
                <input
                  type="time"
                  required
                  value={`${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [hour, minute] = e.target.value
                      .split(':')
                      .map(Number);
                    setForm((v) => ({ ...v, hour: hour!, minute: minute! }));
                  }}
                />
              </label>
              {form.frequency === 'weekly' && (
                <label>
                  Ngày trong tuần
                  <select
                    value={form.weekday}
                    onChange={(e) =>
                      setForm((v) => ({
                        ...v,
                        weekday: Number(e.target.value),
                      }))
                    }
                  >
                    {[
                      'Chủ nhật',
                      'Thứ hai',
                      'Thứ ba',
                      'Thứ tư',
                      'Thứ năm',
                      'Thứ sáu',
                      'Thứ bảy',
                    ].map((d, i) => (
                      <option value={i} key={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Nhóm địa điểm
                <select
                  value={form.group}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      group: e.target.value as CatalogScheduleInput['group'],
                    }))
                  }
                >
                  <option value="mixed">Tham quan, nhà hàng và cà phê</option>
                  <option value="sights">Tham quan</option>
                  <option value="restaurant">Nhà hàng</option>
                  <option value="cafe">Cà phê</option>
                </select>
              </label>
            </div>
            <p className="admin-soft-notice">
              Hệ thống tự nhập bản nháp và phát hiện thay đổi; người vận hành
              vẫn quyết định xuất bản.
            </p>
            <p>
              Lần chạy tiếp theo:{' '}
              <strong>
                {data.schedule.enabled
                  ? catalogTime(data.schedule.nextRunAt)
                  : 'Chưa bật lịch'}
              </strong>{' '}
              · Asia/Ho_Chi_Minh
            </p>
            <div className="admin-actions">
              <button className="journey-primary" type="submit">
                {data.schedule.enabled
                  ? 'Lưu lịch cập nhật'
                  : 'Lưu và bật tự động'}
              </button>
              {data.schedule.enabled && (
                <button type="button" onClick={() => void save(false)}>
                  Tạm dừng tự động
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </div>
      <p>
        Máy chủ GoEase phải đang chạy để cập nhật theo lịch, kể cả khi bạn đóng
        trang quản trị. Tạm dừng ngăn lượt tự động mới; lượt đã nhận vẫn hoàn
        tất hoặc thử lại.
      </p>
      <h2>Kết quả cập nhật gần đây</h2>
      <RunList data={data} />
    </>
  );
}
function RunList({ data }: { data: CatalogOperationsDto }) {
  return (
    <div className="admin-run-list">
      {!data.runs.length && (
        <p>Chưa có lượt cập nhật. Chọn Chạy ngay để kiểm tra nguồn.</p>
      )}
      {data.runs.map((r) => (
        <details key={r.id} className="admin-run">
          <summary>
            <strong>{runLabels[r.state]}</strong> · {catalogTime(r.createdAt)} ·{' '}
            {r.actor === 'system' ? 'Theo lịch' : 'Người vận hành yêu cầu'}
          </summary>
          <p>{r.message || 'Đã nhận yêu cầu; đang chờ xử lý.'}</p>
          {r.state === 'retry' && (
            <p>Tự thử lại lúc {catalogTime(r.nextAttemptAt)}.</p>
          )}
          {r.state === 'succeeded' && (
            <p>
              {r.counts.created} mới · {r.counts.updated ?? 0} cập nhật an toàn
              · {r.counts.unchanged} không đổi · {r.counts.review} cần kiểm tra
              · {r.counts.skipped} bỏ qua · {r.counts.errors} lỗi
            </p>
          )}
          {r.state === 'failed' && (
            <p>
              Chưa ghi thay đổi danh mục từ lượt này. {r.counts.errors} lỗi cần
              kiểm tra.
            </p>
          )}
          <details>
            <summary>Chi tiết cho người thiết lập</summary>
            <p>
              Mã lượt: {r.id} · Đã thử {r.attempts} lần · Kết thúc:{' '}
              {catalogTime(r.finishedAt)}
            </p>
          </details>
        </details>
      ))}
    </div>
  );
}
