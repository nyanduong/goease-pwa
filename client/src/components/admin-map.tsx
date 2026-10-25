import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AdminPlaceDto, MapLocation } from '@goease/contracts';

const colors = { food: '#e6982b', culture: '#8051c7', nature: '#2e9b6b' };
export function AdminMap({
  places,
  onOpen,
  onPick,
  area,
}: {
  places: AdminPlaceDto[];
  area?:
    { latitude: number; longitude: number; radiusMeters: number } | undefined;
  onOpen?: (id: string) => void;
  onPick?: (point: Pick<MapLocation, 'latitude' | 'longitude'>) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const openRef = useRef(onOpen),
    pickRef = useRef(onPick);
  openRef.current = onOpen;
  pickRef.current = onPick;
  const [selected, setSelected] = useState<AdminPlaceDto | null>(null);
  const located = places.filter((p) => p.mapLocation);
  const positions = JSON.stringify(
    located.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      point: p.mapLocation,
    })),
  );
  const circle = JSON.stringify(area ?? null);
  useEffect(() => {
    if (!element.current) return;
    const rows = JSON.parse(positions) as {
      id: string;
      name: string;
      category: keyof typeof colors;
      point: MapLocation;
    }[];
    const map = L.map(element.current, { scrollWheelZoom: false }).setView(
      [16, 107],
      5,
    );
    setFailed(false);
    setLoading(true);
    const tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        // OSM requires an origin Referer; never send admin paths or query data.
        referrerPolicy: 'origin',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map);
    const timeout = setTimeout(() => {
      setFailed(true);
      setLoading(false);
    }, 12000);
    tiles.on('load', () => {
      clearTimeout(timeout);
      setLoading(false);
    });
    tiles.on('tileerror', () => {
      setFailed(true);
      setLoading(false);
    });
    for (const p of rows)
      L.marker([p.point.latitude, p.point.longitude], {
        title: p.name,
        alt: p.name,
        icon: L.divIcon({
          className: 'admin-map-marker',
          html: `<span style="background:${colors[p.category]}"></span>`,
          iconSize: [28, 28],
        }),
      })
        .on('click', () =>
          setSelected(places.find((v) => v.id === p.id) ?? null),
        )
        .addTo(map);
    if (rows.length)
      map.fitBounds(
        L.latLngBounds(
          rows.map(
            (p) => [p.point.latitude, p.point.longitude] as L.LatLngTuple,
          ),
        ),
        { padding: [30, 30], maxZoom: 15 },
      );
    if (circle !== 'null') {
      const region = JSON.parse(circle) as {
        latitude: number;
        longitude: number;
        radiusMeters: number;
      };
      const boundary = L.circle([region.latitude, region.longitude], {
        radius: region.radiusMeters,
        color: '#0b8f78',
        weight: 1.5,
        dashArray: '6 6',
        fillColor: '#61b9a3',
        fillOpacity: 0.12,
      }).addTo(map);
      map.fitBounds(boundary.getBounds(), { padding: [14, 14] });
      L.circleMarker([region.latitude, region.longitude], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#006357',
        fillOpacity: 1,
      }).addTo(map);
    }
    map.on('click', (event: L.LeafletMouseEvent) =>
      pickRef.current?.({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      }),
    );
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element.current);
    return () => {
      clearTimeout(timeout);
      resize.disconnect();
      map.remove();
    };
    // The serialized marker projection keeps input handlers and editorial fields from rebuilding the map.
  }, [positions, retry, circle]);
  return (
    <section className="admin-map-panel" aria-label="Bản đồ địa điểm">
      <div ref={element} className="admin-live-map" />
      {loading && <small role="status">Đang tải nền bản đồ…</small>}
      {failed && (
        <p role="alert">
          Chưa tải được nền bản đồ. Vị trí đã lưu vẫn giữ nguyên.{' '}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Thử lại bản đồ
          </button>
        </p>
      )}
      <p className="admin-map-legend" hidden={!!area}>
        <span>● Ăn uống</span>
        <span>● Văn hóa</span>
        <span>● Thiên nhiên</span>
      </p>
      <small>
        {area
          ? 'Vùng nhập theo tâm và bán kính đã cấu hình.'
          : `${located.length}/${places.length} địa điểm có tọa độ tham khảo.`}{' '}
        {area
          ? ''
          : onPick
            ? 'Nhấn bản đồ để chọn vị trí, kiểm tra nguồn trước khi lưu.'
            : 'Chọn ghim để mở địa điểm.'}
      </small>
      {selected && (
        <div className="admin-map-selection">
          <strong>{selected.name}</strong>
          <p>{selected.locationQuery}</p>
          {onOpen && (
            <button
              type="button"
              onClick={() => openRef.current?.(selected.id)}
            >
              Mở địa điểm
            </button>
          )}
        </div>
      )}
    </section>
  );
}
