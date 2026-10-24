import { useEffect, useState } from 'react';
import type { AdminSettings } from '@goease/contracts';
import { api } from '../api';
import { AdminMap } from './admin-map';
export function AdminScopeSummary({
  destinationId,
}: {
  destinationId?: string | undefined;
}) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void api<AdminSettings>('/admin/catalog/settings')
      .then((s) => {
        if (active) setSettings(s);
      })
      .catch(() => {
        if (active) setError('Chưa tải được phạm vi cập nhật.');
      });
    return () => {
      active = false;
    };
  }, [destinationId, retry]);
  const id = destinationId || '000000000000000000000004';
  const area =
    settings?.regions?.find((r) => r.destinationId === id) ??
    (id === '000000000000000000000004'
      ? {
          latitude: 15.88,
          longitude: 108.328,
          radiusMeters: 5000,
          enabled: true,
        }
      : null);
  return (
    <section className="admin-panel admin-scope-summary">
      <div className="admin-panel-title">
        <h2>Phạm vi & bộ lọc</h2>
        <a href="#settings">Chỉnh phạm vi ↗</a>
      </div>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
        </p>
      ) : !settings ? (
        <p role="status">Đang tải phạm vi…</p>
      ) : area ? (
        <>
          <AdminMap places={[]} area={area} />
          <div className="admin-scope-values">
            <div>
              <small>Bán kính tìm kiếm</small>
              <strong>{area.radiusMeters / 1000} km</strong>
            </div>
            <div>
              <small>Giới hạn mỗi lượt</small>
              <strong>50 địa điểm</strong>
            </div>
          </div>
          <p>
            {area.enabled
              ? 'Phạm vi đang bật. Dữ liệu mới được nhập thành bản nháp để kiểm tra.'
              : 'Khu vực đang tắt. Bật trong Cài đặt trước khi chạy.'}
          </p>
        </>
      ) : (
        <p>
          Khu vực chưa có tâm và bán kính.{' '}
          <a href="#settings">Thiết lập phạm vi nhập</a>
        </p>
      )}
    </section>
  );
}
