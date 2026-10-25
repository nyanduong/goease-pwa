import { useEffect, useState } from 'react';
import type { AdminPlaceInput, PlaceImageSearchDto } from '@goease/contracts';
import { api } from '../api';

export function AdminWikimediaImages({
  id,
  form,
  update,
}: {
  id?: string | undefined;
  form: AdminPlaceInput;
  update: (value: Partial<AdminPlaceInput>) => void;
}) {
  const [data, setData] = useState<PlaceImageSearchDto | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [previews, setPreviews] = useState<Record<string, 'loaded' | 'failed'>>(
    {},
  );
  useEffect(() => {
    setData(null);
    setError('');
    if (!id) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result = await api<PlaceImageSearchDto>(
          `/admin/places/${id}/images`,
        );
        if (!active) return;
        setData(result);
        setError('');
        if (['pending', 'searching'].includes(result.state))
          timer = setTimeout(() => void load(), 3000);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Chưa tải được ảnh ứng viên.',
          );
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, reload]);
  async function search() {
    if (!id || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/places/${id}/images/search`, {
        method: 'POST',
        body: '{}',
      });
      setReload((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa yêu cầu được lượt tìm ảnh.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Ảnh gợi ý Wikimedia">
      <h3>Ảnh thật từ Wikimedia Commons</h3>
      <p>
        Ảnh ứng viên chưa được xác nhận đúng địa điểm. Mở nguồn, kiểm tra ảnh
        thật và quyền sử dụng rồi chọn. Ảnh được chọn chỉ vào bản chỉnh sửa; cần
        Lưu đề xuất.
      </p>
      {!id ? (
        <p>Lưu bản nháp trước để hệ thống tự tìm ảnh.</p>
      ) : (
        <>
          <button
            type="button"
            disabled={busy || data?.state === 'searching'}
            onClick={() => void search()}
          >
            Tìm lại ảnh Wikimedia
          </button>
          {error && (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => setReload((v) => v + 1)}>
                Tải lại
              </button>
            </p>
          )}
          {!data && !error && <p role="status">Đang tải trạng thái tìm ảnh…</p>}
          {data && (
            <p role="status">
              {data.state === 'pending'
                ? 'Đang chờ tìm ảnh. '
                : data.state === 'searching'
                  ? 'Đang tìm ảnh Wikimedia. '
                  : ''}
              {data.message}
            </p>
          )}
          <div className="admin-image-gallery">
            {data?.candidates.map((candidate) => (
              <figure key={candidate.id}>
                <img
                  src={candidate.image.url}
                  alt={candidate.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onLoad={() =>
                    setPreviews((v) => ({
                      ...v,
                      [candidate.image.url]: 'loaded',
                    }))
                  }
                  onError={() =>
                    setPreviews((v) => ({
                      ...v,
                      [candidate.image.url]: 'failed',
                    }))
                  }
                />
                {previews[candidate.image.url] === 'failed' && (
                  <p>
                    Không tải được ảnh này. Hãy chọn ảnh khác hoặc thử lại sau.
                  </p>
                )}
                <figcaption>
                  {candidate.title}
                  <br />
                  {candidate.image.credit} · {candidate.image.license}
                  <br />
                  {candidate.match === 'nearby'
                    ? 'Ảnh gần tọa độ, có thể là địa điểm khác.'
                    : 'Gợi ý theo tên, cần kiểm tra đúng địa điểm.'}
                </figcaption>
                <a
                  href={candidate.image.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở trang nguồn và giấy phép
                </a>
                <button
                  type="button"
                  disabled={
                    previews[candidate.image.url] !== 'loaded' ||
                    (form.images?.length ?? 0) >= 8 ||
                    !!form.images?.some((i) => i.url === candidate.image.url)
                  }
                  onClick={() =>
                    update({
                      images: [
                        { ...candidate.image, reviewed: true },
                        ...(form.images ?? []),
                      ],
                    })
                  }
                >
                  Chọn ảnh thật này làm bìa
                </button>
              </figure>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
