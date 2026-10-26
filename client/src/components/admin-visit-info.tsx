import { AdminPriceTerms } from './admin-price-terms';
import { Clock3, Banknote, CheckCircle2, Search, ArrowRight } from '../icons';
import { useEffect, useRef, useState } from 'react';
import {
  visitPriceLabel,
  visitInfoSchema,
  catalogToday,
  sharedPriceBudget,
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
  const priceLocked = locked || !!form.fieldLocks?.includes('referencePrice');
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
      if (
        form.visitInfo == null ||
        (!form.visitInfo.hours && !form.visitInfo.price)
      )
        update({
          visitInfo: {
            ...data.result,
            price: priceLocked ? null : data.result.price,
            hours: form.openingHoursNote ? null : data.result.hours,
          },
        });
    }
  }, [data, form, place, disabled, locked, priceLocked, update]);
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
        ...info,
        pricingVersion: 1,
        hours: info?.hours ?? null,
        price: info?.price ?? null,
        ...change,
      },
    });

  const hours = info?.hours;
  const price = info?.price;
  const pending = busy || ['pending', 'searching'].includes(data?.state ?? '');
  const validPrice =
    !!price && visitInfoSchema.shape.price.safeParse(price).success;
  const budget = sharedPriceBudget(price, form.venueType);
  const priceMode = !price ? 'unknown' : price.amount === 0 ? 'free' : 'paid';
  function selectPrice(mode: 'unknown' | 'free' | 'paid') {
    applied.current = true;
    if (mode === priceMode) return;
    if (mode === 'unknown') {
      patch({ price: null });
      return;
    }
    patch({
      price: {
        amount: mode === 'free' ? 0 : Number.NaN,
        currency: 'VND',
        unit: mode === 'free' ? 'person' : 'unspecified',
        conditions:
          mode === 'free'
            ? 'Miễn phí vé vào cửa; dịch vụ riêng có thể thu phí.'
            : '',
        sourceUrl: '',
        observedAt: new Date().toISOString(),
        reviewed: false,
      },
    });
  }
  return (
    <div className="visit-editor" data-editor-field="visitInfo">
      <div className="visit-editor-intro">
        <h2>Thông tin khách sẽ thấy</h2>
        <p>
          Kiểm tra giờ và giá bên dưới. Chưa biết thông tin nào, bạn có thể để
          trống thông tin đó.
        </p>
      </div>
      <div className="visit-source-strip">
        <Search size={17} />
        <span role="status">
          {!place
            ? 'Lưu địa điểm để hệ thống tự tìm thông tin.'
            : !data
              ? 'Đang kiểm tra kết quả tìm…'
              : data.state === 'pending'
                ? 'Đang chờ hệ thống tìm giờ và giá…'
                : data.state === 'searching'
                  ? 'Đang tìm thông tin cho địa điểm này…'
                  : data.state === 'failed'
                    ? 'Chưa kết nối được nguồn. Bạn có thể thử lại.'
                    : data.result
                      ? 'Đã có thông tin gợi ý. Hãy kiểm tra trước khi dùng.'
                      : 'Hệ thống chưa tìm được giờ và giá phù hợp.'}
        </span>
        {place && form.publicationStatus === 'draft' && (
          <button
            type="button"
            disabled={disabled || locked || pending}
            onClick={() => void retry()}
          >
            {pending ? 'Đang tìm…' : 'Tìm lại'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="admin-alert">
          {error}
          <button type="button" onClick={() => setReload((v) => v + 1)}>
            Tải lại
          </button>
        </p>
      )}
      <fieldset
        className="visit-editor-card"
        disabled={disabled}
        data-editor-field="openingHoursNote"
        id="admin-section-hours"
      >
        <legend>
          <Clock3 size={20} />
          Giờ mở cửa
        </legend>
        <header>
          <p>Địa điểm đón khách vào thời gian nào?</p>
          <span
            className={
              hours?.reviewed || (!hours && form.openingHoursNote)
                ? 'is-confirmed'
                : hours
                  ? 'is-suggested'
                  : 'is-unknown'
            }
          >
            {hours?.reviewed
              ? 'Đã xác nhận'
              : hours
                ? 'Gợi ý cần kiểm tra'
                : form.openingHoursNote
                  ? 'Đã nhập'
                  : 'Chưa có thông tin'}
          </span>
        </header>
        <label>
          Giờ mở cửa hiển thị cho khách
          <textarea
            aria-label="Giờ mở cửa hiển thị cho khách"
            rows={2}
            maxLength={400}
            disabled={!!hours && locked}
            value={hours?.text ?? form.openingHoursNote}
            placeholder="Ví dụ: Thứ Ba – Chủ nhật, 08:00–17:00; nghỉ thứ Hai"
            onChange={(e) =>
              hours
                ? patch({
                    hours: { ...hours, text: e.target.value, reviewed: false },
                  })
                : update({ openingHoursNote: e.target.value })
            }
          />
        </label>
        {!hours && !form.openingHoursNote && (
          <small>
            Chưa rõ giờ? Để trống, khách sẽ thấy thông tin chưa được cập nhật.
          </small>
        )}
        {hours && (
          <>
            <a
              className="visit-evidence-link"
              href={hours.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Đối chiếu giờ tại nguồn ↗
            </a>
            <div className="visit-card-actions">
              {hours.reviewed ? (
                <span className="visit-confirmed">
                  <CheckCircle2 size={17} />
                  Giờ này đã được chọn cho bản nháp
                </span>
              ) : (
                <button
                  type="button"
                  className="visit-use-button"
                  disabled={locked || !hours.text.trim()}
                  onClick={() =>
                    update({
                      visitInfo: {
                        ...info,
                        pricingVersion: 1,
                        hours: { ...hours, reviewed: true },
                        price: price ?? null,
                      },
                      openingHoursNote: hours.text,
                    })
                  }
                >
                  Dùng giờ này
                  <CheckCircle2 size={16} />
                </button>
              )}
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  patch({ hours: null });
                  if (form.openingHoursNote === hours.text)
                    update({
                      visitInfo: {
                        ...info,
                        pricingVersion: 1,
                        hours: null,
                        price: price ?? null,
                      },
                      openingHoursNote: '',
                    });
                }}
              >
                Bỏ gợi ý giờ
              </button>
            </div>
          </>
        )}
        {!hours && data?.result?.hours && (
          <button
            type="button"
            disabled={locked}
            onClick={() => patch({ hours: data.result!.hours })}
          >
            Xem gợi ý giờ đã tìm được
          </button>
        )}
      </fieldset>
      <fieldset
        className="visit-editor-card"
        disabled={disabled || priceLocked}
        data-editor-field="displayPrice"
      >
        <legend>
          <Banknote size={20} />
          Giá tham khảo
        </legend>
        <header>
          <p>Khách cần trả bao nhiêu để tham quan hoặc sử dụng dịch vụ?</p>
          <span
            className={
              price?.reviewed
                ? 'is-confirmed'
                : price
                  ? 'is-suggested'
                  : 'is-unknown'
            }
          >
            {price?.reviewed
              ? 'Đã xác nhận'
              : price
                ? 'Cần xác nhận'
                : 'Chưa rõ giá'}
          </span>
        </header>
        <div
          className="visit-price-choices"
          role="group"
          aria-label="Loại giá tham khảo"
        >
          {(
            [
              { value: 'unknown', label: 'Chưa rõ giá' },
              { value: 'free', label: 'Miễn phí' },
              { value: 'paid', label: 'Có thu phí' },
            ] as const
          ).map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={priceMode === option.value}
              onClick={() => selectPrice(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!price ? (
          <div className="visit-price-empty">
            <p>Chưa có giá được xác nhận cho địa điểm này.</p>
            <small>
              Bạn có thể giữ “Chưa rõ giá” và tiếp tục hoàn thiện địa điểm. Chỉ
              chọn “Miễn phí” khi đã có căn cứ.
            </small>
            {data?.result?.price && (
              <button
                type="button"
                onClick={() => patch({ price: data.result!.price })}
              >
                Xem giá gợi ý đã tìm được
              </button>
            )}
          </div>
        ) : (
          <>
            {
              <div className="visit-editor-fields">
                <label>
                  Giá từ (VND)
                  <input
                    aria-label="Giá từ (VND)"
                    type="number"
                    min={0}
                    max={1e12}
                    step={1}
                    value={Number.isFinite(price.amount) ? price.amount : ''}
                    placeholder="Ví dụ: 40000"
                    onChange={(e) =>
                      patch({
                        price: {
                          ...price,
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
                    aria-label="Đơn vị áp dụng"
                    value={price.unit}
                    onChange={(e) =>
                      patch({
                        price: {
                          ...price,
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
            }
            <label>
              Đối tượng và điều kiện áp dụng
              <textarea
                rows={2}
                maxLength={500}
                value={price.conditions}
                placeholder="Ví dụ: Vé vào cửa dành cho người lớn; chưa gồm dịch vụ riêng."
                onChange={(e) =>
                  patch({
                    price: {
                      ...price,
                      conditions: e.target.value,
                      reviewed: false,
                    },
                  })
                }
              />
            </label>
            <label>
              Nguồn để kiểm tra giá
              <input
                type="url"
                maxLength={2048}
                value={price.sourceUrl}
                placeholder="Dán đường dẫn bảng giá hoặc website địa điểm"
                onChange={(e) =>
                  patch({
                    price: {
                      ...price,
                      sourceUrl: e.target.value,
                      reviewed: false,
                    },
                  })
                }
              />
            </label>
            <AdminPriceTerms
              price={price}
              venueType={form.venueType}
              onChange={(change) =>
                patch({
                  price: {
                    ...price,
                    terms: { ...price.terms, ...change },
                    reviewed: false,
                  },
                })
              }
            />
            {!!price.sourceUrl && (
              <a
                className="visit-evidence-link"
                href={
                  price.sourceUrl.startsWith('https://')
                    ? price.sourceUrl
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
              >
                Mở nguồn để đối chiếu ↗
              </a>
            )}
            {Number.isFinite(price.amount) && (
              <div className="visit-customer-preview">
                <small>KHÁCH SẼ THẤY SAU KHI XUẤT BẢN</small>
                <strong>{visitPriceLabel(price)}</strong>
                <p>
                  {price.conditions ||
                    'Bổ sung đối tượng và điều kiện áp dụng.'}
                </p>
              </div>
            )}
            <div
              className={
                'visit-price-eligibility ' +
                (budget.referencePrice ? 'is-ready' : '')
              }
              role="status"
            >
              <strong>
                {budget.referencePrice
                  ? 'Dùng để hiển thị và tính ngân sách'
                  : 'Hiển thị tham khảo; chưa tự tính ngân sách'}
              </strong>
              {budget.referencePrice ? (
                <p>
                  {budget.referencePrice.basis === 'per_person'
                    ? 'Chi phí = giá này × số người.'
                    : 'Chi phí dùng giá trọn nhóm trong giới hạn đã nhập.'}{' '}
                  Áp dụng cho {budget.referencePrice.minTravelers ?? 1}–
                  {budget.referencePrice.maxTravelers} người.
                </p>
              ) : (
                <ul>
                  {budget.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="visit-card-actions">
              {price.reviewed ? (
                <span className="visit-confirmed">
                  <CheckCircle2 size={17} />
                  Giá này đã được chọn cho bản nháp
                </span>
              ) : (
                <button
                  type="button"
                  className="visit-use-button"
                  disabled={!validPrice}
                  onClick={() =>
                    patch({
                      price: {
                        ...price,
                        reviewed: true,
                        terms: {
                          ...price.terms,
                          checkedAt: catalogToday(),
                          reviewAfter:
                            price.terms?.reviewAfter ?? catalogToday(),
                        },
                      },
                    })
                  }
                >
                  Xác nhận giá này
                  <CheckCircle2 size={16} />
                </button>
              )}
              <button type="button" onClick={() => patch({ price: null })}>
                Bỏ giá này
              </button>
            </div>
            {!validPrice && (
              <small className="visit-validation-hint">
                Điền số tiền hợp lệ, điều kiện áp dụng và đường dẫn nguồn HTTPS
                để xác nhận.
              </small>
            )}
          </>
        )}
      </fieldset>
      {priceLocked && (
        <p className="admin-alert">
          Thông tin giá và gợi ý giờ đang khóa. Bạn có thể mở khóa trong tab
          Nguồn & lịch sử.
        </p>
      )}
      <div className="visit-editor-next">
        <ArrowRight size={18} />
        <p>
          Xong phần này, bấm <strong>Lưu đề xuất</strong>. Sau đó chọn{' '}
          <strong>Xem trước xuất bản</strong> để kiểm tra lần cuối.
        </p>
      </div>
    </div>
  );
}
