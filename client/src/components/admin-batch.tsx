import { useRef, useState } from 'react';
import type {
  AdminPlaceDto,
  CatalogBatchInput,
  CatalogBatchItem,
} from '@goease/contracts';
import { api } from '../api';

export function AdminBatch({
  selected,
  onDone,
}: {
  selected: AdminPlaceDto[];
  onDone: (ids: string[]) => void;
}) {
  const [preview, setPreview] = useState<{
    input: CatalogBatchInput;
    items: CatalogBatchItem[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<CatalogBatchItem[]>([]);
  const key = useRef('');
  async function prepare(status: CatalogBatchInput['status']) {
    setBusy(true);
    setError('');
    setResults([]);
    const input = {
      items: selected.map((p) => ({ id: p.id, expectedRevision: p.revision })),
      status,
    };
    try {
      const value = await api<{ items: CatalogBatchItem[] }>(
        '/admin/catalog/batch-preview',
        { method: 'POST', body: JSON.stringify(input) },
      );
      setPreview({ input, items: value.items });
      key.current = crypto.randomUUID();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa xem trước được. Hãy thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    try {
      const value = await api<{ items: CatalogBatchItem[] }>(
        '/admin/catalog/batch',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': key.current },
          body: JSON.stringify(preview.input),
        },
      );
      setResults(value.items);
      setPreview(null);
      onDone(value.items.filter((p) => p.applied).map((p) => p.id));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa hoàn tất. Giữ lựa chọn và thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-batch" aria-label="Duyệt theo lô">
      <div className="admin-actions">
        <strong>Đã chọn {selected.length} địa điểm</strong>
        <button
          disabled={!selected.length || busy}
          onClick={() => void prepare('published')}
        >
          Xem trước để đăng
        </button>
        <button
          disabled={!selected.length || busy}
          onClick={() => void prepare('archived')}
        >
          Xem trước để ngừng hiển thị
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Đang xử lý…</p>}
      {preview && (
        <div className="admin-preview">
          <h2>
            {preview.input.status === 'published'
              ? 'Đăng địa điểm cho khách'
              : 'Ngừng hiển thị địa điểm'}
          </h2>
          <p>
            {preview.items.filter((p) => p.eligible).length}/
            {preview.items.length} mục đủ điều kiện. Lịch khách đã lưu giữ
            nguyên.
          </p>
          <ul>
            {preview.items.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> —{' '}
                {p.eligible ? 'Đủ điều kiện' : 'Cần xem lại'}: {p.reason}
              </li>
            ))}
          </ul>
          <div className="admin-actions">
            <button
              className="journey-primary"
              disabled={busy || !preview.items.some((p) => p.eligible)}
              onClick={() => void commit()}
            >
              {preview.input.status === 'published'
                ? 'Đăng các mục đủ điều kiện'
                : 'Ngừng hiển thị các mục đủ điều kiện'}
            </button>
            <button disabled={busy} onClick={() => setPreview(null)}>
              Quay lại lựa chọn
            </button>
          </div>
        </div>
      )}
      {!!results.length && (
        <div role="status">
          <p>
            Đã hoàn tất {results.filter((p) => p.applied).length}/
            {results.length} mục. Các mục cần xem lại vẫn được chọn.
          </p>
          <ul>
            {results.map((p) => (
              <li key={p.id}>
                {p.name}: {p.applied ? 'Đã cập nhật' : p.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
