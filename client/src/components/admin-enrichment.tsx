import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Pause, Play, RefreshCw } from '../icons';
import type { EnrichmentDto, EnrichmentItemState } from '@goease/contracts';
import { api } from '../api';

const labels: Record<EnrichmentItemState, string> = {
  queued: 'Chưa xử lý',
  waiting: 'Đang tìm / chờ nguồn',
  review: 'Cần duyệt / kiểm tra',
  ready: 'Đủ dữ liệu cho Goe',
  unresolved: 'Chưa tìm được nguồn',
  skipped: 'Giữ nguyên',
};
export function AdminEnrichment() {
  const [value, setValue] = useState<EnrichmentDto | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState('all');
  const key = useRef(crypto.randomUUID());
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await api<EnrichmentDto>(
          `/admin/catalog/enrichment?offset=${offset}&state=${filter}`,
          signal ? { signal } : {},
        );
        if (!signal?.aborted) {
          setValue(result);
          setError('');
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : 'Chưa tải được tiến độ.');
      }
    },
    [offset, filter],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 10000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  async function act(action: 'start' | 'pause' | 'resume') {
    setBusy(true);
    setError('');
    try {
      if (action === 'start') {
        await api('/admin/catalog/enrichment', {
          method: 'POST',
          headers: { 'Idempotency-Key': key.current },
          body: '{}',
        });
        key.current = crypto.randomUUID();
      } else if (value?.job)
        await api(`/admin/catalog/enrichment/${value.job.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            action,
            expectedRevision: value.job.revision,
          }),
        });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được.');
    } finally {
      setBusy(false);
    }
  }
  const job = value?.job,
    counts = job?.counts ?? {},
    done =
      (counts.ready ?? 0) +
      (counts.review ?? 0) +
      (counts.unresolved ?? 0) +
      (counts.skipped ?? 0);
  return (
    <section className="admin-panel admin-enrichment">
      <div className="admin-panel-title">
        <div>
          <h2>
            <Database size={18} /> Bổ sung dữ liệu toàn quốc
          </h2>
          <p>
            Tìm ảnh, giới thiệu, giờ và giá cho các địa điểm đã nhập. Kết quả
            mới chờ duyệt, chưa tự xuất bản.
          </p>
        </div>
        <div className="admin-actions">
          <button
            disabled={busy}
            onClick={() => void load()}
            aria-label="Làm mới tiến độ bổ sung"
          >
            <RefreshCw size={15} /> Làm mới
          </button>
          {!job || job.state === 'completed' ? (
            <button
              disabled={busy || !value}
              className="journey-primary"
              onClick={() => void act('start')}
            >
              <Play size={15} /> Bổ sung toàn bộ
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                void act(job.state === 'paused' ? 'resume' : 'pause')
              }
            >
              {job.state === 'paused' ? (
                <Play size={15} />
              ) : (
                <Pause size={15} />
              )}{' '}
              {job.state === 'paused' ? 'Tiếp tục' : 'Tạm dừng giao việc'}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {!value && !error && <p role="status">Đang tải tiến độ…</p>}
      {job && (
        <>
          <p role="status">
            <strong>
              {
                {
                  building: 'Đang lập danh sách',
                  running: 'Đang bổ sung',
                  paused: 'Đã tạm dừng giao việc',
                  completed: 'Đã kết thúc lượt tìm',
                }[job.state]
              }
            </strong>{' '}
            · {done.toLocaleString('vi-VN')} /{' '}
            {job.total.toLocaleString('vi-VN')} mục đã có kết quả xử lý
          </p>
          <progress
            className="admin-enrichment-progress"
            value={done}
            max={Math.max(1, job.total)}
            aria-label="Tiến độ xử lý địa điểm"
          />
          <div
            className="admin-enrichment-counts"
            role="group"
            aria-label="Lọc kết quả bổ sung dữ liệu"
          >
            {Object.entries(labels).map(([state, label]) => (
              <button
                key={state}
                aria-pressed={filter === state}
                onClick={() => {
                  setFilter(state);
                  setOffset(0);
                }}
              >
                {label}{' '}
                <strong>
                  {(counts[state as EnrichmentItemState] ?? 0).toLocaleString(
                    'vi-VN',
                  )}
                </strong>
              </button>
            ))}
          </div>
          <p className="admin-muted">
            Đã lập danh sách {job.registered.toLocaleString('vi-VN')} mục. Nguồn
            đang dùng: OSM, Wikipedia/Wikidata, Wikimedia Commons và website
            liên kết. Chưa tích hợp Google Maps. Việc đã giao vẫn có thể hoàn
            tất khi tạm dừng; nguồn giới hạn tốc độ sẽ chờ thử lại.
          </p>
          <details>
            <summary>Xem từng địa điểm và thông tin còn thiếu</summary>
            <label>
              Lọc kết quả{' '}
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">Tất cả</option>
                {Object.entries(labels).map(([state, label]) => (
                  <option key={state} value={state}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Địa điểm</th>
                    <th>Kết quả</th>
                    <th>Còn thiếu</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {value.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <br />
                        {item.destinationName}
                      </td>
                      <td>
                        {labels[item.state]}
                        <p>{item.message}</p>
                      </td>
                      <td>
                        {item.missing.join(', ') ||
                          (item.state === 'ready'
                            ? 'Đủ các trường đã kiểm tra'
                            : 'Đang kiểm tra')}
                      </td>
                      <td>
                        <a href={`#places?place=${item.placeId}`}>
                          Xem & duyệt
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!value.items.length && <p>Chưa có mục trong bộ lọc này.</p>}
            <div className="admin-actions">
              <button
                disabled={offset === 0}
                onClick={() => setOffset((v) => Math.max(0, v - 20))}
              >
                Trang trước
              </button>
              <span>Trang {Math.floor(offset / 20) + 1}</span>
              <button
                disabled={!value.hasMore}
                onClick={() => setOffset((v) => v + 20)}
              >
                Trang tiếp
              </button>
            </div>
          </details>
          <p className="admin-muted">
            “Có dữ liệu cần duyệt” chưa phải đủ xuất bản. “Chưa tìm được nguồn”
            chỉ là kết quả từ các nguồn hiện hỗ trợ; không có nghĩa địa điểm
            không tồn tại.
          </p>
        </>
      )}
    </section>
  );
}
