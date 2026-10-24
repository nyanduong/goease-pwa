import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CatalogOperationsDto,
  CatalogReviewDto,
  CatalogScheduleInput,
  DestinationDto,
  ReviewDecision,
  SourceSnapshot,
  AdminSettings,
} from '@goease/contracts';
import { api } from '../api';
import { AdminCatalog } from './admin-catalog';
import { SourceCredit } from './source-credit';
import { AdminDashboard, AdminTopbar } from './admin-dashboard';
import {
  LayoutDashboard,
  ListTodo,
  MapPin,
  RefreshCw,
  History as HistoryIcon,
  Database,
  Settings,
} from 'lucide-react';

const tabs = {
  overview: 'Tổng quan',
  work: 'Việc cần làm',
  places: 'Địa điểm',
  automatic: 'Tự động cập nhật',
  history: 'Lịch sử & phê duyệt',
  sources: 'Nguồn dữ liệu',
  settings: 'Cài đặt',
};
const navIcons = {
  overview: LayoutDashboard,
  work: ListTodo,
  places: MapPin,
  automatic: RefreshCw,
  history: HistoryIcon,
  sources: Database,
  settings: Settings,
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
        <a
          key={key}
          href={`#${key}`}
          aria-current={tab === key ? 'page' : undefined}
        >
          {(() => {
            const Icon = navIcons[key as Tab];
            return <Icon size={20} />;
          })()}
          {label}
        </a>
      ))}
    </nav>
  );
}
export const catalogTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Chưa có';
const runLabels = {
  queued: 'Đang chờ',
  running: 'Đang lấy và kiểm tra',
  retry: 'Sẽ tự thử lại',
  succeeded: 'Đã hoàn tất',
  failed: 'Cần can thiệp',
};
const groups = {
  draft: 'Bản nháp cần xem',
  duplicate: 'Có thể trùng',
  source: 'Thông tin nguồn thay đổi / mâu thuẫn',
  price: 'Giá cần kiểm tra',
  quality: 'Chất lượng thông tin đang hiển thị',
};
const actionLabels: Record<string, string> = {
  'catalog.created': 'Thêm địa điểm',
  'catalog.restored': 'Khôi phục phiên bản thành bản nháp',
  'catalog.imported': 'Nhập bản nháp từ nguồn',
  'catalog.source_changed': 'Nguồn có thông tin mới, chờ đối chiếu',
  'catalog.updated': 'Lưu nội dung',
  'catalog.publication_changed': 'Đổi trạng thái hiển thị',
  'catalog.review_keep': 'Giữ thông tin hiện tại',
  'catalog.review_revise': 'Yêu cầu chỉnh sửa',
  'catalog.review_reject': 'Từ chối đề xuất, giữ nguyên nội dung',
  'catalog.settings_saved': 'Lưu cài đặt vận hành',
  'catalog.review_apply': 'Áp dụng thay đổi nguồn',
  'catalog.review_ignore': 'Bỏ qua việc có lý do',
  'catalog.review_later': 'Hẹn xem lại',
  'catalog.review_distinct': 'Xác nhận hai địa điểm riêng',
  'catalog.schedule_saved': 'Lưu cấu hình cập nhật',
  'catalog.run_requested': 'Yêu cầu cập nhật',
  'catalog.run_succeeded': 'Hoàn tất cập nhật',
  'catalog.run_failed': 'Cập nhật cần can thiệp',
};
type History = {
  id: string;
  action: string;
  actor: string;
  placeId: string | null;
  name: string;
  occurredAt: string;
  outcome: string;
  note?: string;
};

export function AdminWorkspace({
  destinations,
  name = 'Admin',
}: {
  destinations: DestinationDto[];
  name?: string;
}) {
  const [scope, setScope] = useState('');
  const [workQuery, setWorkQuery] = useState(''),
    [workKind, setWorkKind] = useState('');
  const [locationKey, setLocationKey] = useState(location.hash);
  useEffect(() => {
    let active = true;
    void api<AdminSettings>('/admin/catalog/settings')
      .then((s) => {
        if (active) setScope(s.defaultDestinationId ?? '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
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
  const [history, setHistory] = useState<History[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyMore, setHistoryMore] = useState(false);
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
      setLocationKey(location.hash);
      setNotice('');
      setError('');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError('');
      }
      try {
        const state = await api<CatalogOperationsDto>(
          `/admin/catalog/operations${scope ? `?destinationId=${scope}` : ''}`,
        );
        setData(state);
        if (tab === 'work' || tab === 'history') {
          const work = await api<{
            items: CatalogReviewDto[];
            total: number;
            hasMore: boolean;
          }>(
            `/admin/catalog/reviews?${new URLSearchParams({ offset: String(offset), q: workQuery, ...(scope ? { destinationId: scope } : {}), ...(workKind ? { kind: workKind } : {}) })}`,
          );
          setItems(work.items);
          setTotal(work.total);
          setMore(work.hasMore);
        }
        if (tab === 'history') {
          const value = await api<{ items: History[]; hasMore: boolean }>(
            `/admin/catalog/history?offset=${historyOffset}`,
          );
          setHistory(value.items);
          setHistoryMore(value.hasMore);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Chưa tải được dữ liệu. Hãy thử lại.',
        );
      } finally {
        setLoading(false);
      }
    },
    [tab, offset, historyOffset, scope, workQuery, workKind],
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
      />
      <div hidden={tab !== 'places'}>
        <AdminCatalog
          destinations={destinations}
          openPlace={openPlace}
          scope={scope}
          locationKey={locationKey}
        />
      </div>
      {['overview', 'sources', 'settings'].includes(tab) && (
        <AdminDashboard
          screen={tab as 'overview' | 'sources' | 'settings'}
          scope={scope}
          operations={data}
          onOpen={edit}
          destinations={destinations}
        />
      )}
      {!['places', 'overview', 'sources', 'settings'].includes(tab) && (
        <section className="admin-catalog admin-operations">
          <header className="admin-heading">
            <span className="admin-eyebrow">GOEASE · VẬN HÀNH</span>
            <h1>{tabs[tab]}</h1>
            <p>
              {tab === 'work'
                ? 'Hệ thống lo việc cập nhật. Bạn quyết định thông tin nào khách nên thấy.'
                : tab === 'automatic'
                  ? 'Thiết lập một lần. Dữ liệu được kiểm tra khi máy chủ đang chạy.'
                  : 'Theo dõi quyết định của người vận hành và kết quả cập nhật tự động.'}
            </p>
          </header>
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
          {loading ? (
            <p role="status">Đang tải dữ liệu…</p>
          ) : (
            data && (
              <>
                {tab === 'history' && (
                  <div className="admin-history-tabs">
                    <button
                      aria-pressed={historyView === 'events'}
                      onClick={() => setHistoryView('events')}
                    >
                      Nhật ký thay đổi
                    </button>
                    <button
                      aria-pressed={historyView === 'reviews'}
                      onClick={() => setHistoryView('reviews')}
                    >
                      Chờ phê duyệt ({total})
                    </button>
                  </div>
                )}
                {(tab === 'work' ||
                  (tab === 'history' && historyView === 'reviews')) &&
                  (detail ? (
                    <div className="admin-review-layout">
                      <aside className="admin-panel admin-review-queue">
                        <h2>Hàng đợi đang xem</h2>
                        {items.map((item) => (
                          <button
                            key={item.id}
                            aria-pressed={item.id === detail.id}
                            onClick={() => setDetail(item)}
                          >
                            <img
                              src={
                                item.place.imageUrl ??
                                '/images/explore-hoian.png'
                              }
                              alt=""
                            />
                            <span>
                              <strong>{item.place.name}</strong>
                              <small>{groups[item.kind]}</small>
                            </span>
                          </button>
                        ))}
                      </aside>
                      <ReviewDetail
                        review={detail}
                        onBack={() => setDetail(null)}
                        onEdit={() => edit(detail.place.id)}
                        onInspectDuplicate={edit}
                        onDone={async (message) => {
                          setNotice(message);
                          setDetail(null);
                          await refresh();
                        }}
                        onReload={async () => {
                          const v = await api<{ items: CatalogReviewDto[] }>(
                            `/admin/catalog/reviews?${new URLSearchParams({ offset: String(offset), q: workQuery, ...(scope ? { destinationId: scope } : {}), ...(workKind ? { kind: workKind } : {}) })}`,
                          );
                          const fresh = v.items.find((p) => p.id === detail.id);
                          if (fresh) setDetail(fresh);
                          else {
                            setDetail(null);
                            await refresh();
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="admin-filters">
                        <label>
                          Tìm việc theo địa điểm
                          <input
                            value={workQuery}
                            maxLength={100}
                            onChange={(e) => {
                              setWorkQuery(e.target.value);
                              setOffset(0);
                            }}
                          />
                        </label>
                        <label>
                          Loại việc
                          <select
                            value={workKind}
                            onChange={(e) => {
                              setWorkKind(e.target.value);
                              setOffset(0);
                            }}
                          >
                            <option value="">Tất cả</option>
                            {Object.entries(groups).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="admin-overview">
                        <div>
                          <strong>{total}</strong>
                          <span>việc cần quyết định</span>
                        </div>
                        <div>
                          <strong>
                            {data.runs[0]
                              ? runLabels[data.runs[0].state]
                              : 'Chưa cập nhật'}
                          </strong>
                          <span>
                            Lượt gần nhất ·{' '}
                            {catalogTime(data.runs[0]?.createdAt ?? null)}
                          </span>
                        </div>
                        <div>
                          <strong>
                            {data.schedule.enabled
                              ? 'Tự động đang bật'
                              : 'Tự động đang tắt'}
                          </strong>
                          <a href="#automatic">Xem lịch cập nhật →</a>
                        </div>
                      </div>
                      {data.runs[0]?.state === 'failed' && (
                        <section className="admin-work-group">
                          <h2>Lượt cập nhật cần can thiệp</h2>
                          <p>{data.runs[0].message}</p>
                          <a className="journey-outline" href="#automatic">
                            Kiểm tra và thử lại
                          </a>
                        </section>
                      )}
                      {data.runs[0]?.state === 'retry' && (
                        <p className="admin-soft-notice">
                          Nguồn tạm chưa sẵn sàng. Hệ thống sẽ tự thử lại lúc{' '}
                          {catalogTime(data.runs[0].nextAttemptAt)}. Bạn chưa
                          cần xử lý.
                        </p>
                      )}
                      {!total && (
                        <div className="admin-empty">
                          <h2>Hiện không có việc cần xử lý</h2>
                          <p>
                            {data.runs[0]?.message ||
                              'Chọn Tự động cập nhật để kết nối nguồn và thiết lập lịch.'}
                          </p>
                        </div>
                      )}
                      {(Object.keys(groups) as (keyof typeof groups)[]).map(
                        (kind) => {
                          const rows = items.filter((p) => p.kind === kind);
                          return (
                            !!rows.length && (
                              <section className="admin-work-group" key={kind}>
                                <h2>
                                  {groups[kind]} <span>({rows.length})</span>
                                </h2>
                                {rows.map((p) => (
                                  <article
                                    className="admin-work-row"
                                    key={p.id}
                                  >
                                    <div>
                                      <h3>{p.place.name}</h3>
                                      <p>{p.reason}</p>
                                      <small>
                                        {catalogTime(p.updatedAt)} ·{' '}
                                        {p.place.publicationStatus ===
                                        'published'
                                          ? 'Khách vẫn đang thấy nội dung hiện tại'
                                          : 'Chưa hiển thị cho khách'}
                                      </small>
                                    </div>
                                    <button
                                      className="journey-outline"
                                      onClick={() => {
                                        setDetail(p);
                                        setNotice('');
                                        window.scrollTo(0, 0);
                                      }}
                                    >
                                      Xem và quyết định
                                    </button>
                                  </article>
                                ))}
                              </section>
                            )
                          );
                        },
                      )}
                      {(more || offset > 0) && (
                        <div className="admin-actions">
                          <button
                            disabled={!offset || loading}
                            onClick={() =>
                              setOffset((v) => Math.max(0, v - 20))
                            }
                          >
                            Trang trước
                          </button>
                          <button
                            disabled={!more || loading}
                            onClick={() => setOffset((v) => v + 20)}
                          >
                            Trang tiếp
                          </button>
                        </div>
                      )}
                    </>
                  ))}
                {tab === 'automatic' && (
                  <Automatic
                    key={scope}
                    data={data}
                    onChange={setData}
                    onRefresh={() => refresh(true)}
                  />
                )}
                {tab === 'history' && historyView === 'events' && (
                  <>
                    <div className="admin-soft-notice">
                      Quyết định đang chờ được quản lý riêng với nhật ký.{' '}
                      <a href="#work">Mở hàng đợi phê duyệt →</a>
                    </div>
                    <h2>Kết quả các lượt cập nhật</h2>
                    <RunList data={data} />
                    <h2>Quyết định và thay đổi</h2>
                    {!history.length && (
                      <p>Chưa có thao tác nào được ghi nhận.</p>
                    )}
                    {history.map((h) => (
                      <article key={h.id} className="admin-work-row">
                        <div>
                          <h3>
                            {actionLabels[h.action] ?? 'Cập nhật danh mục'}
                          </h3>
                          <p>
                            {h.actor} · {catalogTime(h.occurredAt)}
                          </p>
                          <p>{h.name}</p>
                          {h.note && <p>Ghi chú: {h.note}</p>}
                          <small>
                            {h.action === 'catalog.run_failed'
                              ? 'Cần xử lý'
                              : 'Đã ghi nhận'}
                          </small>
                        </div>
                        {h.placeId && (
                          <button onClick={() => edit(h.placeId!)}>
                            Mở địa điểm
                          </button>
                        )}
                      </article>
                    ))}
                    <div className="admin-actions">
                      <button
                        disabled={!historyOffset || loading}
                        onClick={() =>
                          setHistoryOffset((v) => Math.max(0, v - 30))
                        }
                      >
                        Lịch sử trước
                      </button>
                      <button
                        disabled={!historyMore || loading}
                        onClick={() => setHistoryOffset((v) => v + 30)}
                      >
                        Xem tiếp lịch sử
                      </button>
                    </div>
                  </>
                )}
              </>
            )
          )}
        </section>
      )}
    </>
  );
}

function ReviewDetail({
  review: r,
  onBack,
  onEdit,
  onInspectDuplicate,
  onDone,
  onReload,
}: {
  review: CatalogReviewDto;
  onBack: () => void;
  onEdit: () => void;
  onInspectDuplicate: (id: string) => void;
  onDone: (message: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(1);
  const [confirmIgnore, setConfirmIgnore] = useState(false);
  const [note, setNote] = useState('');
  const key = useRef({ payload: '', value: '' });
  const fields: {
    name: string;
    current: string;
    incoming: string;
    sourceField: keyof SourceSnapshot;
  }[] = r.incoming
    ? [
        {
          name: 'Tên địa điểm',
          current: r.place.name,
          incoming: r.incoming.name,
          sourceField: 'name',
        },
        {
          name: 'Địa chỉ',
          current: r.place.locationQuery,
          incoming: r.incoming.address || 'Chưa có',
          sourceField: 'address',
        },
        {
          name: 'Nhóm địa điểm',
          current: {
            food: 'Ăn uống',
            culture: 'Văn hóa',
            nature: 'Thiên nhiên',
          }[r.place.category],
          incoming: {
            food: 'Ăn uống',
            culture: 'Văn hóa',
            nature: 'Thiên nhiên',
          }[r.incoming.category],
          sourceField: 'category',
        },
        {
          name: 'Giờ mở cửa',
          current: r.place.openingHoursNote || 'Chưa có',
          incoming: r.incoming.openingHoursNote || 'Chưa có',
          sourceField: 'openingHoursNote',
        },
        {
          name: 'Vị trí nguồn',
          current: r.currentLocation
            ? `${r.currentLocation.latitude}, ${r.currentLocation.longitude}`
            : 'Chưa có vị trí hiện tại',
          incoming: `${r.incoming.latitude}, ${r.incoming.longitude}`,
          sourceField: 'latitude',
        },
        {
          name: 'Dấu hiệu đóng cửa từ nguồn',
          current: r.previous?.closed
            ? 'Có dấu hiệu cần xác nhận'
            : 'Chưa có bằng chứng',
          incoming: r.incoming.closed
            ? 'Có dấu hiệu ngừng hoạt động; cần xác nhận'
            : 'Chưa có bằng chứng',
          sourceField: 'closed',
        },
      ]
    : [];
  async function decide(decision: ReviewDecision['decision'], publish = false) {
    if (busy) return;
    const body = {
      expectedRevision: r.revision,
      expectedPlaceRevision: r.place.revision,
      decision,
      note,
      publish,
      ...(decision === 'later'
        ? { revisitAt: new Date(Date.now() + days * 86400000).toISOString() }
        : {}),
    };
    // Retain the exact defer date and key after an uncertain response.
    const identity = JSON.stringify({
      id: r.id,
      rev: r.revision,
      place: r.place.revision,
      decision,
      days,
      note,
      publish,
    });
    if (key.current.value !== identity)
      key.current = {
        value: identity,
        payload: JSON.stringify({ key: crypto.randomUUID(), body }),
      };
    const pending = JSON.parse(key.current.payload) as {
      key: string;
      body: ReviewDecision;
    };
    setBusy(true);
    setError('');
    try {
      await api(`/admin/catalog/reviews/${r.id}/decision`, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.key },
        body: JSON.stringify(pending.body),
      });
      await onDone(
        decision === 'later'
          ? `Đã hẹn xem lại lúc ${catalogTime(pending.body.revisitAt!)}.`
          : publish
            ? 'Đã chấp thuận và xuất bản địa điểm.'
            : decision === 'revise'
              ? 'Đã ghi yêu cầu chỉnh sửa. Việc vẫn được giữ để tiếp tục xử lý.'
              : decision === 'reject'
                ? 'Đã từ chối đề xuất. Nội dung địa điểm được giữ nguyên.'
                : decision === 'apply'
                  ? 'Đã áp dụng thay đổi được đề nghị từ nguồn. Các chuyến đã lưu giữ nguyên.'
                  : decision === 'ignore'
                    ? 'Đã bỏ qua việc. Nội dung và trạng thái địa điểm được giữ nguyên.'
                    : decision === 'distinct'
                      ? 'Đã xác nhận là hai địa điểm riêng. Có thể xem bản nháp và đăng.'
                      : 'Đã giữ thông tin hiện tại. Nguồn không đổi sẽ không nhắc lại.',
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa lưu được quyết định. Hãy thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-review-detail">
      <button disabled={busy} onClick={onBack}>
        ← Về việc cần làm
      </button>
      <h2>{r.place.name}</h2>
      <p>
        {r.reason}.{' '}
        {r.place.publicationStatus === 'published'
          ? 'Khách vẫn thấy bản hiện tại cho tới khi bạn áp dụng thay đổi.'
          : 'Khách chưa thấy bản nháp này.'}
      </p>
      {error && (
        <div role="alert" className="admin-alert">
          {error}
          <button
            disabled={busy}
            onClick={() => {
              void onReload().catch((e) =>
                setError(
                  e instanceof Error ? e.message : 'Chưa tải được bản mới.',
                ),
              );
            }}
          >
            Mở bản mới để đối chiếu
          </button>
        </div>
      )}
      {!!r.duplicates.length && (
        <p className="admin-soft-notice">
          Có thể trùng: {r.duplicates.join(', ')}. So sánh tên và vị trí trước
          khi xác nhận đây là hai địa điểm riêng.
        </p>
      )}
      {!!r.duplicatePlaces.length && (
        <section className="admin-work-group">
          <h3>Các địa điểm cần đối chiếu</h3>
          {r.duplicatePlaces.map((p) => (
            <article key={p.id} className="admin-work-row">
              <div>
                <h3>{p.name}</h3>
                <p>{p.locationQuery}</p>
                <p>
                  {p.publicationStatus === 'published'
                    ? 'Đang hiển thị cho khách'
                    : p.publicationStatus === 'draft'
                      ? 'Bản nháp khác'
                      : 'Đã ngừng hiển thị'}
                </p>
                <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                  Xem nguồn đối chiếu ↗
                </a>
              </div>
              <button disabled={busy} onClick={() => onInspectDuplicate(p.id)}>
                Mở địa điểm đối chiếu
              </button>
            </article>
          ))}
        </section>
      )}
      {r.incoming ? (
        <>
          <p>
            Lấy từ nguồn lúc {catalogTime(r.fetchedAt)}. Đây không phải ngày con
            người xác minh.{' '}
            <a href={r.incoming.sourceUrl} target="_blank" rel="noreferrer">
              Mở nguồn đối chiếu ↗
            </a>
          </p>
          <div className="admin-comparison">
            <table>
              <thead>
                <tr>
                  <th>Thông tin</th>
                  <th>Nội dung hiện tại / nguồn trước</th>
                  <th>Nguồn mới</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => {
                  const changed = f.current !== f.incoming;
                  const proposed =
                    !r.previous ||
                    JSON.stringify(r.previous[f.sourceField]) !==
                      JSON.stringify(r.incoming![f.sourceField]) ||
                    (f.sourceField === 'latitude' &&
                      r.previous.longitude !== r.incoming!.longitude);
                  return (
                    <tr
                      key={f.name}
                      className={changed ? 'has-difference' : ''}
                    >
                      <th>
                        {f.name}
                        {changed && <small>Khác nhau</small>}
                      </th>
                      <td>{f.current}</td>
                      <td>
                        {f.incoming}
                        {r.kind === 'source' && changed && (
                          <small>
                            {proposed
                              ? 'Đề nghị áp dụng'
                              : 'Giữ phần đã biên tập'}
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SourceCredit expanded />
        </>
      ) : (
        <div className="admin-preview">
          <h3>Thông tin hiện tại</h3>
          <p>{r.place.description}</p>
          <p>{r.place.locationQuery}</p>
          <a href={r.place.sourceUrl} target="_blank" rel="noreferrer">
            Mở nguồn thông tin ↗
          </a>
          {r.kind === 'price' && (
            <p>
              Giá kiểm tra lần cuối ngày {r.place.referencePrice?.checkedAt};
              đến hạn ngày {r.place.referencePrice?.reviewAfter}. Giá này không
              dùng cho dự toán mới. Mở địa điểm để cập nhật hoặc bỏ giá chưa rõ.
            </p>
          )}
        </div>
      )}
      {r.incoming?.closed && (
        <p className="admin-alert">
          Áp dụng dấu hiệu đóng cửa sẽ ngừng hiển thị địa điểm cho khách. Lịch
          đã lưu không thay đổi.
        </p>
      )}
      <label>
        Ghi chú quyết định
        <textarea
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lý do quyết định hoặc thông tin cần bổ sung"
        />
      </label>
      <div className="admin-actions">
        <button disabled={busy} className="journey-primary" onClick={onEdit}>
          Mở địa điểm để biên tập
        </button>
        {r.kind === 'source' && (
          <button disabled={busy} onClick={() => void decide('apply')}>
            Áp dụng thay đổi
          </button>
        )}
        {['source', 'draft'].includes(r.kind) && (
          <button
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  'Chấp thuận nội dung và xuất bản cho khách? Server sẽ kiểm tra lại các điều kiện bắt buộc.',
                )
              )
                void decide(r.kind === 'source' ? 'apply' : 'keep', true);
            }}
          >
            Chấp thuận và xuất bản
          </button>
        )}
        <button
          disabled={busy || !note.trim()}
          onClick={() => void decide('revise')}
        >
          Yêu cầu chỉnh sửa
        </button>
        {r.kind === 'source' && (
          <button
            disabled={busy || !note.trim()}
            onClick={() => void decide('reject')}
          >
            Từ chối đề xuất
          </button>
        )}
        {r.kind === 'duplicate' && (
          <button disabled={busy} onClick={() => void decide('distinct')}>
            Đây là hai địa điểm riêng
          </button>
        )}
        {r.kind !== 'duplicate' && (
          <button disabled={busy} onClick={() => void decide('keep')}>
            Giữ thông tin hiện tại
          </button>
        )}
        <button disabled={busy} onClick={() => setConfirmIgnore(true)}>
          Bỏ qua việc này
        </button>
      </div>
      {confirmIgnore && (
        <div className="admin-preview">
          <p>
            Việc sẽ được đóng với lý do đã nhập. Địa điểm vẫn giữ nội dung và
            trạng thái hiển thị hiện tại.
          </p>
          <button disabled={busy} onClick={() => void decide('ignore')}>
            Xác nhận bỏ qua việc
          </button>
          <button disabled={busy} onClick={() => setConfirmIgnore(false)}>
            Quay lại
          </button>
        </div>
      )}
      <div className="admin-defer">
        <label>
          Xem lại sau
          <select
            disabled={busy}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>1 ngày</option>
            <option value={7}>1 tuần</option>
            <option value={30}>30 ngày</option>
          </select>
        </label>
        <button disabled={busy} onClick={() => void decide('later')}>
          Để sau
        </button>
        <small>
          Hẹn vào{' '}
          {catalogTime(new Date(Date.now() + days * 86400000).toISOString())}{' '}
          (giờ Việt Nam)
        </small>
      </div>
    </section>
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
      <div className="admin-source-status">
        <div>
          <h2>Geoapify · OpenStreetMap</h2>
          <p>
            {data.connected
              ? 'Đã cấu hình kết nối nguồn'
              : 'Chưa kết nối nguồn dữ liệu'}
          </p>
          <p>
            Theo khu vực đang chọn · phạm vi đã lưu trong Cài đặt · tối đa 50
            kết quả/lượt
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
            GEOAPIFY_API_KEY trong server/.env, rồi khởi động lại API. Khóa chỉ
            được lưu ở máy chủ.
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
      <form
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
                  const [hour, minute] = e.target.value.split(':').map(Number);
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
                    setForm((v) => ({ ...v, weekday: Number(e.target.value) }))
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
            Hệ thống tự nhập bản nháp và phát hiện thay đổi; người vận hành vẫn
            quyết định xuất bản.
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
      <p>
        Máy chủ GoEase phải đang chạy để cập nhật theo lịch, kể cả khi bạn đóng
        trang quản trị. Tạm dừng ngăn lượt tự động mới; lượt đã nhận vẫn hoàn
        tất hoặc thử lại.
      </p>
      <a href="#places?import=1" className="journey-outline">
        Chạy thử & xem trước dữ liệu
      </a>
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
