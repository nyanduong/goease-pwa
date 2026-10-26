import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2 } from '../icons';
import type { TripDto, TripTrashDto, TrashedTripDto } from '@goease/contracts';
import { api, ApiFailure } from '../api';

export function TripTrash({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean;
  onNavigate: (path: string) => void;
}) {
  const [data, setData] = useState<TripTrashDto | null>(null);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = useRef<{ id: string; key: string; body: string } | null>(
    null,
  );
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setLoading(true);
    setError('');
    api<TripTrashDto>(`/trips/trash?offset=${offset}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được thùng rác.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [signedIn, offset, retry]);

  async function restore(trip: TrashedTripDto) {
    if (pending.current && pending.current.id !== trip.id) return;
    if (busy) return;
    const operation = pending.current ?? {
      id: trip.id,
      key: crypto.randomUUID(),
      body: JSON.stringify({ expectedRevision: trip.revision }),
    };
    pending.current = operation;
    setPendingId(trip.id);
    setBusy(true);
    setActionError('');
    try {
      const result = await api<{ trip: TripDto }>(
        `/trips/${operation.id}/restore`,
        {
          method: 'POST',
          body: operation.body,
          headers: { 'Idempotency-Key': operation.key },
        },
      );
      pending.current = null;
      onNavigate(`/trips/${result.trip.id}`);
    } catch (e) {
      const definite =
        e instanceof ApiFailure &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408;
      setActionError(
        (e instanceof Error ? e.message : 'Chưa khôi phục được chuyến đi.') +
          (definite
            ? ''
            : ' Kết quả chưa rõ. Bấm Thử lại khôi phục để kiểm tra cùng thao tác.'),
      );
      if (definite) {
        pending.current = null;
        setPendingId(null);
        setRetry((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="journey-list trip-trash">
      <header className="journey-top">
        <button
          aria-label="Về chuyến đi"
          disabled={busy}
          onClick={() => onNavigate('/trips')}
        >
          <ArrowLeft size={22} />
        </button>
        <span>Thùng rác</span>
        <Trash2 size={21} />
      </header>
      <div className="journey-list-heading">
        <h1 className="sr-only">Chuyến đi đã xóa</h1>
        <p>
          Khôi phục lịch trình và chi tiêu. Các link chia sẻ cũ vẫn bị thu hồi.
        </p>
      </div>
      {!signedIn ? (
        <div className="journey-empty">
          <p>Đăng nhập để xem thùng rác của bạn.</p>
          <button onClick={() => onNavigate('/login?next=/trips/trash')}>
            Đăng nhập
          </button>
        </div>
      ) : loading ? (
        <p className="journey-empty" role="status">
          Đang mở thùng rác…
        </p>
      ) : error ? (
        <div className="journey-empty" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
        </div>
      ) : !data?.items.length ? (
        <div className="journey-empty">
          <Trash2 size={30} />
          <h2>Thùng rác đang trống</h2>
          <p>Chuyến đi bạn xóa sẽ xuất hiện ở đây.</p>
          {offset > 0 && (
            <button onClick={() => setOffset(0)}>Về trang đầu</button>
          )}
        </div>
      ) : (
        <>
          <div className="trip-trash-cards">
            {data.items.map((trip) => (
              <article key={trip.id} className="trip-trash-card">
                <h2>{trip.title}</h2>
                <p>
                  {trip.destinationName} ·{' '}
                  {trip.startDate.split('-').reverse().join('/')} –{' '}
                  {trip.endDate.split('-').reverse().join('/')}
                </p>
                <small>
                  Đã xóa {new Date(trip.deletedAt).toLocaleString('vi-VN')}
                </small>
                <button
                  className="journey-outline"
                  disabled={
                    busy || (pendingId !== null && pendingId !== trip.id)
                  }
                  onClick={() => void restore(trip)}
                >
                  <RotateCcw size={17} />{' '}
                  {busy && pendingId === trip.id
                    ? 'Đang khôi phục…'
                    : pendingId === trip.id
                      ? 'Thử lại khôi phục'
                      : 'Khôi phục chuyến đi'}
                </button>
              </article>
            ))}
          </div>
          <div className="expense-actions" aria-label="Phân trang thùng rác">
            {offset > 0 && (
              <button
                disabled={busy || pendingId !== null}
                onClick={() => setOffset((v) => Math.max(0, v - 50))}
              >
                Trang trước
              </button>
            )}
            {data.hasMore && (
              <button
                disabled={busy || pendingId !== null}
                onClick={() => setOffset((v) => v + 50)}
              >
                Trang tiếp
              </button>
            )}
          </div>
        </>
      )}
      {actionError && <p role="alert">{actionError}</p>}
    </section>
  );
}
