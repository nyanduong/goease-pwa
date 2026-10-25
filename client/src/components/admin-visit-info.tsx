import { useEffect, useRef, useState } from 'react';
import {
  visitPriceLabel,
  type AdminPlaceDto,
  type AdminPlaceInput,
  type VisitInfo,
  type VisitInfoSearchDto,
} from '@goease/contracts';
import { api } from '../api';

export function AdminVisitInfo({
  place,
  form,
  update,
  disabled = false,
}: {
  place: AdminPlaceDto | null;
  form: AdminPlaceInput;
  update: (patch: Partial<AdminPlaceInput>) => void;
  disabled?: boolean;
}) {
  const [data, setData] = useState<VisitInfoSearchDto | null>(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false);
  const applied = useRef(false);
  const locked = !!form.fieldLocks?.includes('visitInfo');
  useEffect(() => {
    applied.current = false;
  }, [place?.id]);
  useEffect(() => {
    setData(null);
    setError('');
    if (!place) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await api<VisitInfoSearchDto>(
          `/admin/places/${place!.id}/visit-info`,
        );
        if (!active) return;
        setData(next);
        if (['pending', 'searching'].includes(next.state))
          timer = setTimeout(() => void load(), 3000);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được nguồn.');
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
      !applied.current &&
      data?.result &&
      place &&
      !disabled &&
      !locked &&
      form.publicationStatus === 'draft' &&
      form.name === place.name &&
      form.sourceUrl === place.sourceUrl &&
      form.destinationId === place.destinationId &&
      JSON.stringify(form.mapLocation ?? null) ===
        JSON.stringify(place.mapLocation ?? null)
    ) {
      applied.current = true;
      if (form.visitInfo == null) update({ visitInfo: data.result });
    }
  }, [data, form, place, disabled, locked, update]);
  async function retry() {
    if (!place) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/places/${place.id}/visit-info/search`, {
        method: 'POST',
        body: '{}',
      });
      setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tìm được nguồn.');
    } finally {
      setBusy(false);
    }
  }
  const info = form.visitInfo;
  const patch = (change: Partial<VisitInfo>) =>
    update({
      visitInfo: {
        hours: info?.hours ?? null,
        price: info?.price ?? null,
        ...change,
      },
    });
  return (
    <fieldset
      className="admin-form-fields admin-visit-info"
      disabled={disabled || locked}
      data-editor-field="visitInfo"
    >
      <legend>Giờ & giá từ nguồn</legend>
      <p>
        Thông tin được lấy vào bản nháp. Kiểm tra điều kiện trước khi xuất bản;
        giá “Từ” không tự dùng để tính ngân sách.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <p role="status">
          {!place
            ? 'Lưu bản nháp để tìm thông tin.'
            : !data
              ? 'Đang kiểm tra nguồn…'
              : data.state === 'pending'
                ? 'Đang chờ lượt tìm từ các nguồn…'
                : data.state === 'searching'
                  ? 'Đang đọc nguồn và website địa điểm…'
                  : data.message}
        </p>
      )}
      {info?.hours && (
        <section className="visit-fact">
          <h3>Giờ mở cửa gợi ý</h3>
          <textarea
            aria-label="Giờ mở cửa từ nguồn"
            maxLength={400}
            value={info.hours.text}
            onChange={(e) =>
              patch({
                hours: {
                  ...info.hours!,
                  text: e.target.value,
                  reviewed: false,
                },
              })
            }
          />
          <small>
            <a href={info.hours.sourceUrl} target="_blank" rel="noreferrer">
              Xem nguồn ↗
            </a>{' '}
            · Lấy ngày{' '}
            {new Date(info.hours.observedAt).toLocaleDateString('vi-VN')}
          </small>
          <label className="visit-review">
            <input
              type="checkbox"
              checked={info.hours.reviewed}
              onChange={(e) => {
                const reviewed = e.target.checked;
                update({
                  visitInfo: { ...info, hours: { ...info.hours!, reviewed } },
                  ...(reviewed ? { openingHoursNote: info.hours!.text } : {}),
                });
              }}
            />
            Đã kiểm tra giờ mở cửa
          </label>
          <button type="button" onClick={() => patch({ hours: null })}>
            Bỏ gợi ý giờ
          </button>
        </section>
      )}
      {info?.price && (
        <section className="visit-fact">
          <h3>{visitPriceLabel(info.price)}</h3>
          <div className="visit-price-grid">
            <label>
              Giá từ (VND)
              <input
                type="number"
                min={0}
                max={1e9}
                step={1}
                value={info.price.amount}
                onChange={(e) =>
                  patch({
                    price: {
                      ...info.price!,
                      amount: e.target.valueAsNumber,
                      reviewed: false,
                    },
                  })
                }
              />
            </label>
            <label>
              Đơn vị áp dụng
              <select
                value={info.price.unit}
                onChange={(e) =>
                  patch({
                    price: {
                      ...info.price!,
                      unit: e.target.value as NonNullable<
                        VisitInfo['price']
                      >['unit'],
                      reviewed: false,
                    },
                  })
                }
              >
                <option value="unspecified">Theo điều kiện bên dưới</option>
                <option value="person">Mỗi người</option>
                <option value="item">Mỗi món</option>
                <option value="group">Mỗi nhóm</option>
              </select>
            </label>
          </div>
          <label>
            Đối tượng và điều kiện
            <textarea
              maxLength={500}
              value={info.price.conditions}
              onChange={(e) =>
                patch({
                  price: {
                    ...info.price!,
                    conditions: e.target.value,
                    reviewed: false,
                  },
                })
              }
            />
          </label>
          <small>
            <a href={info.price.sourceUrl} target="_blank" rel="noreferrer">
              Xem nguồn giá ↗
            </a>{' '}
            · Lấy ngày{' '}
            {new Date(info.price.observedAt).toLocaleDateString('vi-VN')}
          </small>
          <label className="visit-review">
            <input
              type="checkbox"
              checked={info.price.reviewed}
              onChange={(e) =>
                patch({ price: { ...info.price!, reviewed: e.target.checked } })
              }
            />
            Đã kiểm tra giá và điều kiện áp dụng
          </label>
          <button type="button" onClick={() => patch({ price: null })}>
            Bỏ gợi ý giá
          </button>
        </section>
      )}
      {data?.result && (
        <button
          type="button"
          onClick={() => {
            applied.current = true;
            update({ visitInfo: data.result });
          }}
        >
          Nạp lại gợi ý vào nháp
        </button>
      )}
      {place && form.publicationStatus === 'draft' && (
        <button
          type="button"
          disabled={
            busy || ['pending', 'searching'].includes(data?.state ?? '')
          }
          onClick={() => void retry()}
        >
          {busy ? 'Đang yêu cầu…' : 'Tìm lại giờ & giá'}
        </button>
      )}
      {locked && <p>Trường này đang khóa trong tab Nguồn & lịch sử.</p>}
    </fieldset>
  );
}
