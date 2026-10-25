import { useEffect, useRef, useState } from 'react';
import type { AdminDestinationDto, CampaignDetail } from '@goease/contracts';
import { api } from '../api';
import { operationState } from './admin-campaigns';

export function AdminProvinceImport({
  destination,
  autoKey,
}: {
  destination: AdminDestinationDto;
  autoKey?: string;
}) {
  const storage = `goease-province-import-${destination.id}`;
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [areaName, setAreaName] = useState('');
  const request = useRef<{
    key: string;
    areaName: string;
    campaignId?: string;
  } | null>(null);
  const started = useRef(false);
  async function collect(fresh = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    if (fresh || !request.current)
      request.current = { key: autoKey ?? crypto.randomUUID(), areaName };
    const pending = request.current;
    sessionStorage.setItem(storage, JSON.stringify(pending));
    try {
      const value = await api<CampaignDetail>('/admin/v3/province-imports', {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.key },
        body: JSON.stringify({
          destinationId: destination.id,
          ...(pending.areaName ? { areaName: pending.areaName } : {}),
        }),
      });
      setDetail(value);
      pending.campaignId = value.campaign.id;
      sessionStorage.setItem(storage, JSON.stringify(pending));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lấy được địa điểm.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (autoKey) {
      void collect();
      return;
    }
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(storage) ?? 'null',
      );
      if (
        saved &&
        typeof saved === 'object' &&
        'key' in saved &&
        typeof saved.key === 'string' &&
        'areaName' in saved &&
        typeof saved.areaName === 'string'
      ) {
        request.current = { key: saved.key, areaName: saved.areaName };
        setAreaName(saved.areaName);
      }
    } catch {
      /* A damaged local hint never changes server data. */
    }
    void collect();
  }, []);
  const campaignId = detail?.campaign.id;
  const active =
    !!detail &&
    !['succeeded', 'failed', 'partial', 'paused'].includes(
      detail.campaign.state,
    );
  useEffect(() => {
    if (!campaignId || !active) return;
    let disposed = false;
    const timer = setInterval(() => {
      void api<CampaignDetail>(`/admin/v3/campaigns/${campaignId}`)
        .then((value) => {
          if (!disposed) {
            setDetail(value);
            setError('');
          }
        })
        .catch((e) => {
          if (!disposed)
            setError(
              e instanceof Error ? e.message : 'Chưa cập nhật được tiến trình.',
            );
        });
    }, 3000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [campaignId, active]);
  const task = detail?.tasks[0];
  return (
    <section
      className="admin-panel"
      aria-label={`Lấy địa điểm ${destination.name}`}
    >
      <h3>Lấy địa điểm tham quan · {destination.name}</h3>
      <p>
        Geoapify / OpenStreetMap → bản nháp → kiểm tra → xuất bản theo lô. Mỗi
        lượt tối đa 50 kết quả quanh vùng tìm kiếm; chưa phải toàn bộ tỉnh. Giá,
        ảnh và giờ thiếu vẫn là chưa rõ.
      </p>
      {busy && <p role="status">Đang xác định vùng và tạo đợt thu thập…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void collect()}>
            Thử lại lấy địa điểm
          </button>{' '}
          <a href="#automatic">Mở Đợt thu thập</a> ·{' '}
          <a href="#sources">Kiểm tra nguồn</a>
        </div>
      )}
      {detail && (
        <>
          <p role="status">
            {operationState(detail.campaign.state)} · {task?.message}
          </p>
          {task?.scope && (
            <p>
              Vùng tìm: {task.scope.areaLabel ?? destination.name} · bán kính{' '}
              {task.scope.radiusMeters / 1000} km · tâm{' '}
              {task.scope.latitude.toFixed(4)},{' '}
              {task.scope.longitude.toFixed(4)}. Kiểm tra địa chỉ trước khi xuất
              bản; vùng tròn không phải ranh giới tỉnh.
            </p>
          )}
          <p>
            Nháp mới: {task?.counts.created ?? 0} · Không đổi:{' '}
            {task?.counts.unchanged ?? 0} · Cần kiểm tra:{' '}
            {task?.counts.review ?? 0} · Bỏ qua: {task?.counts.skipped ?? 0}
          </p>
          {detail.campaign.state === 'succeeded' && !task?.counts.created && (
            <p>
              Lượt này không có bản nháp mới. Nguồn có thể không có kết quả phù
              hợp hoặc địa điểm đã tồn tại.
            </p>
          )}
          <a
            className="journey-primary"
            href={`#places?status=draft&destinationId=${destination.id}`}
          >
            Kiểm tra bản nháp và xuất bản theo lô
          </a>
          <p>
            Trong danh sách: kiểm tra địa điểm → chọn các mục đạt → Xem trước
            xuất bản → xác nhận thực thi. Mục bị chặn sẽ có lý do.
          </p>
        </>
      )}
      {!active && !busy && (
        <>
          <label>
            Vùng lấy tiếp
            <select
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
            >
              <option value="">
                Phạm vi đã cấu hình hoặc vùng tìm ban đầu
              </option>
              {[destination.name, ...(destination.tourismAreas ?? [])].map(
                (name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ),
              )}
            </select>
          </label>
          <button
            disabled={busy || destination.publicationStatus !== 'published'}
            onClick={() => {
              request.current = { key: crypto.randomUUID(), areaName };
              void collect();
            }}
          >
            {detail ? 'Lấy thêm vào nháp' : 'Lấy khu vực đã chọn vào nháp'}
          </button>
          <a href="#automatic"> Xem đợt / thử lại phần lỗi</a>
        </>
      )}
    </section>
  );
}
