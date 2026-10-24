import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AdminMapResult, BulkPreviewInput } from '@goease/contracts';
import { api } from '../api';

type Filter = Extract<
  BulkPreviewInput['selection'],
  { mode: 'filter' }
>['filter'];
export function AdminCatalogMap({
  filter,
  onOpen,
}: {
  filter: Filter;
  onOpen: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const [viewport, setViewport] = useState({
    west: 102,
    east: 110,
    south: 8,
    north: 24,
    zoom: 5,
  });
  const [data, setData] = useState<AdminMapResult | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [tileLoading, setTileLoading] = useState(true),
    [tileError, setTileError] = useState(false),
    [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { scrollWheelZoom: true }).setView(
      [16, 106],
      5,
    );
    mapRef.current = map;
    const layer = L.layerGroup().addTo(map);
    markers.current = layer;
    const tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        referrerPolicy: 'origin',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    );
    tileLayer.current = tiles;
    let tileFailures = false;
    let tileTimeout: ReturnType<typeof setTimeout> | undefined;
    tiles.on('loading', () => {
      tileFailures = false;
      setTileError(false);
      setTileLoading(true);
      clearTimeout(tileTimeout);
      tileTimeout = setTimeout(() => {
        setTileError(true);
        setTileLoading(false);
      }, 12000);
    });
    tiles.on('tileerror', () => {
      tileFailures = true;
      setTileError(true);
    });
    tiles.on('load', () => {
      clearTimeout(tileTimeout);
      setTileLoading(false);
      // Leaflet emits load even when all tile requests ended in errors.
      setTileError(tileFailures);
    });
    tiles.addTo(map);
    const update = () => {
      const b = map.getBounds();
      setViewport({
        west: Math.max(-180, b.getWest()),
        east: Math.min(180, b.getEast()),
        south: Math.max(-90, b.getSouth()),
        north: Math.min(90, b.getNorth()),
        zoom: map.getZoom(),
      });
    };
    map.on('moveend', update);
    update();
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      clearTimeout(tileTimeout);
      map.remove();
      mapRef.current = null;
      markers.current = null;
      tileLayer.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSelected(null);
    const timeout = setTimeout(() => {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries({ ...(JSON.parse(filterKey) as Filter), ...viewport })
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ),
      );
      void api<AdminMapResult>(`/admin/v3/map?${query}`)
        .then((value) => {
          if (active) setData(value);
        })
        .catch((e) => {
          if (active) {
            setError(e instanceof Error ? e.message : 'Chưa tải được vị trí.');
            setData(null);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [filterKey, viewport, retry]);
  useEffect(() => {
    const layer = markers.current,
      map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    for (const point of data?.clusters ?? []) {
      const marker = L.marker([point.latitude, point.longitude], {
        title: point.name ?? `${point.count} địa điểm`,
        icon: L.divIcon({
          className: 'admin-cluster',
          html: `<span>${point.count.toLocaleString('vi-VN')}</span>`,
          iconSize: [36, 36],
        }),
      });
      marker.on('click', () => {
        if (point.placeId)
          setSelected({ id: point.placeId, name: point.name ?? 'Địa điểm' });
        else
          map.setView(
            [point.latitude, point.longitude],
            Math.min(map.getZoom() + 2, 19),
          );
      });
      marker.addTo(layer);
    }
  }, [data]);
  return (
    <section
      className="admin-map-full admin-panel"
      aria-label="Bản đồ toàn bộ catalog theo bộ lọc"
    >
      <div className="admin-panel-title">
        <h2>Phân bố địa điểm</h2>
        <button onClick={() => setRetry((v) => v + 1)} disabled={loading}>
          Tải lại vùng đang xem
        </button>
      </div>
      <div ref={element} className="admin-live-map" />
      {tileLoading && (
        <p role="status">
          Đang tải nền OpenStreetMap; dữ liệu vị trí được tải riêng.
        </p>
      )}
      {loading && (
        <p role="status">Đang truy vấn địa điểm trong vùng bản đồ…</p>
      )}
      {error && (
        <p role="alert" className="admin-alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>
            Thử lại dữ liệu
          </button>
        </p>
      )}
      {tileError && (
        <p role="alert" className="admin-alert">
          Chưa tải được nền OpenStreetMap. Dữ liệu vị trí được tải độc lập; thử
          lại nền nếu cần.{' '}
          <button onClick={() => tileLayer.current?.redraw()}>
            Thử lại nền bản đồ
          </button>
        </p>
      )}
      {data && (
        <p className="admin-list-count">
          {data.inViewport.toLocaleString('vi-VN')} địa điểm trong vùng đang xem
          · {data.total.toLocaleString('vi-VN')} kết quả khớp bộ lọc ·{' '}
          {data.missingCoordinates.toLocaleString('vi-VN')} thiếu tọa độ
        </p>
      )}
      {selected && (
        <div className="admin-map-selection">
          <strong>{selected.name}</strong>
          <button onClick={() => onOpenRef.current(selected.id)}>
            Xem chi tiết địa điểm
          </button>
        </div>
      )}
      <small>
        Nhấn cụm để phóng to; nhấn ghim đơn để mở địa điểm. Bản đồ dùng cùng bộ
        lọc với bảng và không giới hạn theo trang bảng.
      </small>
    </section>
  );
}
