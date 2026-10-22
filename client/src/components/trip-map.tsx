import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  mapLocationSchema,
  type ActivityInput,
  type PlaceDto,
  type MapLocation,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';

type Props = {
  activities: ActivityInput[];
  destinationName: string;
  destinationId: string | undefined;
  onEdit: (activity: ActivityInput) => void;
};
type Entry = { place?: PlaceDto; failed?: boolean; unavailable?: boolean };

export function TripMap({
  activities,
  destinationName,
  destinationId,
  onEdit,
}: Props) {
  const [catalog, setCatalog] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ids = JSON.stringify([
    ...new Set(activities.flatMap((a) => (a.placeId ? [a.placeId] : []))),
  ]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setCatalog({});
    void Promise.all(
      (JSON.parse(ids) as string[]).map(async (id) => {
        try {
          const { place } = await api<{ place: PlaceDto }>(`/places/${id}`);
          return [id, { place }] as const;
        } catch (e) {
          return [
            id,
            e instanceof ApiFailure && e.status === 404
              ? { unavailable: true }
              : { failed: true },
          ] as const;
        }
      }),
    ).then((entries) => {
      if (active) {
        setCatalog(Object.fromEntries(entries));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [ids, retry]);
  const stops = useMemo(
    () =>
      activities.map((activity, index) => {
        const entry = activity.placeId ? catalog[activity.placeId] : undefined;
        const place =
          entry?.place?.destinationId === destinationId
            ? entry?.place
            : undefined;
        const parsed = mapLocationSchema.safeParse(place?.mapLocation);
        return {
          activity,
          index,
          entry,
          place,
          point: parsed.success ? parsed.data : undefined,
        };
      }),
    [activities, catalog, destinationId],
  );
  const located = stops.filter((s) => s.point);
  const activeStop = stops.find((s) => s.activity.activityId === selected);
  useEffect(() => {
    if (!element.current || loading || !stops.some((s) => s.point)) return;
    const map = L.map(element.current, { scrollWheelZoom: false });
    mapRef.current = map;
    setTileError(false);
    setTilesLoading(true);
    const tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );
    tiles.on('tileerror', () => {
      setTileError(true);
      setTilesLoading(false);
    });
    tiles.on('load', () => setTilesLoading(false));
    const timer = setTimeout(() => {
      setTileError(true);
      setTilesLoading(false);
    }, 12000);
    tiles.on('load', () => clearTimeout(timer));
    tiles.addTo(map);
    const positions: L.LatLngTuple[] = [];
    for (const stop of stops) {
      if (!stop.point) continue;
      const pos: L.LatLngTuple = [stop.point.latitude, stop.point.longitude];
      positions.push(pos);
      L.marker(pos, {
        icon: L.divIcon({
          className: 'trip-map-pin',
          html: `<span>${stop.index + 1}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
        title: `${stop.index + 1}. ${stop.activity.title}`,
        alt: `${stop.index + 1}. ${stop.activity.title}`,
      })
        .on('click', () => setSelected(stop.activity.activityId))
        .addTo(map);
    }
    // Do not bridge missing coordinates: each line joins consecutive located stops only.
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1]!.point,
        b = stops[i]!.point;
      if (a && b)
        L.polyline(
          [
            [a.latitude, a.longitude],
            [b.latitude, b.longitude],
          ],
          { color: '#145b4d', weight: 3, dashArray: '6 9', interactive: false },
        ).addTo(map);
    }
    map.fitBounds(L.latLngBounds(positions), {
      padding: [35, 35],
      maxZoom: positions.length === 1 ? 15 : 14,
    });
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element.current);
    return () => {
      clearTimeout(timer);
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [stops, loading, retry]);
  function choose(id: string) {
    setSelected(id);
    const p = stops.find((s) => s.activity.activityId === id)?.point;
    if (p) mapRef.current?.panTo([p.latitude, p.longitude]);
  }
  const directions = (point: MapLocation) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`;
  return (
    <section className="trip-map-section" aria-label="Bản đồ lịch trình">
      <header>
        <h2>Những điểm mình sẽ ghé</h2>
        <p>
          {located.length}/{activities.length} điểm có vị trí tham khảo
        </p>
      </header>
      {loading && <p role="status">Đang tải vị trí điểm dừng…</p>}
      {Object.values(catalog).some((v) => v.failed) && (
        <p role="alert">
          Chưa tải được một số địa điểm.{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại vị trí</button>
        </p>
      )}
      {!loading && located.length > 0 && (
        <>
          <div
            ref={element}
            className="trip-map-canvas"
            aria-label="Bản đồ các điểm dừng trong ngày"
          />
          {tilesLoading && <p role="status">Đang tải nền bản đồ…</p>}
          {tileError && (
            <p role="alert">
              Chưa tải được nền bản đồ. Bạn vẫn có thể mở chỉ đường bên dưới.{' '}
              <button onClick={() => setRetry((v) => v + 1)}>
                Tải lại bản đồ
              </button>
            </p>
          )}
          <p className="trip-map-hint">
            Số là thứ tự trong lịch. Nét đứt nối điểm tham khảo, chưa phải đường
            đi thực tế hoặc thời gian di chuyển.
          </p>
        </>
      )}
      {!loading && !located.length && (
        <p className="trip-map-empty">
          {activities.length
            ? 'Chưa có tọa độ cho các điểm dừng trong ngày này.'
            : 'Ngày này chưa có điểm dừng. Thêm địa điểm ở tab Lịch trình để xem bản đồ.'}
        </p>
      )}
      {activeStop && (
        <article className="trip-map-selected" aria-live="polite">
          <h3>
            {activeStop.index + 1}. {activeStop.activity.title}
          </h3>
          {activeStop.point && (
            <>
              <p>
                {activeStop.point.label} · Vị trí khu vực tham khảo, hãy chọn
                lối vào phù hợp.
              </p>
              <a
                href={directions(activeStop.point)}
                target="_blank"
                rel="noreferrer"
              >
                Chỉ đường đến khu vực ↗
              </a>{' '}
              <a
                href={activeStop.point.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Nguồn vị trí
              </a>
            </>
          )}
          <button onClick={() => onEdit(structuredClone(activeStop.activity))}>
            Xem / chỉnh điểm dừng
          </button>
        </article>
      )}
      <ol className="trip-map-stops">
        {stops.map((s) => (
          <li key={s.activity.activityId}>
            <button
              className="trip-map-stop"
              aria-pressed={selected === s.activity.activityId}
              onClick={() => choose(s.activity.activityId)}
            >
              <span>{s.index + 1}</span>
              <strong>{s.activity.title}</strong>
              <small>
                {s.activity.startLocalTime ?? 'Chưa đặt giờ'} ·{' '}
                {s.point
                  ? 'Vị trí tham khảo'
                  : s.entry?.failed
                    ? 'Lỗi tải vị trí'
                    : s.entry?.unavailable
                      ? 'Địa điểm không còn hiển thị'
                      : loading
                        ? 'Đang tải'
                        : 'Chưa có tọa độ'}
              </small>
            </button>
            {s.point ? (
              <a
                href={directions(s.point)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Chỉ đường đến ${s.activity.title}`}
              >
                Chỉ đường ↗
              </a>
            ) : (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place?.planning?.locationQuery ?? `${s.activity.title} ${destinationName}`)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Tìm ${s.activity.title} trên Google Maps`}
              >
                Tìm trên Google Maps ↗
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
