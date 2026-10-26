import { useEffect, useState } from 'react';
import { offlineItems, removeOffline, saveOffline } from '../offline';

export function TripOffline({ id, unsaved }: { id: string; unsaved: boolean }) {
  const [stamp, setStamp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () =>
      setStamp(
        offlineItems().find((item) => item.trip.id === id)?.savedAt ?? '',
      );
    update();
    addEventListener('storage', update);
    addEventListener('goease-offline-change', update);
    return () => {
      removeEventListener('storage', update);
      removeEventListener('goease-offline-change', update);
    };
  }, [id]);
  return (
    <details className="trip-offline" aria-label="Lịch trình offline">
      <summary>Bản offline</summary>
      <p>
        Chỉ xem lịch, ghi chú và chi phí dự kiến. Dữ liệu lưu trên trình duyệt
        này và được xóa khi đăng xuất.
      </p>
      {stamp && (
        <p role="status">Đã tải: {new Date(stamp).toLocaleString('vi-VN')}</p>
      )}
      {unsaved && <p>Lưu thay đổi trước khi cập nhật bản offline.</p>}
      <div className="expense-actions">
        <button
          disabled={busy || unsaved}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await saveOffline(id);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Chưa lưu được bản offline.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? 'Đang tải…'
            : stamp
              ? 'Cập nhật bản offline'
              : 'Lưu để xem offline'}
        </button>
        {stamp && (
          <button
            disabled={busy}
            onClick={() => {
              try {
                removeOffline(id);
                setError('');
              } catch {
                setError('Chưa xóa được bản tải xuống. Hãy thử lại.');
              }
            }}
          >
            Xóa bản tải xuống
          </button>
        )}
        <a href="/offline.html">Mở lịch trình offline</a>
      </div>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
