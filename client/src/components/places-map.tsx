import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapLocationSchema, type PlaceDto } from '@goease/contracts';

/** Read-only projection of the already loaded catalog; never geocodes or guesses coordinates. */
export function PlacesMap({
  places,
  onOpen,
}: {
  places: PlaceDto[];
  onOpen: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const points = useMemo(
    () =>
      places.flatMap((place, index) => {
        const value = mapLocationSchema.safeParse(place.mapLocation);
        return value.success ? [{ place, point: value.data, index }] : [];
      }),
    [places],
  );
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    if (!element.current || !points.length) return;
    const map = L.map(element.current, { scrollWheelZoom: false });
    const tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        referrerPolicy: 'origin',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );
    tiles.on('tileerror', () => setTileError(true));
    tiles.addTo(map);
    const positions: L.LatLngTuple[] = [];
    for (const { place, point, index } of points) {
      const position: L.LatLngTuple = [point.latitude, point.longitude];
      positions.push(position);
      const tooltip = document.createElement('span');
      tooltip.textContent = place.name;
      L.marker(position, {
        title: place.name,
        alt: place.name,
        keyboard: true,
        icon: L.divIcon({
          className: 'customer-map-pin',
          html: `<span>${index + 1}</span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        }),
      })
        .bindTooltip(tooltip)
        .on('click', () => openRef.current(place.id))
        .addTo(map);
    }
    map.fitBounds(L.latLngBounds(positions), {
      padding: [28, 28],
      maxZoom: 14,
    });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [points, retry]);
  if (!points.length)
    return (
      <p className="explore-status">
        Các địa điểm đang xem chưa có tọa độ. Bạn vẫn có thể mở chỉ đường từ
        danh sách bên dưới.
      </p>
    );
  return (
    <div className="customer-places-map">
      <div
        ref={element}
        className="customer-map-canvas"
        role="region"
        aria-label="Bản đồ các địa điểm đang xem"
      />
      <p className="customer-map-caption">
        {points.length}/{places.length} địa điểm đang xem có tọa độ. Chạm ghim
        để mở chi tiết.
      </p>
      {tileError && (
        <div className="notice notice-error" role="alert">
          Chưa tải được nền bản đồ. Ghim dùng tọa độ đã có; bạn vẫn có thể mở
          chỉ đường bên dưới.{' '}
          <button
            type="button"
            onClick={() => {
              setTileError(false);
              setRetry((v) => v + 1);
            }}
          >
            Thử tải lại bản đồ
          </button>
        </div>
      )}
    </div>
  );
}
