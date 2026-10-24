import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import type {
  AdminSettings,
  AdminSourceStatus,
  CampaignDetail,
  CampaignInput,
  CampaignSummary,
  CatalogOperationsDto,
  CatalogPolicyDto,
  DestinationDto,
} from '@goease/contracts';
import { api } from '../api';

const time = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
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
    <section className="admin-panel admin-source-connection">
      <div className="admin-panel-title">
        <h2>
          <Database size={17} /> Nguồn & hạn mức
        </h2>
        <button onClick={() => setRetry((v) => v + 1)}>
          Làm mới trạng thái
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
            Đã cấu hình khóa: {value.configured ? 'Có' : 'Chưa'} · Lần nhận dữ
            liệu: {time(value.lastFetchAt)}
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
              <div className="admin-two-column">
                <div>
                  <h3>Giới hạn bảo vệ nội bộ</h3>
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
                    Dữ kiện: OpenStreetMap / ODbL-1.0, phải ghi nguồn. Connector
                    chưa cấp ảnh có quyền sử dụng. Quyền ảnh cần bằng chứng
                    riêng cho từng ảnh.
                  </p>
                  <p>
                    Raw payload:{' '}
                    {value.rights.rawPayloadStored
                      ? 'có lưu theo chính sách nguồn'
                      : 'không lưu'}
                    .
                  </p>
                </div>
              </div>
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
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, rules, config] = await Promise.all([
        api<{ items: CampaignSummary[]; total: number; hasMore: boolean }>(
          `/admin/v3/campaigns?offset=${offset}`,
        ),
        api<{ items: CatalogPolicyDto[] }>('/admin/v3/policies'),
        api<AdminSettings>('/admin/catalog/settings'),
      ]);
      setCampaigns(list.items);
      setTotal(list.total);
      setHasMore(list.hasMore);
      setPolicies(rules.items);
      setSettings(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tải được các đợt.');
    } finally {
      setLoading(false);
    }
  }, [offset]);
  useEffect(() => {
    void load();
  }, [load]);
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
        'Đã tạo đợt. Phạm vi, nguồn và phiên bản quy tắc được lưu riêng; đổi bộ lọc trang không đổi đợt.',
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
      <div className="admin-actions">
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
          Tạo đợt thu thập
        </button>
        <button
          disabled={busy || loading}
          onClick={() => {
            void load();
            if (detail) void open(detail.campaign.id);
          }}
        >
          Làm mới dữ liệu
        </button>
        <a href="#rules">Quy tắc & lịch →</a>
      </div>
      {error && (
        <p className="admin-alert" role="alert">
          {error}
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
                    Phiên bản quy tắc
                    <select
                      value={policyId}
                      onChange={(e) => setPolicyId(e.target.value)}
                    >
                      <option value="">
                        An toàn mặc định · đưa thay đổi vào ngoại lệ
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
                    Mỗi điểm đến là một tác vụ bền vững. Nguồn trả rỗng hoặc
                    timeout không được hiểu là địa điểm đóng cửa.
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
                    Phạm vi, nguồn và quy tắc được chụp tại thời điểm bắt đầu.
                    Quy tắc mới không đổi đợt đang chạy.
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
                  <MapPin size={15} /> Phạm vi rõ ràng → nhận dữ liệu → liên kết
                  và chuẩn hóa → kiểm tra chất lượng → ngoại lệ → xem trước →
                  xuất bản.
                </p>
                <p>
                  Giá, giờ và quyền ảnh chưa rõ được giữ là chưa rõ. Thêm dữ
                  liệu không tự tăng số địa điểm nếu nguồn đã có liên kết.
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
                    {task.counts.review} ngoại lệ · {task.counts.skipped} bỏ qua
                    · {task.counts.errors} lỗi
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
              Xem ngoại lệ cần quyết định
            </a>
            <a href="#places">Mở catalog kết quả →</a>
          </div>
        </>
      ) : (
        <>
          {loading && <p role="status">Đang tải đợt thu thập…</p>}
          {!loading && !campaigns.length && !error && (
            <div className="admin-empty">
              <Database size={36} />
              <h2>Chưa có đợt thu thập</h2>
              <p>
                Chọn phạm vi nhỏ đã cấu hình, kiểm tra nguồn và tạo đợt đầu
                tiên. Nội dung mới được giữ ở đề xuất trước khi xuất bản.
              </p>
              <button
                className="journey-primary"
                onClick={() => {
                  setCreating(true);
                  setStep(1);
                }}
              >
                Thiết lập đợt đầu tiên
              </button>
            </div>
          )}
          {!!campaigns.length && (
            <section className="admin-panel">
              <div className="admin-panel-title">
                <h2>Các đợt thu thập ({total})</h2>
                <span className="admin-list-count">
                  Độc lập với bộ lọc phạm vi xem
                </span>
              </div>
              {campaigns.map((c) => (
                <article className="admin-campaign-row" key={c.id}>
                  <div>
                    <h3>{operationState(c.state)}</h3>
                    <small>
                      {time(c.createdAt)} · {c.totalTasks} điểm đến ·{' '}
                      {c.failedTasks} tác vụ lỗi
                    </small>
                    <progress
                      value={c.completedTasks}
                      max={c.totalTasks || 1}
                      aria-label="Số tác vụ đã hoàn tất"
                    />
                    <small>
                      {c.completedTasks}/{c.totalTasks} tác vụ hoàn tất
                    </small>
                  </div>
                  <button onClick={() => void open(c.id)} disabled={busy}>
                    Xem tiến trình & kết quả
                  </button>
                </article>
              ))}
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
            </section>
          )}
          <AdminSourceConnection compact />
        </>
      )}
    </>
  );
}
