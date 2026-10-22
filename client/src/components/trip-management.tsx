import { TripSharing } from './trip-sharing';
import { useRef, useState } from 'react';
import type { TripDto } from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { Sheet } from './journey-sheet';
export function TripManagement({
  trip,
  unsaved,
  onNavigate,
  onReload,
}: {
  trip: TripDto;
  unsaved: boolean;
  onNavigate: (path: string) => void;
  onReload: () => void;
}) {
  const [action, setAction] = useState<'duplicate' | 'delete' | null>(null);
  const [date, setDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const pending = useRef<{
    url: string;
    method: string;
    body: string;
    key: string;
  } | null>(null);
  async function submit() {
    if (busy || !action) return;
    const operation = pending.current ?? {
      url: `/trips/${trip.id}${action === 'duplicate' ? '/duplicate' : ''}`,
      method: action === 'duplicate' ? 'POST' : 'DELETE',
      body: JSON.stringify({
        expectedRevision: trip.revision,
        ...(action === 'duplicate' ? { startDate: date } : {}),
      }),
      key: crypto.randomUUID(),
    };
    pending.current = operation;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ trip?: TripDto; deleted?: boolean }>(
        operation.url,
        {
          method: operation.method,
          body: operation.body,
          headers: { 'Idempotency-Key': operation.key },
        },
      );
      pending.current = null;
      setUncertain(false);
      setAction(null);
      onNavigate(result.trip ? `/trips/${result.trip.id}` : '/trips');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác.');
      if (
        e instanceof ApiFailure &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408
      ) {
        pending.current = null;
        setUncertain(false);
      } else setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="trip-management" aria-label="Quản lý chuyến đi">
      <h2>Quản lý chuyến đi</h2>
      {unsaved && <p>Lưu thay đổi trước khi nhân bản hoặc xóa chuyến đi.</p>}
      <div className="expense-actions">
        <TripSharing tripId={trip.id} unsaved={unsaved} />
        <button
          disabled={unsaved}
          onClick={() => {
            setAction('duplicate');
            setError('');
          }}
        >
          Nhân bản chuyến đi
        </button>
        <button
          disabled={unsaved}
          onClick={() => {
            setAction('delete');
            setError('');
          }}
        >
          Xóa chuyến đi
        </button>
      </div>
      {action && (
        <Sheet
          title={
            action === 'duplicate' ? 'Nhân bản chuyến đi' : 'Xóa chuyến đi'
          }
          onClose={() => {
            if (busy) return;
            if (
              uncertain &&
              !confirm(
                'Kết quả chưa rõ. Đóng và tải lại chuyến đi để kiểm tra?',
              )
            )
              return;
            setAction(null);
            pending.current = null;
            setUncertain(false);
            if (uncertain) onReload();
          }}
        >
          <form
            className="expense-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p>
              {action === 'duplicate'
                ? 'Sao chép lịch, ghi chú và dự toán sang chuyến riêng mới. Thực chi không được sao chép. Các hoạt động được giữ làm kế hoạch thủ công.'
                : 'Chuyến đi sẽ chuyển vào Thùng rác. Bạn có thể khôi phục nguyên lịch và thực chi. Các link chia sẻ cũ bị thu hồi và không mở lại khi khôi phục.'}
            </p>
            <strong>{trip.title}</strong>
            {action === 'duplicate' && (
              <label>
                Ngày bắt đầu bản sao
                <input
                  type="date"
                  required
                  value={date}
                  disabled={busy || uncertain}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            {uncertain && (
              <p role="alert">
                Chưa rõ kết quả. Thử lại cùng thao tác để tránh tạo trùng.
              </p>
            )}
            <button type="submit" className="journey-primary" disabled={busy}>
              {busy
                ? 'Đang xử lý…'
                : uncertain
                  ? 'Thử lại thao tác'
                  : action === 'duplicate'
                    ? 'Tạo bản sao'
                    : 'Xác nhận xóa chuyến đi'}
            </button>
            {error && !uncertain && (
              <button
                type="button"
                onClick={() => {
                  setAction(null);
                  onReload();
                }}
              >
                Tải lại chuyến đi
              </button>
            )}
          </form>
        </Sheet>
      )}
    </section>
  );
}
