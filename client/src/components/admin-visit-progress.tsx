import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  Clock3,
  RefreshCw,
  Search,
  TriangleAlert,
} from '../icons';
import {
  visitProgressStates,
  type VisitProgressDto,
  type VisitProgressQuery,
  type VisitProgressState,
} from '@goease/contracts';
import { api } from '../api';
import { AdminPageHeader } from './admin-visuals';
const labels: Record<VisitProgressState, string> = {
  pending: 'Đang chờ',
  searching: 'Đang xử lý',
  ready: 'Có kết quả',
  empty: 'Chưa tìm thấy',
  failed: 'Lỗi nguồn',
  inactive: 'Ngoài hàng đợi',
  not_queued: 'Chưa xếp hàng',
};
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : 'Chưa kiểm tra';
export function AdminVisitProgress({
  scope = '',
  region = 'Tất cả khu vực',
  onOpen,
}: {
  scope?: string;
  region?: string;
  onOpen: (id: string) => void;
}) {
  const [data, setData] = useState<VisitProgressDto | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [automatic, setAutomatic] = useState(true),
    [reload, setReload] = useState(0);
  const [q, setQ] = useState(''),
    [state, setState] = useState<VisitProgressQuery['state']>('all'),
    [coverage, setCoverage] = useState<VisitProgressQuery['coverage']>('all'),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    setOffset(0);
  }, [scope]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setData(null);
    setError('');
    setLoading(true);
    function schedule() {
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') void load();
        else schedule();
      }, 5000);
    }
    async function load() {
      try {
        const params = new URLSearchParams({
          q,
          state,
          coverage,
          offset: String(offset),
          ...(scope ? { destinationId: scope } : {}),
        });
        const next = await api<VisitProgressDto>(
          `/admin/catalog/visit-progress?${params}`,
        );
        if (active) {
          setData(next);
          setError('');
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Chưa tải được tiến trình.',
          );
      } finally {
        if (active) {
          setLoading(false);
          if (automatic) schedule();
        }
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [scope, q, state, coverage, offset, reload, automatic]);
  const s = data?.summary;
  const queued = s ? s.total - s.states.inactive - s.states.not_queued : 0;
  const processed = s ? s.states.ready + s.states.empty + s.states.failed : 0;
  const percent = queued ? Math.round((processed / queued) * 100) : 0;
  const changeState = (value: VisitProgressQuery['state']) => {
    setState(value);
    setOffset(0);
  };
  return (
    <section className="admin-catalog admin-visit-progress">
      <AdminPageHeader
        title="Tiến trình lấy dữ liệu"
        region={region}
        description="Theo dõi hệ thống tìm giờ mở cửa và giá tham khảo cho từng địa điểm."
        actions={
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Làm mới
          </button>
        }
      />
      <div className="visit-progress-live">
        <span>
          <i className={automatic ? 'is-live' : ''} />
          {automatic ? 'Tự cập nhật mỗi 5 giây' : 'Đã tắt tự cập nhật'}
        </span>
        <span>
          {data ? `Cập nhật ${time(data.generatedAt)}` : 'Chưa có dữ liệu'}
        </span>
        <label>
          <input
            type="checkbox"
            checked={automatic}
            onChange={(e) => setAutomatic(e.target.checked)}
          />
          Tự cập nhật
        </label>
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          {error} {data && 'Đang giữ kết quả lần tải trước.'}
          <button type="button" onClick={() => setReload((v) => v + 1)}>
            Thử lại
          </button>
        </div>
      )}
      {loading && !data ? <p role="status">Đang tải tiến trình…</p> : null}
      {s && (
        <>
          <div className="visit-progress-kpis">
            <article>
              <span>Tổng địa điểm</span>
              <strong>{s.total}</strong>
              <small>Trong phạm vi và tên đang tìm</small>
            </article>
            <article>
              <span>Đã lấy được giờ</span>
              <strong>
                {s.hours}
                <em>/{s.total}</em>
              </strong>
              <small>Còn thiếu {s.total - s.hours} địa điểm</small>
            </article>
            <article>
              <span>Đã lấy được giá</span>
              <strong>
                {s.price}
                <em>/{s.total}</em>
              </strong>
              <small>Còn thiếu {s.total - s.price} địa điểm</small>
            </article>
            <article>
              <span>Có đủ giờ & giá</span>
              <strong>{s.both}</strong>
              <small>{s.neither} địa điểm chưa có giờ lẫn giá</small>
            </article>
          </div>
          <section
            className="visit-progress-run"
            aria-label="Tiến trình hàng đợi"
          >
            <div>
              <Activity size={21} />
              <h2>
                {s.states.pending + s.states.searching > 0
                  ? 'Hàng đợi đang xử lý'
                  : queued > 0
                    ? 'Đã xử lý hết hàng đợi'
                    : 'Chưa có lượt tìm trong phạm vi'}
              </h2>
              <strong>
                {processed}/{queued} <span>đã xử lý</span>
              </strong>
            </div>
            <div
              role="progressbar"
              aria-label="Địa điểm đã xử lý"
              aria-valuemin={0}
              aria-valuemax={queued || 1}
              aria-valuenow={processed}
              className="visit-progress-track"
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <p>
              {percent}% hoàn tất lượt tìm · Hoàn tất lượt tìm vẫn có thể thiếu
              dữ liệu nguồn.
            </p>
            {s.expiredLeases > 0 && (
              <p className="visit-progress-warning">
                <TriangleAlert size={15} />
                {s.expiredLeases} lượt xử lý quá hạn, đang chờ hệ thống thử lại.
              </p>
            )}
          </section>
          <nav
            className="visit-progress-states"
            aria-label="Lọc trạng thái tiến trình"
          >
            <button
              type="button"
              aria-pressed={state === 'all'}
              onClick={() => changeState('all')}
            >
              Tất cả <b>{s.total}</b>
            </button>
            {visitProgressStates
              .filter(
                (k) =>
                  s.states[k] > 0 || !['inactive', 'not_queued'].includes(k),
              )
              .map((k) => (
                <button
                  type="button"
                  key={k}
                  className={`is-${k}`}
                  aria-pressed={state === k}
                  onClick={() => changeState(k)}
                >
                  {labels[k]} <b>{s.states[k]}</b>
                </button>
              ))}
          </nav>
        </>
      )}
      <div className="visit-progress-library">
        <header className="visit-progress-library-heading">
          <h2>Chi tiết từng địa điểm</h2>
          {data && <span>{data.total.toLocaleString('vi-VN')} địa điểm</span>}
        </header>
        <div className="visit-progress-filters">
          <label>
            <Search size={17} />
            <input
              aria-label="Tìm địa điểm trong tiến trình"
              maxLength={100}
              placeholder="Tìm tên địa điểm…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            Thông tin tìm được
            <select
              value={coverage}
              onChange={(e) => {
                setCoverage(e.target.value as VisitProgressQuery['coverage']);
                setOffset(0);
              }}
            >
              <option value="all">Tất cả dữ liệu</option>
              <option value="hours">Có giờ mở cửa</option>
              <option value="price">Có giá tham khảo</option>
              <option value="both">Có đủ giờ & giá</option>
              <option value="missing_hours">Thiếu giờ mở cửa</option>
              <option value="missing_price">Thiếu giá</option>
              <option value="neither">Thiếu cả giờ & giá</option>
            </select>
          </label>
        </div>
        <p className="visit-progress-note">
          Số liệu giờ/giá tính các gợi ý đã lưu, gồm kết quả lượt trước đang tìm
          lại. Admin cần kiểm tra trước khi xuất bản.
        </p>
        {data && !data.items.length ? (
          <div className="admin-empty">
            <h2>
              {s?.total
                ? 'Không có địa điểm khớp bộ lọc'
                : 'Chưa có địa điểm trong hàng đợi'}
            </h2>
            <p>
              {s?.total
                ? 'Đổi trạng thái hoặc thông tin cần tìm.'
                : 'Bật tỉnh và lấy địa điểm để hệ thống bắt đầu thu thập.'}
            </p>
          </div>
        ) : null}
        {!!data?.items.length && (
          <div className="visit-progress-table-wrap">
            <table className="visit-progress-table">
              <thead>
                <tr>
                  <th>Địa điểm</th>
                  <th>Tiến trình</th>
                  <th>Giờ mở cửa</th>
                  <th>Giá tham khảo</th>
                  <th>Kiểm tra gần nhất</th>
                  <th>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="visit-progress-place"
                        onClick={() => onOpen(item.id)}
                      >
                        {item.name}
                      </button>
                      <small>{item.destinationName}</small>
                    </td>
                    <td>
                      <div className="visit-progress-status">
                        <span
                          className={`visit-progress-badge is-${item.state}`}
                        >
                          {item.state === 'searching' ? (
                            <RefreshCw size={13} />
                          ) : item.state === 'pending' ? (
                            <Clock3 size={13} />
                          ) : null}
                          {labels[item.state]}
                        </span>
                        <small>
                          {item.expiredLease
                            ? 'Quá hạn · chờ nhận lại'
                            : item.state === 'pending' && item.attempts > 0
                              ? `Thử lại sau lỗi · ${time(item.nextAttemptAt)}`
                              : item.attempts
                                ? `${item.attempts} lượt thử`
                                : ''}
                        </small>
                        {item.message && (
                          <details>
                            <summary>Chi tiết</summary>
                            <p>{item.message}</p>
                          </details>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          item.hours ? 'visit-has-data' : 'visit-missing-data'
                        }
                      >
                        {item.hours ? (
                          <>
                            <Check size={14} />
                            Đã có gợi ý
                          </>
                        ) : (
                          'Chưa có'
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          item.price ? 'visit-has-data' : 'visit-missing-data'
                        }
                      >
                        {item.price ? (
                          <>
                            <Check size={14} />
                            Đã có gợi ý
                          </>
                        ) : (
                          'Chưa có'
                        )}
                      </span>
                      {item.previousResult && (
                        <small>Gợi ý từ lượt trước</small>
                      )}
                    </td>
                    <td>
                      <small>{time(item.checkedAt)}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="visit-progress-open"
                        onClick={() => onOpen(item.id)}
                        aria-label={`Kiểm tra ${item.name}`}
                      >
                        Kiểm tra
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <footer className="visit-progress-pagination">
            <span>
              {data.total
                ? `${offset + 1}–${Math.min(offset + 20, data.total)}`
                : '0'}{' '}
              / {data.total} địa điểm
            </span>
            <div>
              <button
                type="button"
                disabled={!offset || loading}
                onClick={() => setOffset((v) => Math.max(0, v - 20))}
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={!data.hasMore || loading}
                onClick={() => setOffset((v) => v + 20)}
              >
                Trang tiếp
              </button>
            </div>
          </footer>
        )}
      </div>
    </section>
  );
}
