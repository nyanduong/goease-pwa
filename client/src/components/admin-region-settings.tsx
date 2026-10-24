import { useState } from 'react';
import type { AdminSettings, DestinationDto } from '@goease/contracts';
export function AdminRegionSettings({
  settings,
  onChange,
  destinations,
}: {
  settings: AdminSettings;
  onChange: (s: AdminSettings) => void;
  destinations: DestinationDto[];
}) {
  const [destinationId, setDestination] = useState(''),
    [latitude, setLatitude] = useState(''),
    [longitude, setLongitude] = useState(''),
    [radius, setRadius] = useState(5000);
  const regions = settings.regions ?? [];
  const lat = Number(latitude),
    lon = Number(longitude);
  const valid =
    destinationId &&
    latitude.trim() &&
    longitude.trim() &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    radius >= 500 &&
    radius <= 10000;
  return (
    <details>
      <summary>Phạm vi nhập theo khu vực</summary>
      <p>
        Mỗi điểm đến chỉ chạy sau khi bạn lưu tâm tìm kiếm và bật phạm vi rõ
        ràng. Bán kính là vùng tìm kiếm, không phải ranh giới hành chính.
      </p>
      {regions.map((r) => (
        <div key={r.destinationId} className="admin-region-config">
          <strong>
            {destinations.find((d) => d.id === r.destinationId)?.name}
          </strong>
          <p>
            {r.latitude}, {r.longitude} · {r.radiusMeters / 1000} km
          </p>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) =>
                onChange({
                  ...settings,
                  regions: regions.map((v) =>
                    v.destinationId === r.destinationId
                      ? { ...v, enabled: e.target.checked }
                      : v,
                  ),
                })
              }
            />
            Cho phép nhập tại khu vực này
          </label>
          <button
            type="button"
            onClick={() => {
              setDestination(r.destinationId);
              setLatitude(String(r.latitude));
              setLongitude(String(r.longitude));
              setRadius(r.radiusMeters);
            }}
          >
            Sửa phạm vi
          </button>
        </div>
      ))}
      <label>
        Khu vực cần cấu hình
        <select
          value={destinationId}
          onChange={(e) => setDestination(e.target.value)}
        >
          <option value="">Chọn khu vực</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="admin-two">
        <label>
          Vĩ độ tâm
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
        </label>
        <label>
          Kinh độ tâm
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
        </label>
      </div>
      <label>
        Bán kính (mét, tối đa 10 km)
        <input
          type="number"
          min={500}
          max={10000}
          step={100}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </label>
      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          onChange({
            ...settings,
            regions: [
              ...regions.filter((r) => r.destinationId !== destinationId),
              {
                destinationId,
                latitude: lat,
                longitude: lon,
                radiusMeters: radius,
                enabled: false,
              },
            ],
          });
          setDestination('');
          setLatitude('');
          setLongitude('');
        }}
      >
        Thêm / cập nhật phạm vi ở trạng thái tắt
      </button>
      <p>Bật khu vực và nhấn Lưu cài đặt để áp dụng.</p>
    </details>
  );
}
