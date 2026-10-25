import { useEffect, useRef, useState } from 'react';
import type {
  AdminPlaceInput,
  PlaceImageSearchDto,
  ImageCandidate,
} from '@goease/contracts';
import { api } from '../api';
import { Image as ImageIcon, X, Check, RefreshCw } from 'lucide-react';
import { approvedPhoto } from '@goease/contracts';

export function AdminWikimediaImages({
  id,
  form,
  update,
  compact = false,
  onViewAll,
  onCount,
  disabled = false,
}: {
  compact?: boolean;
  onViewAll?: () => void;
  onCount?: (count: number) => void;
  disabled?: boolean;
  id?: string | undefined;
  form: AdminPlaceInput;
  update: (value: Partial<AdminPlaceInput>) => void;
}) {
  const [inspect, setInspect] = useState<ImageCandidate | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    if (inspect) dialog.current?.showModal();
    else dialog.current?.close();
  }, [inspect]);
  const [data, setData] = useState<PlaceImageSearchDto | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [previews, setPreviews] = useState<Record<string, 'loaded' | 'failed'>>(
    {},
  );
  useEffect(() => {
    setData(null);
    setInspect(null);
    onCount?.(0);
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
        onCount?.(result.candidates.length);
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
  }, [id, reload, onCount]);
  useEffect(() => {
    if (
      data?.defaultCover &&
      form.publicationStatus === 'draft' &&
      !form.images?.length &&
      !form.fieldLocks?.includes('images')
    ) {
      update({ images: [data.defaultCover] });
    }
  }, [
    data?.defaultCover,
    form.publicationStatus,
    form.images,
    form.fieldLocks,
    update,
  ]);
  async function search() {
    if (!id || busy || disabled) return;
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
  const cover = approvedPhoto(form.images?.[0]) ? form.images?.[0] : undefined;
  const waiting = !data || ['pending', 'searching'].includes(data.state);
  return (
    <section
      aria-label="Ảnh gợi ý Wikimedia"
      className={'place-photo-picker' + (compact ? ' is-compact' : '')}
    >
      <header className="place-photo-heading">
        <ImageIcon size={23} />
        <div>
          <h2>Ảnh địa điểm</h2>
          <p>
            {data?.candidates.length ?? 0} ảnh gợi ý ·{' '}
            {cover ? 'Đã chọn ảnh bìa' : 'Chưa chọn ảnh bìa'}
          </p>
        </div>
        {compact && (
          <button type="button" onClick={onViewAll}>
            Xem tất cả →
          </button>
        )}
      </header>
      {!id ? (
        <div className="place-photos-empty">
          <ImageIcon size={32} />
          <p>Lưu bản nháp trước để hệ thống tự tìm ảnh.</p>
        </div>
      ) : (
        <>
          {error && (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => setReload((v) => v + 1)}>
                Tải lại
              </button>
            </p>
          )}
          {!error && waiting && (
            <p role="status">Đang tìm và chuẩn bị ảnh gợi ý…</p>
          )}
          {data && !waiting && !data.candidates.length && (
            <div className="place-photos-empty">
              <ImageIcon size={32} />
              <p role="status">
                {data.message || 'Chưa tìm thấy ảnh phù hợp.'}
              </p>
            </div>
          )}
          <div className="place-photo-candidates">
            {data?.candidates.map((candidate) => (
              <figure
                key={candidate.id}
                className={cover?.url === candidate.image.url ? 'is-cover' : ''}
              >
                <div className="place-candidate-image">
                  <button
                    type="button"
                    className="place-photo-open"
                    aria-label={'Xem ảnh: ' + candidate.title}
                    onClick={() => setInspect(candidate)}
                  >
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
                  </button>
                  {cover?.url === candidate.image.url && (
                    <span className="place-cover-label">
                      <Check size={14} />
                      Ảnh bìa
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={'Chọn làm bìa: ' + candidate.title}
                    aria-pressed={cover?.url === candidate.image.url}
                    disabled={
                      disabled ||
                      previews[candidate.image.url] !== 'loaded' ||
                      ((form.images?.length ?? 0) >= 8 &&
                        !form.images?.some(
                          (i) => i.url === candidate.image.url,
                        ))
                    }
                    onClick={() =>
                      update({
                        images: [
                          {
                            ...candidate.image,
                            selection: 'admin',
                            reviewed: false,
                          },
                          ...(form.images ?? []).filter(
                            (i) => i.url !== candidate.image.url,
                          ),
                        ],
                      })
                    }
                  >
                    {cover?.url === candidate.image.url
                      ? 'Đang làm bìa'
                      : 'Chọn làm bìa'}
                  </button>
                </div>
                {previews[candidate.image.url] === 'failed' && (
                  <small>Không tải được ảnh này.</small>
                )}
              </figure>
            ))}
          </div>
          {cover &&
            !data?.candidates.some((c) => c.image.url === cover.url) && (
              <p>Ảnh bìa đã chọn trong mục quản lý ảnh bên dưới.</p>
            )}
          <footer className="place-photo-help">
            <span>
              Ảnh đầu tiên được chọn làm bìa. Bạn có thể đổi ảnh khác.
            </span>
            {(!compact || !data?.candidates.length) && (
              <button
                type="button"
                disabled={disabled || busy || data?.state === 'searching'}
                onClick={() => void search()}
              >
                <RefreshCw size={14} />
                Tìm ảnh khác
              </button>
            )}
          </footer>
        </>
      )}
      <dialog
        ref={dialog}
        className="place-photo-viewer"
        aria-label="Xem ảnh địa điểm"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          backdropPress.current =
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom);
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const outside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;
          if (
            backdropPress.current &&
            event.target === event.currentTarget &&
            outside
          )
            setInspect(null);
          backdropPress.current = false;
        }}
        onCancel={() => setInspect(null)}
        onClose={() => setInspect(null)}
      >
        {inspect && (
          <>
            <img
              src={inspect.image.url}
              alt={inspect.title}
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              className="place-photo-close"
              aria-label="Đóng xem ảnh"
              onClick={() => setInspect(null)}
            >
              <X size={24} />
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
