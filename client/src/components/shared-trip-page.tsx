import { lazy, Suspense, useEffect, useState } from 'react';
import type { SharedTripDto } from '@goease/contracts';
import { api } from '../api';
import { Brand } from './ui';
const TripMap = lazy(() =>
  import('./trip-map').then((v) => ({ default: v.TripMap })),
);
export function SharedTripPage() {
  const [token, setToken] = useState(location.hash.slice(1));
  const [trip, setTrip] = useState<SharedTripDto | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0),
    [day, setDay] = useState(0),
    [map, setMap] = useState(false);
  useEffect(() => {
    const changed = () => setToken(location.hash.slice(1));
    addEventListener('hashchange', changed);
    return () => removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    let active = true;
    setTrip(null);
    setError('');
    setLoading(true);
    setDay(0);
    void api<{ trip: SharedTripDto }>('/shared-trip', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit',
    })
      .then((v) => {
        if (active) setTrip(v.trip);
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Chưa tải được lịch trình.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, retry]);
  // Recheck when returning to the tab; discard an expired page even without another request.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setRetry((v) => v + 1);
    };
    addEventListener('focus', refresh);
    const timer = trip
      ? setTimeout(
          () => {
            setTrip(null);
            setRetry((v) => v + 1);
          },
          Math.min(
            2147483647,
            Math.max(0, Date.parse(trip.expiresAt) - Date.now()),
          ),
        )
      : undefined;
    return () => {
      removeEventListener('focus', refresh);
      clearTimeout(timer);
    };
  }, [trip]);
  const selected = trip?.days[day];
  return (
    <main className="shared-trip-page">
      <a href="/" aria-label="GoEase trang chủ">
        <Brand />
      </a>
      <p className="share-badge">Lịch trình được chia sẻ · Chỉ xem</p>
      {loading && <p role="status">Đang mở lịch trình…</p>}
      {error && (
        <section role="alert">
          <h1>Chưa mở được lịch trình</h1>
          <p>{error}</p>
          <button
            className="journey-outline"
            onClick={() => setRetry((v) => v + 1)}
          >
            Thử lại
          </button>
        </section>
      )}
      {trip && (
        <>
          <h1>{trip.title}</h1>
          <p>
            {trip.destinationName} · {trip.startDate} → {trip.endDate}
          </p>
          <p className="muted">Ghi chú riêng và chi phí không được chia sẻ.</p>
          <div className="expense-actions">
            <button aria-pressed={!map} onClick={() => setMap(false)}>
              Lịch trình
            </button>
            <button aria-pressed={map} onClick={() => setMap(true)}>
              Bản đồ
            </button>
            <button onClick={() => setRetry((v) => v + 1)}>
              Cập nhật lịch
            </button>
          </div>
          <div className="share-days" aria-label="Chọn ngày">
            {trip.days.map((d, i) => (
              <button
                key={d.dayId}
                aria-pressed={day === i}
                onClick={() => setDay(i)}
              >
                Ngày {i + 1}
              </button>
            ))}
          </div>
          {selected && (
            <>
              <h2>
                Ngày {day + 1} · {selected.date}
              </h2>
              {map ? (
                <Suspense fallback={<p>Đang tải bản đồ…</p>}>
                  <TripMap
                    activities={selected.activities}
                    destinationName={trip.destinationName}
                    destinationId={selected.destinationId}
                  />
                </Suspense>
              ) : selected.activities.length ? (
                <ol className="shared-stops">
                  {selected.activities.map((a) => (
                    <li key={a.activityId}>
                      <small>
                        {a.startLocalTime
                          ? `${a.startLocalTime} – ${a.endLocalTime}`
                          : 'Chưa đặt giờ'}
                      </small>
                      <h3>{a.title}</h3>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Ngày này chưa có điểm dừng.</p>
              )}
            </>
          )}
          <p>
            Link hết hạn {new Date(trip.expiresAt).toLocaleString('vi-VN')}.
          </p>
        </>
      )}
    </main>
  );
}
