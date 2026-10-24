import { useEffect, useRef, useState } from 'react';
import {
  adminPlaceQuerySchema,
  type AdminPlaceDto,
  type BulkJobDto,
  type BulkPreviewInput,
} from '@goease/contracts';
import { api } from '../api';

export function AdminBatch({
  selected,
  onDone,
  filter,
  total = 0,
  allMatching = false,
  onAllMatching,
  archiveDestination,
}: {
  selected: AdminPlaceDto[];
  onDone: (ids: string[]) => void;
  filter?: Extract<BulkPreviewInput['selection'], { mode: 'filter' }>['filter'];
  total?: number;
  allMatching?: boolean;
  onAllMatching?: (value: boolean) => void;
  archiveDestination?: { id: string; name: string };
}) {
  const [job, setJob] = useState<BulkJobDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const stop = useRef(false);
  const previewRequest = useRef({ body: '', key: '' });
  const persistenceKey = `goease-admin-last-bulk${archiveDestination ? `:${archiveDestination.id}` : ''}`;
  useEffect(() => {
    const id = localStorage.getItem(persistenceKey);
    if (!id || !/^[a-f0-9]{24}$/.test(id)) return;
    let active = true;
    setBusy(true);
    void api<BulkJobDto>(`/admin/v3/bulk/${id}`)
      .then((value) => {
        if (active) {
          setJob(value);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : 'Chưa tải được lô đã lưu.');
          localStorage.removeItem(persistenceKey);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [persistenceKey]);
  async function preview(action: BulkPreviewInput['action']) {
    if (busy || (!selected.length && !allMatching && !archiveDestination))
      return;
    const input: BulkPreviewInput = {
      action,
      ...(archiveDestination ? { destinationId: archiveDestination.id } : {}),
      selection: archiveDestination
        ? {
            mode: 'filter',
            filter: adminPlaceQuerySchema.parse({
              destinationId: archiveDestination.id,
            }),
          }
        : allMatching && filter
          ? { mode: 'filter', filter }
          : {
              mode: 'page',
              items: selected.map((p) => ({
                id: p.id,
                expectedRevision: p.revision,
              })),
            },
    };
    const body = JSON.stringify(input);
    if (previewRequest.current.body !== body)
      previewRequest.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const value = await api<BulkJobDto>('/admin/v3/bulk/preview', {
        method: 'POST',
        headers: { 'Idempotency-Key': previewRequest.current.key },
        body,
      });
      setJob(value);
      localStorage.setItem(persistenceKey, value.id);
      setOffset(0);
      previewRequest.current = { body: '', key: '' };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tạo được bản xem trước.');
    } finally {
      setBusy(false);
    }
  }
  async function loadPage(next: number) {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      setJob(await api<BulkJobDto>(`/admin/v3/bulk/${job.id}?offset=${next}`));
      setOffset(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tải được kết quả.');
    } finally {
      setBusy(false);
    }
  }
  async function execute(retryFailed = false) {
    if (!job || busy) return;
    stop.current = false;
    setBusy(true);
    setError('');
    try {
      let current = job;
      do {
        current = await api<BulkJobDto>(`/admin/v3/bulk/${job.id}/execute`, {
          method: 'POST',
          body: JSON.stringify({ retryFailed }),
        });
        retryFailed = false;
        setJob(current);
        setOffset(0);
        if (!current.pending) onAllMatching?.(false);
        onDone(
          current.items
            .filter((p) => p.state === 'succeeded')
            .map((p) => p.placeId),
        );
      } while (current.pending > 0 && !stop.current);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa xác nhận được kết quả. Tải lại lô trước khi tiếp tục.',
      );
    } finally {
      setBusy(false);
    }
  }
  const count = allMatching ? total : selected.length;
  const frozenScope =
    job?.selection?.mode === 'page'
      ? `${job.selection.items.length} địa điểm trong tập ID và revision đã chốt`
      : job?.selection?.mode === 'filter'
        ? [
            job.destinationName ||
              job.destinationId ||
              'Tất cả điểm đến được chọn trong lô',
            job.selection.filter.q
              ? `tìm “${job.selection.filter.q}”`
              : 'không giới hạn từ khóa',
            `vòng đời: ${{ all: 'tất cả', draft: 'nháp', published: 'công khai', archived: 'lưu trữ' }[job.selection.filter.status]}`,
            `nhóm: ${{ all: 'tất cả', food: 'ăn uống', culture: 'văn hóa', nature: 'thiên nhiên' }[job.selection.filter.category]}`,
            `nguồn: ${job.selection.filter.source === 'all' ? 'tất cả' : job.selection.filter.source === 'manual' ? 'biên tập' : 'Geoapify / OSM'}`,
            `chất lượng: ${{ all: 'tất cả', price: 'giá cần bổ sung', hours: 'thiếu giờ', location: 'thiếu tọa độ' }[job.selection.filter.quality]}`,
          ].join(' · ')
        : 'Máy chủ chưa trả thông tin phạm vi của lô này. Tập ID và revision giữ theo bản xem trước đã lưu.';

  return (
    <section aria-label="Thao tác theo lô">
      {archiveDestination && (
        <div className="admin-batch-bar">
          <strong>Kế hoạch lưu trữ: {archiveDestination.name}</strong>
          <button
            disabled={busy}
            onClick={() => void preview('archive_destination')}
          >
            Xem trước địa điểm và phụ thuộc
          </button>
        </div>
      )}
      {!archiveDestination && (count > 0 || job) && (
        <div className="admin-batch-bar">
          <strong>{count.toLocaleString('vi-VN')} địa điểm được chọn</strong>
          {filter && onAllMatching && (
            <button disabled={busy} onClick={() => onAllMatching(!allMatching)}>
              {allMatching
                ? 'Chỉ giữ lựa chọn trên trang'
                : `Chọn toàn bộ ${total.toLocaleString('vi-VN')} kết quả khớp bộ lọc`}
            </button>
          )}
          <button
            disabled={busy || !count}
            onClick={() => void preview('archive')}
          >
            Xem trước lưu trữ
          </button>
          <button
            className="journey-primary"
            disabled={busy || !count}
            onClick={() => void preview('publish')}
          >
            Xem trước xuất bản
          </button>
        </div>
      )}
      {error && (
        <p className="admin-alert" role="alert">
          {error}
          {job && (
            <button disabled={busy} onClick={() => void loadPage(offset)}>
              Tải trạng thái lô
            </button>
          )}
        </p>
      )}
      {job && (
        <div className="admin-panel admin-bulk-preview">
          <div className="admin-panel-title">
            <h2>
              {job.pending === 0
                ? 'Kết quả lô thay đổi'
                : 'Xem trước lô thay đổi'}
            </h2>
            <span className="admin-pill">
              {job.action === 'publish'
                ? 'Xuất bản'
                : job.action === 'archive_destination'
                  ? 'Lưu trữ điểm đến & phụ thuộc'
                  : 'Lưu trữ'}
            </span>
          </div>
          <p>
            {frozenScope}
            {job.snapshotAt
              ? ` · Chốt lúc ${new Date(job.snapshotAt).toLocaleString('vi-VN')}`
              : ''}
            . Tập địa điểm và revision đã được đóng băng; thay đổi bộ lọc không
            đổi lô này.
          </p>
          <div className="admin-metrics">
            <div>
              <small>Tổng địa điểm</small>
              <strong>{job.total}</strong>
            </div>
            <div>
              <small>Đủ điều kiện</small>
              <strong>{job.eligible}</strong>
            </div>
            <div>
              <small>Đã áp dụng</small>
              <strong>{job.succeeded}</strong>
            </div>
            <div>
              <small>Bị chặn / lỗi</small>
              <strong>
                {job.state === 'preview'
                  ? job.total - job.eligible
                  : job.blocked + job.failed}
              </strong>
            </div>
          </div>
          <div className="admin-soft-notice">
            Máy chủ kiểm tra lại quyền, điều kiện và revision của từng mục khi
            thực thi. Chuyến khách đã lưu giữ snapshot hiện tại.
          </div>
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Địa điểm</th>
                  <th>Kết quả</th>
                  <th>Lý do / tác động</th>
                </tr>
              </thead>
              <tbody>
                {job.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <span
                        className={`admin-pill ${p.state === 'succeeded' ? 'is-good' : !p.eligible ? 'is-warning' : ''}`}
                      >
                        {p.state === 'succeeded'
                          ? 'Đã áp dụng'
                          : p.state === 'conflict'
                            ? 'Xung đột revision'
                            : p.state === 'failed'
                              ? 'Lỗi'
                              : p.eligible
                                ? 'Sẵn sàng'
                                : 'Bị chặn'}
                      </span>
                    </td>
                    <td>{p.reason || 'Được kiểm tra lại trước khi áp dụng'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-actions">
            <button
              disabled={busy || !offset}
              onClick={() => void loadPage(Math.max(0, offset - 50))}
            >
              Trang trước
            </button>
            <span>Trang {Math.floor(offset / 50) + 1}</span>
            <button
              disabled={busy || !job.hasMore}
              onClick={() => void loadPage(offset + 50)}
            >
              Trang tiếp
            </button>
          </div>
          <div className="admin-actions">
            <button
              disabled={busy}
              onClick={() => {
                setJob(null);
                localStorage.removeItem(persistenceKey);
              }}
            >
              Đóng kết quả
            </button>
            {!busy && job.failed > 0 && (
              <button disabled={busy} onClick={() => void execute(true)}>
                Thử lại {job.failed} mục lỗi
              </button>
            )}
            {busy ? (
              <button
                onClick={() => {
                  stop.current = true;
                }}
              >
                Dừng sau nhóm đang xử lý
              </button>
            ) : (
              <button
                className="journey-primary"
                disabled={
                  !job.pending &&
                  !(archiveDestination && job.state === 'preview')
                }
                onClick={() => void execute()}
              >
                {job.succeeded > 0
                  ? `Tiếp tục ${job.pending} mục còn lại`
                  : archiveDestination && !job.total
                    ? 'Áp dụng lưu trữ điểm đến'
                    : `Áp dụng ${job.eligible} mục đủ điều kiện`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
