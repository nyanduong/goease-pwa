import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Database,
  MapPin,
  Pause,
  Play,
  Plus,
  Info,
  RefreshCw,
  Search,
} from 'lucide-react';
import type {
  AdminSettings,
  AdminSourceStatus,
  CampaignDetail,
  CampaignInput,
  CampaignSummary,
  CampaignListDto,
  CatalogOperationsDto,
  CatalogPolicyDto,
  DestinationDto,
} from '@goease/contracts';
import { api } from '../api';
import { AdminPageHeader } from './admin-visuals';

const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Chưa có';
const groupLabels = {
  mixed: 'Tham quan, nhà hàng & cà phê',
  sights: 'Địa điểm tham quan',
  restaurant: 'Nhà hàng',
  cafe: 'Cà phê',
};
export const operationState = (state: string) =>
  ({
    queued: 'Đang chờ',
    running: 'Đang thu thập',
    retry: 'Chờ thử lại',
    succeeded: 'Hoàn tất',
    partial: 'Hoàn tất một phần',
    failed: 'Cần xử lý',
    paused: 'Đã tạm dừng',
  })[state] ?? state;
const sourceState = {
  not_configured: 'Chưa cấu hình',
  not_checked: 'Chưa kiểm chứng kết nối',
  fetched: 'Đã nhận dữ liệu',
  permission_denied: 'Thiếu quyền nguồn',
  checking: 'Đang gọi nguồn',
  failed: 'Kết nối có lỗi',
};

export function AdminSourceConnection({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [value, setValue] = useState<AdminSourceStatus | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void api<AdminSourceStatus>('/admin/v3/sources')
      .then((v) => {
        if (active) setValue(v);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được nguồn.');
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section
      className={`admin-panel admin-source-connection${compact ? ' is-compact' : ''}`}
    >
      <div className="admin-panel-title">
        <h2>
          <Database size={17} /> Nguồn & hạn mức
        </h2>
        <button onClick={() => setRetry((v) => v + 1)}>
          <RefreshCw size={15} /> Làm mới trạng thái
        </button>
      </div>
      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {!value && !error && <p role="status">Đang đọc trạng thái nguồn…</p>}
      {value && (
        <>
          <h3>Geoapify / OpenStreetMap</h3>
          <span
            className={`admin-pill ${value.connectionState === 'fetched' ? 'is-good' : 'is-warning'}`}
          >
            {sourceState[value.connectionState]}
          </span>
          <p>
            Kết nối: {value.configured ? 'Đã thiết lập' : 'Chưa thiết lập'} ·
            Lần nhận dữ liệu: {time(value.lastFetchAt)}
          </p>
          {value.lastErrorCode && (
            <p className="admin-alert">
              Mã lỗi gần nhất: {value.lastErrorCode}.{' '}
              <a href="#automatic">Mở đợt để xem và thử lại</a>.
            </p>
          )}
          {!compact && (
            <>
              <div className="admin-metrics">
                <div>
                  <small>Lượt tìm trong 24 giờ</small>
                  <strong>{value.usage24h.requests}</strong>
                </div>
                <div>
                  <small>Lượt nhận thành công</small>
                  <strong>{value.usage24h.fetched}</strong>
                </div>
                <div>
                  <small>Kết quả nguồn đã nhận</small>
                  <strong>{value.usage24h.received}</strong>
                </div>
                <div>
                  <small>Lượt lỗi</small>
                  <strong>{value.usage24h.failed}</strong>
                </div>
              </div>
              <details className="admin-detail-note">
                <summary>Giới hạn sử dụng & bản quyền</summary>
                <div className="admin-two-column">
                  <div>
                    <h3>Giới hạn lượt sử dụng</h3>
                    <p>
                      {value.quota.requestsPerHour} lượt tìm/giờ toàn hệ thống ·{' '}
                      {value.quota.requestsPerActorHour} lượt/người/giờ ·{' '}
                      {value.quota.concurrentSearches} lượt đồng thời · tối đa{' '}
                      {value.maxResultsPerRun} kết quả/lượt.
                    </p>
                    <p>
                      Đây là giới hạn lượt tìm nội bộ. Credits, số dư và chi phí
                      nhà cung cấp: <strong>chưa có dữ liệu đối soát</strong>.
                      Không quy đổi lượt tìm thành credits.
                    </p>
                  </div>
                  <div>
                    <h3>Quyền sử dụng</h3>
                    <p>
                      Dữ kiện: OpenStreetMap / ODbL-1.0, phải ghi nguồn. Kết nối
                      chưa cấp ảnh có quyền sử dụng. Quyền ảnh cần bằng chứng
                      riêng cho từng ảnh.
                    </p>
                    <p>
                      Dữ liệu gốc:{' '}
                      {value.rights.rawPayloadStored
                        ? 'có lưu theo chính sách nguồn'
                        : 'không lưu'}
                      .
                    </p>
                  </div>
                </div>
              </details>
            </>
          )}
          {!value.configured && (
            <details>
              <summary>Hướng dẫn cho người thiết lập</summary>
              <p>
                Đặt GEOAPIFY_API_KEY trong cấu hình riêng của API rồi khởi động
                lại máy chủ. Khóa chỉ nằm ở máy chủ. Sau khi cấu hình, chạy một
                phạm vi nhỏ để kiểm chứng kết nối và quyền.
              </p>
            </details>
          )}
          {compact && (
            <a className="admin-source-link" href="#sources">
              Xem nguồn & hạn mức <ArrowRight size={15} />
            </a>
          )}
          <small>
            Trạng thái từ máy chủ lúc {time(value.checkedAt)}. Khóa đã cấu hình
            chưa đồng nghĩa đã gọi nguồn thành công.
          </small>
        </>
      )}
    </section>
  );
}

export function AdminCampaigns({
  destinations,
  scope,
  operations,
  onRefresh,
}: {
  destinations: DestinationDto[];
  scope: string;
  operations: CatalogOperationsDto | null;
  onRefresh: () => Promise<void>;
}) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]),
    [hasMore, setHasMore] = useState(false),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<CampaignListDto['summary'] | null>(
    null,
  );
  const [listSearch, setListSearch] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState(
    () =>
      new URLSearchParams(location.hash.split('?')[1] ?? '').get(
        'destinationId',
      ) ?? '',
  );
  const loadGeneration = useRef(0);
  const [detail, setDetail] = useState<CampaignDetail | null>(null),
    [creating, setCreating] = useState(false),
    [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem('goease-admin-campaign-draft') ?? '[]',
      );
      return Array.isArray(value)
        ? value
            .filter(
              (v): v is string =>
                typeof v === 'string' && /^[a-f0-9]{24}$/.test(v),
            )
            .slice(0, 20)
        : [];
    } catch {
      return [];
    }
  });
  const [group, setGroup] = useState<CampaignInput['group']>('mixed'),
    [policyId, setPolicyId] = useState(''),
    [policies, setPolicies] = useState<CatalogPolicyDto[]>([]),
    [settings, setSettings] = useState<AdminSettings | null>(null);
  const [q, setQ] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const request = useRef({ body: '', key: '' });
  const detailId = detail?.campaign.id;
  const load = useCallback(
    async (background = false) => {
      const generation = ++loadGeneration.current;
      if (!background) setLoading(true);
      setError('');
      try {
        const [list, rules, config] = await Promise.all([
          api<CampaignListDto>(
            `/admin/v3/campaigns?${new URLSearchParams({
              offset: String(offset),
              q: listQuery,
              ...(stateFilter ? { state: stateFilter } : {}),
              ...(destinationFilter
                ? { destinationId: destinationFilter }
                : {}),
            })}`,
          ),
          api<{ items: CatalogPolicyDto[] }>('/admin/v3/policies'),
          api<AdminSettings>('/admin/catalog/settings'),
        ]);
        if (generation !== loadGeneration.current) return;
        setCampaigns(list.items);
        setTotal(list.total);
        setHasMore(list.hasMore);
        setSummary(list.summary);
        setPolicies(rules.items);
        setSettings(config);
      } catch (e) {
        if (generation !== loadGeneration.current) return;
        setError(e instanceof Error ? e.message : 'Chưa tải được các đợt.');
      } finally {
        if (generation === loadGeneration.current) setLoading(false);
      }
    },
    [offset, listQuery, stateFilter, destinationFilter],
  );
  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current++;
    };
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setListQuery(listSearch);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [listSearch]);
  useEffect(() => {
    if (creating || detailId) return;
    const timer = setInterval(() => {
      void load(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [load, creating, detailId]);
  useEffect(() => {
    localStorage.setItem(
      'goease-admin-campaign-draft',
      JSON.stringify(selected),
    );
  }, [selected]);
  useEffect(() => {
    setNotice('');
    setError('');
  }, [scope]);
  useEffect(() => {
    if (!detailId) return;
    let active = true;
    const timer = setInterval(() => {
      void api<CampaignDetail>(`/admin/v3/campaigns/${detailId}`)
        .then((v) => {
          if (active) setDetail(v);
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : 'Chưa cập nhật được tiến trình.',
            );
        });
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [detailId]);
  async function open(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDetail(await api<CampaignDetail>(`/admin/v3/campaigns/${id}`));
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa mở được đợt.');
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    const body = JSON.stringify({
      destinationIds: selected,
      group,
      ...(policyId ? { policyId } : {}),
    });
    if (body !== request.current.body)
      request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDetail(
        await api<CampaignDetail>('/admin/v3/campaigns', {
          method: 'POST',
          headers: { 'Idempotency-Key': request.current.key },
          body,
        }),
      );
      setCreating(false);
      request.current = { body: '', key: '' };
      setNotice(
        'Đã tạo đợt. Đã lưu khu vực và cách xử lý cho đợt này. Đổi bộ lọc không làm thay đổi đợt.',
      );
      await load();
      await onRefresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa tạo được đợt. Lựa chọn vẫn được giữ.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function control(action: 'pause' | 'resume' | 'retry_failed') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDetail(
        await api<CampaignDetail>(
          `/admin/v3/campaigns/${detail.campaign.id}/control`,
          { method: 'POST', body: JSON.stringify({ action }) },
        ),
      );
      setNotice(
        action === 'pause'
          ? 'Đợt đã tạm dừng.'
          : action === 'resume'
            ? 'Đã tiếp tục phần còn lại của đợt.'
            : 'Đã đưa phần lỗi vào hàng đợi thử lại.',
      );
      await load();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được.');
    } finally {
      setBusy(false);
    }
  }
  const invalidScopes = selected.filter(
    (id) =>
      !settings?.regions?.some((r) => r.destinationId === id && r.enabled) ||
      !destinations.some((d) => d.id === id),
  );
  const chosenPolicy = policies.find((p) => p.id === policyId);
  const rows = destinations.filter((d) =>
    d.name.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')),
  );
  return (
    <>
      <AdminPageHeader
        title="Đợt thu thập"
        description="Lấy dữ liệu địa điểm từ các nguồn và theo dõi kết quả từng đợt."
        actions={
          <div className="admin-actions admin-campaign-actions">
            <button
              disabled={busy || loading}
              onClick={() => {
                void load();
                if (detail) void open(detail.campaign.id);
              }}
            >
              <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />{' '}
              Làm mới
            </button>
            <button
              className="journey-primary"
              disabled={busy || loading}
              onClick={() => {
                setCreating(true);
                setDetail(null);
                setStep(1);
                setError('');
                setNotice('');
              }}
            >
              <Plus size={17} /> Tạo đợt thu thập
            </button>
          </div>
        }
      />
      {error && (
        <p className="admin-alert" role="alert">
          {error}
          <button disabled={loading} onClick={() => void load()}>
            Thử lại
          </button>
        </p>
      )}
      {notice && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}
      {creating ? (
        <>
          <ol className="admin-steps">
            <li aria-current={step === 1 ? 'step' : undefined}>
              1. Chọn phạm vi
            </li>
            <li aria-current={step === 2 ? 'step' : undefined}>
              2. Nguồn & quy tắc
            </li>
            <li aria-current={step === 3 ? 'step' : undefined}>
              3. Kiểm tra & bắt đầu
            </li>
          </ol>
          <div className="admin-two-column">
            <section className="admin-panel">
              {step === 1 && (
                <>
                  <h2>Phạm vi đợt thu thập</h2>
                  <p>
                    Chọn tối đa 20 điểm đến, gồm điểm đến nháp hoặc lưu trữ.
                    Phạm vi xem hiện tại:{' '}
                    <strong>
                      {destinations.find((d) => d.id === scope)?.name ??
                        'Tất cả điểm đến'}
                    </strong>
                    . Lựa chọn đợt được giữ riêng.
                  </p>
                  <label className="admin-global-search">
                    <Search size={17} />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Tìm điểm đến quản trị"
                    />
                  </label>
                  <p className="admin-list-count">
                    Đã chọn {selected.length}/20 điểm đến
                  </p>
                  <div className="admin-scope-options">
                    {rows.map((d) => {
                      const area = settings?.regions?.find(
                        (r) => r.destinationId === d.id,
                      );
                      return (
                        <label key={d.id} className="admin-scope-option">
                          <input
                            type="checkbox"
                            checked={selected.includes(d.id)}
                            disabled={
                              selected.length >= 20 && !selected.includes(d.id)
                            }
                            onChange={(e) =>
                              setSelected((v) =>
                                e.target.checked
                                  ? [...v, d.id]
                                  : v.filter((id) => id !== d.id),
                              )
                            }
                          />
                          <span>
                            <strong>{d.name}</strong>
                            <small>
                              {area?.enabled
                                ? `Đã cấu hình · bán kính ${area.radiusMeters / 1000} km`
                                : 'Chưa có phạm vi đang bật'}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {!rows.length && (
                    <p>
                      Chưa có điểm đến phù hợp.{' '}
                      <a href="#settings">Quản lý điểm đến</a>.
                    </p>
                  )}
                </>
              )}
              {step === 2 && (
                <div className="admin-form-stack">
                  <h2>Nguồn và cách xử lý</h2>
                  <label>
                    Nguồn dữ liệu
                    <select disabled value="geoapify">
                      <option value="geoapify">Geoapify / OpenStreetMap</option>
                    </select>
                  </label>
                  <label>
                    Nhóm cần thu thập
                    <select
                      value={group}
                      onChange={(e) =>
                        setGroup(e.target.value as CampaignInput['group'])
                      }
                    >
                      <option value="mixed">
                        Tham quan, nhà hàng và cà phê
                      </option>
                      <option value="sights">Tham quan</option>
                      <option value="restaurant">Nhà hàng</option>
                      <option value="cafe">Cà phê</option>
                    </select>
                  </label>
                  <label>
                    Cách xử lý thay đổi
                    <select
                      value={policyId}
                      onChange={(e) => setPolicyId(e.target.value)}
                    >
                      <option value="">
                        An toàn mặc định · đưa thay đổi vào mục cần kiểm tra
                      </option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · bản {p.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Không tự xuất bản. Quy tắc chỉ cho phép cập nhật giờ của bản
                    nháp đủ điều kiện khi đã bật; trường khóa và thay đổi quan
                    trọng luôn được bảo vệ.
                  </p>
                  <a href="#rules">Mô phỏng quy tắc trước khi dùng →</a>
                </div>
              )}
              {step === 3 && (
                <>
                  <h2>Kiểm tra trước khi chạy</h2>
                  <dl>
                    <dt>Phạm vi đã chọn</dt>
                    <dd>
                      {selected
                        .map(
                          (id) =>
                            destinations.find((d) => d.id === id)?.name ??
                            'Điểm đến không còn tồn tại',
                        )
                        .join(', ')}
                    </dd>
                    <dt>Nguồn</dt>
                    <dd>Geoapify / OpenStreetMap</dd>
                    <dt>Quy tắc</dt>
                    <dd>
                      {chosenPolicy
                        ? `${chosenPolicy.name} · bản ${chosenPolicy.version}`
                        : 'An toàn mặc định'}
                    </dd>
                    <dt>Xuất bản tự động</dt>
                    <dd>Tắt</dd>
                  </dl>
                  <p>
                    Tiến độ được lưu riêng cho từng điểm đến. Nguồn trả rỗng
                    hoặc không phản hồi không có nghĩa địa điểm đã đóng cửa.
                  </p>
                  {invalidScopes.length > 0 && (
                    <div className="admin-alert">
                      {invalidScopes.length} điểm đến chưa có phạm vi đang bật
                      hoặc không còn khả dụng.{' '}
                      <a href="#settings">Lưu phạm vi trong Cài đặt</a> rồi tải
                      lại.
                    </div>
                  )}
                  <div className="admin-soft-notice">
                    Khu vực, nguồn và cách xử lý được giữ theo lúc bắt đầu. Quy
                    tắc mới không đổi đợt đang chạy.
                  </div>
                </>
              )}
              <div className="admin-actions">
                <button disabled={busy} onClick={() => setCreating(false)}>
                  Hủy thiết lập
                </button>
                {step > 1 && (
                  <button disabled={busy} onClick={() => setStep((v) => v - 1)}>
                    Quay lại
                  </button>
                )}
                {step < 3 ? (
                  <button
                    className="journey-primary"
                    disabled={!selected.length}
                    onClick={() => setStep((v) => v + 1)}
                  >
                    Tiếp tục <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    className="journey-primary"
                    disabled={
                      busy ||
                      !operations?.connected ||
                      !!invalidScopes.length ||
                      !selected.length
                    }
                    onClick={() => void create()}
                  >
                    {busy ? 'Đang tạo đợt…' : 'Bắt đầu đợt thu thập'}
                  </button>
                )}
              </div>
              {step === 3 && !operations?.connected && (
                <p className="admin-alert">
                  Chưa có nguồn đã cấu hình. Kiểm tra kết nối trước khi bắt đầu.
                </p>
              )}
            </section>
            <aside>
              <AdminSourceConnection compact />
              <section className="admin-panel">
                <h2>Luồng xử lý</h2>
                <p>
                  <MapPin size={15} /> Chọn khu vực → lấy dữ liệu → kiểm tra →
                  xem trước → đăng cho khách.
                </p>
                <p>
                  Thông tin chưa rõ sẽ chờ bạn kiểm tra. Dữ liệu mới không tự
                  đăng cho khách.
                </p>
              </section>
            </aside>
          </div>
        </>
      ) : detail ? (
        <>
          <div className="admin-panel-title">
            <h2>{operationState(detail.campaign.state)}</h2>
            <div className="admin-actions">
              {detail.campaign.state === 'paused' ? (
                <button
                  className="journey-primary"
                  disabled={busy}
                  onClick={() => void control('resume')}
                >
                  <Play size={15} /> Tiếp tục đợt
                </button>
              ) : (
                <button
                  disabled={
                    busy ||
                    ['succeeded', 'failed', 'partial'].includes(
                      detail.campaign.state,
                    )
                  }
                  onClick={() => void control('pause')}
                >
                  <Pause size={15} /> Tạm dừng
                </button>
              )}
              <button
                disabled={busy || !detail.campaign.failedTasks}
                onClick={() => void control('retry_failed')}
              >
                <RefreshCw size={15} /> Thử lại phần lỗi
              </button>
              <button
                onClick={() => {
                  setDetail(null);
                  setNotice('');
                }}
              >
                Danh sách đợt
              </button>
            </div>
          </div>
          <div className="admin-metrics">
            <div>
              <small>Phạm vi trong đợt</small>
              <strong>{detail.totalTasks}</strong>
            </div>
            <div>
              <small>Hoàn tất</small>
              <strong>{detail.campaign.completedTasks}</strong>
            </div>
            <div>
              <small>Cần xử lý</small>
              <strong>{detail.campaign.failedTasks}</strong>
            </div>
            <div>
              <small>Tạm dừng</small>
              <strong>{detail.campaign.pausedTasks}</strong>
            </div>
          </div>
          <div className="admin-soft-notice">
            Nguồn {detail.campaign.source} · quy tắc bản{' '}
            {detail.campaign.policy.version} · không tự xuất bản. Tạo lúc{' '}
            {time(detail.campaign.createdAt)}. Tiến trình lấy từ máy chủ.
          </div>
          <section className="admin-panel">
            <h2>Tiến độ theo điểm đến</h2>
            {detail.tasks.map((task) => (
              <article className="admin-campaign-row" key={task.id}>
                <div>
                  <h3>
                    {task.destinationName ||
                      destinations.find((d) => d.id === task.destinationId)
                        ?.name ||
                      'Điểm đến'}
                  </h3>
                  <span
                    className={`admin-pill ${task.state === 'succeeded' ? 'is-good' : ['failed', 'retry'].includes(task.state) ? 'is-warning' : ''}`}
                  >
                    {operationState(task.state)}
                  </span>
                  <p>{task.message || 'Đang chờ máy chủ xử lý.'}</p>
                  <small>
                    {task.counts.created} mới · {task.counts.updated ?? 0} cập
                    nhật an toàn · {task.counts.unchanged} không đổi ·{' '}
                    {task.counts.review} mục cần kiểm tra ·{' '}
                    {task.counts.skipped} bỏ qua · {task.counts.errors} lỗi
                  </small>
                  {task.state === 'retry' && (
                    <small>Thử lại từ {time(task.nextAttemptAt)}</small>
                  )}
                  <details>
                    <summary>Chi tiết kỹ thuật</summary>
                    <p>
                      Mã tác vụ {task.id} · số lần thử {task.attempts} · kết
                      thúc {time(task.finishedAt)}
                    </p>
                  </details>
                </div>
                <CheckCircle2
                  size={20}
                  aria-hidden="true"
                  color={task.state === 'succeeded' ? '#28846e' : '#b7c6ce'}
                />
              </article>
            ))}
          </section>
          <div className="admin-actions">
            <a href="#work" className="journey-primary">
              Xem các mục cần kiểm tra
            </a>
            <a href="#places">Xem địa điểm đã lấy →</a>
          </div>
        </>
      ) : (
        <>
          <div
            className="admin-campaign-stats"
            aria-label="Tổng quan tất cả đợt thu thập"
          >
            {(
              [
                ['running', 'Đang chạy', 'đợt đang thực hiện', Play],
                [
                  'completedToday',
                  'Hoàn tất hôm nay',
                  'đợt hoàn tất trong ngày Việt Nam',
                  CheckCircle2,
                ],
                [
                  'issues',
                  'Có lỗi',
                  'đợt có tác vụ hoặc kết quả lỗi',
                  AlertTriangle,
                ],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={`admin-campaign-stat is-${key}`}>
                <div>
                  <h2>{label}</h2>
                  <strong>{summary?.[key] ?? '—'}</strong>
                </div>
              </div>
            ))}
          </div>
          <section
            className="admin-panel admin-campaign-list"
            aria-label="Danh sách đợt thu thập"
            aria-busy={loading}
          >
            <div className="admin-campaign-list-toolbar">
              <h2>
                Danh sách đợt thu thập <span>{total} đợt</span>
              </h2>
              <div className="admin-campaign-filters">
                <label className="admin-campaign-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    aria-label="Tìm đợt thu thập"
                    placeholder="Tìm theo địa phương hoặc mã đợt…"
                    value={listSearch}
                    maxLength={100}
                    onChange={(e) => setListSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Lọc trạng thái đợt"
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="running">Đang chạy</option>
                  <option value="succeeded">Hoàn tất</option>
                  <option value="issues">Có lỗi</option>
                  <option value="paused">Đã tạm dừng</option>
                </select>
                <select
                  aria-label="Lọc địa phương đợt"
                  value={destinationFilter}
                  onChange={(e) => {
                    setDestinationFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Tất cả địa phương</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {loading && (
              <p className="admin-campaign-loading" role="status">
                Đang tải đợt thu thập…
              </p>
            )}
            {!loading && !campaigns.length && !error && (
              <div className="admin-empty">
                <Database size={32} />
                <h3>
                  {listQuery || stateFilter || destinationFilter
                    ? 'Không có đợt phù hợp'
                    : 'Chưa có đợt thu thập'}
                </h3>
                <p>
                  {listQuery || stateFilter || destinationFilter
                    ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại các đợt.'
                    : 'Tạo đợt đầu tiên để bổ sung dữ liệu địa điểm. Dữ liệu mới được lưu nháp để kiểm tra.'}
                </p>
                {(listQuery || stateFilter || destinationFilter) && (
                  <button
                    onClick={() => {
                      setListSearch('');
                      setListQuery('');
                      setStateFilter('');
                      setDestinationFilter('');
                      setOffset(0);
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
            {!!campaigns.length && (
              <div className="admin-campaign-table-wrap">
                <table className="admin-campaign-table">
                  <thead>
                    <tr>
                      <th scope="col">Đợt thu thập</th>
                      <th scope="col">Trạng thái & tiến độ</th>
                      <th scope="col">Kết quả</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => {
                      const hasErrors =
                        c.failedTasks > 0 || c.counts.errors > 0;
                      const title =
                        c.groups.map((g) => groupLabels[g]).join(', ') ||
                        'Thu thập địa điểm';
                      const names = c.destinations.map(
                        (d) =>
                          d.name ||
                          destinations.find((v) => v.id === d.id)?.name ||
                          'Địa phương chưa rõ',
                      );
                      const action = hasErrors
                        ? 'Xem lỗi'
                        : c.state === 'succeeded'
                          ? 'Xem kết quả'
                          : 'Xem tiến trình';
                      const StatusIcon = hasErrors
                        ? AlertTriangle
                        : c.state === 'succeeded'
                          ? CheckCircle2
                          : c.state === 'paused'
                            ? Pause
                            : Play;
                      return (
                        <tr key={c.id}>
                          <td>
                            <h3>
                              {title} ·{' '}
                              {names.length > 1
                                ? `${names.length} địa phương`
                                : names[0] || 'Chưa rõ phạm vi'}
                            </h3>
                            {names.length > 1 && (
                              <small>{names.join(', ')}</small>
                            )}
                            <small className="admin-campaign-code" title={c.id}>
                              #{c.id.slice(-8).toUpperCase()} ·{' '}
                              {c.source === 'geoapify'
                                ? 'Geoapify / OpenStreetMap'
                                : c.source}
                            </small>
                            <small>Tạo lúc {time(c.createdAt)}</small>
                          </td>
                          <td>
                            <span
                              className={`admin-campaign-status is-${hasErrors ? 'issues' : c.state}`}
                            >
                              <StatusIcon size={14} />
                              {hasErrors && c.state === 'succeeded'
                                ? 'Hoàn tất · có lỗi'
                                : operationState(c.state)}
                            </span>
                            <div className="admin-campaign-progress">
                              <progress
                                value={c.completedTasks}
                                max={c.totalTasks || 1}
                                aria-label={`Tiến độ đợt ${c.id.slice(-8)}: ${c.completedTasks}/${c.totalTasks} tác vụ thành công`}
                              />
                              <span>
                                {Math.round(
                                  (c.completedTasks / (c.totalTasks || 1)) *
                                    100,
                                )}
                                %
                              </span>
                            </div>
                            <small>
                              {c.completedTasks}/{c.totalTasks} tác vụ thành
                              công
                            </small>
                          </td>
                          <td>
                            <strong>
                              {c.counts.created} mới · {c.counts.updated} cập
                              nhật
                            </strong>
                            <small>{c.counts.review} cần kiểm tra</small>
                            <small
                              className={
                                hasErrors ? 'admin-campaign-error' : ''
                              }
                            >
                              {hasErrors
                                ? `${c.failedTasks} tác vụ lỗi · ${c.counts.errors} lỗi xử lý`
                                : '0 lỗi'}
                            </small>
                          </td>
                          <td>
                            <button
                              onClick={() => void open(c.id)}
                              disabled={busy || loading}
                              aria-label={`${action} đợt ${c.id.slice(-8)}`}
                            >
                              {action} <ArrowRight size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="admin-campaign-list-footer">
              <span>
                {total
                  ? `Hiển thị ${offset + 1}–${offset + campaigns.length} / ${total} đợt`
                  : '0 đợt'}
              </span>
              <div className="admin-actions">
                <button
                  disabled={!offset || loading}
                  onClick={() => setOffset((v) => Math.max(0, v - 20))}
                >
                  Trang trước
                </button>
                <span>Trang {Math.floor(offset / 20) + 1}</span>
                <button
                  disabled={!hasMore || loading}
                  onClick={() => setOffset((v) => v + 20)}
                >
                  Trang tiếp
                </button>
              </div>
            </div>
          </section>
          <AdminSourceConnection compact />
          <p className="admin-campaign-help">
            <Info size={16} /> Mỗi đợt lưu riêng phạm vi, nguồn và quy tắc thu
            thập. Dữ liệu thu được cần kiểm tra trước khi xuất bản.{' '}
            <a href="#rules">Quy tắc & lịch →</a>
          </p>
        </>
      )}
    </>
  );
}
