import { AdminPlaceImage } from './admin-visuals';
import { AdminImageGallery } from './admin-image-gallery';
import { AdminWikimediaImages } from './admin-wikimedia-images';
import { useEffect, useRef, useState } from 'react';
import {
  catalogQuality,
  catalogToday,
  type AdminPlaceDto,
  type AdminPlaceInput,
} from '@goease/contracts';
import { AdminMap } from './admin-map';
import { api } from '../api';

export function AdminPlaceTools({
  form,
  saved,
  update,
  onRestore,
  busy,
}: {
  form: AdminPlaceInput;
  saved: AdminPlaceDto | null;
  update: (p: Partial<AdminPlaceInput>) => void;
  onRestore: () => void;
  busy: boolean;
}) {
  const [versions, setVersions] = useState<
    {
      revision: number;
      recordedAt: string;
      name: string;
      status: string;
      state?: string;
      reason?: string;
    }[]
  >([]);
  const [comparison, setComparison] = useState<{
    revision: number;
    state: string;
    reason: string;
    changes: { field: string; current: unknown; historical: unknown }[];
  } | null>(null);
  const restoreKey = useRef({ identity: '', key: '' });
  const [error, setError] = useState(''),
    [restoring, setRestoring] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setComparison(null);
    setError('');
    if (!saved) return;
    let active = true;
    void api<{ items: typeof versions }>(`/admin/places/${saved.id}/versions`)
      .then((v) => {
        if (active) setVersions(v.items);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được phiên bản.');
      });
    return () => {
      active = false;
    };
  }, [saved?.id, saved?.revision, retry]);
  async function compare(revision: number) {
    if (!saved) return;
    setRestoring(true);
    setError('');
    try {
      setComparison(
        await api<{
          revision: number;
          state: string;
          reason: string;
          changes: { field: string; current: unknown; historical: unknown }[];
        }>(`/admin/places/${saved.id}/versions/${revision}`),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa tải được nội dung so sánh.',
      );
    } finally {
      setRestoring(false);
    }
  }
  async function restore(revision: number) {
    if (
      !saved ||
      !confirm(
        'Chuẩn bị đề xuất phục hồi từ phiên bản này? Bản công khai được giữ nguyên cho tới khi bạn xuất bản đề xuất.',
      )
    )
      return;
    setRestoring(true);
    setError('');
    const identity = `${saved.id}:${saved.revision}:${revision}`;
    if (restoreKey.current.identity !== identity)
      restoreKey.current = { identity, key: crypto.randomUUID() };
    try {
      await api(`/admin/places/${saved.id}/restore`, {
        method: 'POST',
        headers: { 'Idempotency-Key': restoreKey.current.key },
        body: JSON.stringify({ revision, expectedRevision: saved.revision }),
      });
      onRestore();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa khôi phục được.');
    } finally {
      setRestoring(false);
    }
  }
  const quality = catalogQuality({
    ...form,
    updatedAt: saved?.updatedAt ?? new Date().toISOString(),
    imageCredit: saved?.imageCredit ?? 'Chưa có ảnh thật',
  });
  const mapPlace: AdminPlaceDto = {
    ...form,
    id: saved?.id ?? 'new',
    revision: saved?.revision ?? 0,
    updatedAt: saved?.updatedAt ?? new Date().toISOString(),
  };
  return (
    <div className="admin-editor-tools">
      <section className="admin-panel">
        <h2>Checklist trước khi xuất bản</h2>
        <strong>{quality.completeness}% đủ thông tin cơ bản</strong>
        <progress value={quality.completeness} max={100} />
        {quality.issues.length ? (
          <ul>
            {quality.issues.map((i) => (
              <li key={i.code}>{i.label}</li>
            ))}
          </ul>
        ) : (
          <p>
            Đã đủ các tiêu chí đang kiểm tra. Đối chiếu nguồn trước khi xuất
            bản.
          </p>
        )}
        <small>
          Giờ và tọa độ là kiểm tra bổ sung. Không tự suy ra giá hoặc quyền sử
          dụng ảnh.
        </small>
      </section>
      <section className="admin-panel">
        <h2>Địa chỉ & tọa độ</h2>
        <AdminMap
          places={[mapPlace]}
          onPick={(point) =>
            update({
              mapLocation: {
                ...point,
                precision: 'area',
                label: form.name || 'Vị trí tham khảo',
                sourceUrl: form.sourceUrl,
                checkedAt: catalogToday(),
              },
            })
          }
        />
        <div className="admin-two">
          <label>
            Vĩ độ
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={form.mapLocation?.latitude ?? ''}
              onChange={(e) =>
                update({
                  mapLocation: {
                    latitude: Number(e.target.value),
                    longitude: form.mapLocation?.longitude ?? 0,
                    precision: 'area',
                    label: form.name || 'Vị trí tham khảo',
                    sourceUrl: form.sourceUrl,
                    checkedAt: catalogToday(),
                  },
                })
              }
            />
          </label>
          <label>
            Kinh độ
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={form.mapLocation?.longitude ?? ''}
              onChange={(e) =>
                update({
                  mapLocation: {
                    latitude: form.mapLocation?.latitude ?? 0,
                    longitude: Number(e.target.value),
                    precision: 'area',
                    label: form.name || 'Vị trí tham khảo',
                    sourceUrl: form.sourceUrl,
                    checkedAt: catalogToday(),
                  },
                })
              }
            />
          </label>
        </div>
        {form.mapLocation && (
          <button type="button" onClick={() => update({ mapLocation: null })}>
            Xóa vị trí chưa chắc chắn
          </button>
        )}
        <p>
          Vị trí tham khảo, chưa phải lối vào được xác minh. Link nguồn thông
          tin sẽ được lưu cùng tọa độ.
        </p>
      </section>
      <section className="admin-panel">
        <h2>Xem trước thẻ địa điểm</h2>
        <AdminPlaceImage
          place={{
            ...form,
            imageUrl: form.images?.[0]?.url ?? '',
            imageCredit:
              form.images?.[0]?.credit ?? 'Chưa có ảnh thật được duyệt',
          }}
          large
        />
        <div className="admin-customer-card-copy">
          <strong>{form.name || 'Tên địa điểm'}</strong>
          <p>{form.locationQuery || 'Địa chỉ đang bổ sung'}</p>
          <p>{form.openingHoursNote || 'Chưa có giờ mở cửa'}</p>
        </div>
        <small>{saved?.imageCredit ?? 'Chưa có ảnh thật được duyệt'}</small>
        <p>
          {saved?.source
            ? `Nguồn nhập: ${saved.source.provider} · ${saved.source.license}`
            : 'Thông tin do người vận hành biên tập từ link nguồn.'}
        </p>
        {form.sourceUrl.startsWith('https://') && (
          <a href={form.sourceUrl} target="_blank" rel="noreferrer">
            Mở bằng chứng nguồn ↗
          </a>
        )}
      </section>
      <section className="admin-panel" id="admin-section-images">
        <AdminWikimediaImages id={saved?.id} form={form} update={update} />
        <AdminImageGallery form={form} update={update} />
      </section>
      <section className="admin-panel" id="admin-section-notes">
        <h2>Ghi chú nội bộ</h2>
        <label>
          Chỉ quản trị viên nhìn thấy
          <textarea
            maxLength={1000}
            rows={3}
            value={form.internalNote ?? ''}
            onChange={(e) => update({ internalNote: e.target.value })}
          />
        </label>
      </section>
      {saved && (
        <section className="admin-panel">
          <h2>Phiên bản & khôi phục</h2>
          {error && (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => setRetry((v) => v + 1)}>
                Tải lại phiên bản
              </button>
            </p>
          )}
          {!versions.length && (
            <p>
              Chưa có bản lưu phiên bản. Bản hiện tại sẽ được ghi lại khi chỉnh
              sửa tiếp.
            </p>
          )}
          {comparison && (
            <div className="admin-version-comparison">
              <h3>So sánh phiên bản {comparison.revision}</h3>
              <p>
                Đối chiếu bản đang biên tập đã lưu với bản lịch sử. Thời điểm
                nhận không xác nhận bản nào đúng hơn. Phục hồi thay đề xuất đang
                lưu và giữ các trường đã khóa; bản công khai giữ nguyên.
              </p>
              {comparison.changes.length ? (
                <div className="admin-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Trường</th>
                        <th>Bản đang biên tập đã lưu</th>
                        <th>Phiên bản {comparison.revision}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.changes.map((c) => (
                        <tr key={c.field}>
                          <th>{c.field}</th>
                          <td>
                            <pre>
                              {typeof c.current === 'object'
                                ? JSON.stringify(c.current, null, 2)
                                : String(c.current ?? 'Chưa rõ')}
                            </pre>
                          </td>
                          <td>
                            <pre>
                              {typeof c.historical === 'object'
                                ? JSON.stringify(c.historical, null, 2)
                                : String(c.historical ?? 'Chưa rõ')}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Không có khác biệt trong các trường đối chiếu.</p>
              )}
              <button
                type="button"
                className="journey-primary"
                disabled={restoring || busy}
                onClick={() => void restore(comparison.revision)}
              >
                Chuẩn bị đề xuất phục hồi
              </button>
            </div>
          )}
          {versions.map((v) => (
            <div className="admin-version" key={v.revision}>
              <span>
                Bản {v.revision} ·{' '}
                {v.state === 'published'
                  ? 'Công khai'
                  : v.state === 'proposal'
                    ? 'Đề xuất'
                    : 'Lịch sử'}{' '}
                · {new Date(v.recordedAt).toLocaleString('vi-VN')}
              </span>
              <button
                type="button"
                disabled={restoring || busy || v.revision === saved.revision}
                onClick={() => void compare(v.revision)}
              >
                So sánh & chuẩn bị phục hồi
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
