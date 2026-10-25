import { useEffect, useRef, useState } from 'react';
import {
  needsPlaceDescription,
  type AdminPlaceDto,
  type AdminPlaceInput,
  type PlaceDescriptionSearchDto,
} from '@goease/contracts';
import { api } from '../api';
export function AdminPlaceDescription({
  place,
  form,
  update,
  sourceOnly = false,
  disabled = false,
}: {
  place: AdminPlaceDto | null;
  form: AdminPlaceInput;
  update: (patch: Partial<AdminPlaceInput>) => void;
  sourceOnly?: boolean;
  disabled?: boolean;
}) {
  const [data, setData] = useState<PlaceDescriptionSearchDto | null>(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false);
  const applied = useRef(false);
  useEffect(() => {
    applied.current = false;
  }, [place?.id]);
  useEffect(() => {
    setData(null);
    setError('');
    if (!place?.id) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await api<PlaceDescriptionSearchDto>(
          `/admin/places/${place!.id}/description`,
        );
        if (!active) return;
        setData(next);
        if (['pending', 'searching'].includes(next.state))
          timer = setTimeout(() => void load(), 3000);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Chưa tải được giới thiệu.',
          );
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [place?.id, reload]);
  useEffect(() => {
    if (
      !sourceOnly &&
      !disabled &&
      !applied.current &&
      data?.result?.text &&
      place &&
      form.publicationStatus === 'draft' &&
      form.name === place.name &&
      form.destinationId === place.destinationId &&
      JSON.stringify(form.mapLocation ?? null) ===
        JSON.stringify(place.mapLocation ?? null) &&
      needsPlaceDescription(form.description) &&
      !form.fieldLocks?.includes('description')
    ) {
      applied.current = true;
      update({ description: data.result.text });
    }
  }, [data, form, place, update, sourceOnly, disabled]);
  async function retry() {
    if (!place || busy || disabled) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/places/${place.id}/description/search`, {
        method: 'POST',
        body: '{}',
      });
      setReload((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa yêu cầu được lượt tìm mới.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!place)
    return <small>Lưu bản nháp để hệ thống tìm giới thiệu có nguồn.</small>;
  if (sourceOnly)
    return (
      <section className="admin-description-source">
        <h3>Nguồn giới thiệu</h3>
        {data?.result ? (
          <>
            <a href={data.result.sourceUrl} target="_blank" rel="noreferrer">
              Wikipedia · {data.result.title} ↗
            </a>
            <p>
              {data.result.translated
                ? 'Bản dịch tiếng Việt từ bài tiếng Anh'
                : 'Trích đoạn nguồn'}{' '}
              · {data.result.license} · bản {data.result.revisionId}
            </p>
            <details>
              <summary>Xem nội dung gốc</summary>
              <p>{data.result.originalText}</p>
            </details>
          </>
        ) : (
          <p>{error || data?.message || 'Chưa có nguồn giới thiệu.'}</p>
        )}
      </section>
    );
  return (
    <div
      className="admin-description-status"
      aria-label="Tìm giới thiệu địa điểm"
    >
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setReload((v) => v + 1)}>
            Tải lại
          </button>
        </p>
      ) : (
        <p role="status">
          {!data
            ? 'Đang kiểm tra nguồn giới thiệu…'
            : ['pending', 'searching'].includes(data.state)
              ? 'Đang tìm giới thiệu từ Wikipedia…'
              : data.message}
        </p>
      )}
      {data?.result && (
        <small>
          {data.result.translated ? 'Đã dịch sang tiếng Việt. ' : ''}Nguồn được
          lưu trong tab Nguồn & lịch sử.
        </small>
      )}
      {form.publicationStatus === 'draft' && (
        <button
          type="button"
          disabled={
            disabled ||
            busy ||
            ['pending', 'searching'].includes(data?.state ?? '')
          }
          onClick={() => void retry()}
        >
          {busy ? 'Đang yêu cầu…' : 'Tìm lại giới thiệu'}
        </button>
      )}
    </div>
  );
}
