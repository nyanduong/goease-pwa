import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  adminPlaceInputSchema,
  catalogToday,
  type AdminPlaceDto,
  type AdminPlaceInput,
  type DestinationDto,
  type ReferencePrice,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { moneyText } from '../trip-draft';
import { PlacePlanning } from './place-planning';
import { SourceCredit } from './source-credit';
import { AdminBatch } from './admin-batch';
const AdminPlaceImport = lazy(() =>
  import('./admin-place-import').then((v) => ({ default: v.AdminPlaceImport })),
);

type HistoryItem = {
  action: string;
  entityRevision: number;
  occurredAt: string;
};
const statusText = {
  draft: 'Bản nháp',
  published: 'Đang hiển thị',
  archived: 'Đã ngừng hiển thị',
};
const newPlace = (destinationId: string): AdminPlaceInput => ({
  destinationId,
  name: '',
  category: 'culture',
  venueType: 'place',
  description: '',
  locationQuery: '',
  durationMinutes: 60,
  openingHoursNote: '',
  sourceUrl: '',
  referencePrice: null,
  publicationStatus: 'draft',
});
const newPrice = (): ReferencePrice => ({
  label: '',
  amountMinor: Number.NaN,
  basis: 'per_person',
  maxTravelers: 1000,
  conditions: '',
  sourceUrl: '',
  checkedAt: catalogToday(),
  reviewAfter: catalogToday(),
});
const formFromDto = ({
  id,
  revision,
  updatedAt,
  source,
  ...input
}: AdminPlaceDto) => {
  void id;
  void revision;
  void updatedAt;
  void source;
  return input;
};
export function AdminCatalog({
  destinations,
  openPlace,
}: {
  destinations: DestinationDto[];
  openPlace?: { id: string; request: number } | null;
}) {
  const [selected, setSelected] = useState<AdminPlaceDto[]>([]);
  const [items, setItems] = useState<AdminPlaceDto[]>([]);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState<AdminPlaceInput | null>(null);
  const [saved, setSaved] = useState<AdminPlaceDto | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const key = useRef({ payload: '', key: '' });
  const previewPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (openPlace) void open(openPlace.id);
  }, [openPlace]);
  useEffect(() => {
    if (preview) previewPanel.current?.scrollIntoView({ block: 'start' });
  }, [preview]);
  useEffect(() => {
    if (error || success) window.scrollTo(0, 0);
  }, [error, success]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setListError('');
    void api<{ items: AdminPlaceDto[]; hasMore: boolean }>(
      `/admin/places?${new URLSearchParams({ q, status, offset: String(offset) })}`,
    )
      .then((v) => {
        if (active) {
          setItems(v.items);
          setHasMore(v.hasMore);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setItems([]);
          setListError(
            e instanceof Error ? e.message : 'Chưa tải được danh mục.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q, status, offset, retry]);
  const update = (patch: Partial<AdminPlaceInput>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setError('');
    setSuccess('');
    setPreview(false);
  };
  const updatePrice = (patch: Partial<ReferencePrice>) =>
    update({ referencePrice: { ...form!.referencePrice!, ...patch } });
  async function open(id: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const value = await api<{ place: AdminPlaceDto; history: HistoryItem[] }>(
        `/admin/places/${id}`,
      );
      setSaved(value.place);
      setForm(formFromDto(value.place));
      setHistory(value.history);
      setSelected((v) =>
        v.map((p) => (p.id === value.place.id ? value.place : p)),
      );
      setPreview(false);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa mở được địa điểm.');
    } finally {
      setBusy(false);
    }
  }
  async function save(publicationStatus: AdminPlaceInput['publicationStatus']) {
    if (!form || busy) return;
    const checked = adminPlaceInputSchema.safeParse({
      ...form,
      publicationStatus,
    });
    if (!checked.success) {
      setError(
        'Chưa thể lưu. Kiểm tra tên, giới thiệu, địa chỉ và link nguồn HTTPS. Nếu bật giá tự động, điền đủ tên khoản giá, số tiền không âm, số người, điều kiện, nguồn và ngày kiểm tra.',
      );
      return;
    }
    const payload = JSON.stringify({
      place: checked.data,
      ...(saved ? { expectedRevision: saved.revision } : {}),
    });
    if (key.current.payload !== payload)
      key.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const value = await api<{ place: AdminPlaceDto }>(
        saved ? `/admin/places/${saved.id}` : '/admin/places',
        {
          method: saved ? 'PATCH' : 'POST',
          headers: { 'Idempotency-Key': key.current.key },
          body: payload,
        },
      );
      setSaved(value.place);
      setForm(formFromDto(value.place));
      setPreview(false);
      setSelected((v) =>
        v.map((p) => (p.id === value.place.id ? value.place : p)),
      );
      setRetry((v) => v + 1);
      setHistory((v) =>
        [
          {
            action: 'catalog.updated',
            entityRevision: value.place.revision,
            occurredAt: value.place.updatedAt,
          },
          ...v,
        ].slice(0, 20),
      );
      setSuccess(
        publicationStatus === 'published'
          ? 'Đã xuất bản. Khách có thể dùng địa điểm và giá tham khảo này trong lịch mới.'
          : publicationStatus === 'archived'
            ? 'Đã ngừng hiển thị. Lịch khách đã lưu vẫn được giữ.'
            : 'Đã lưu bản nháp. Khách chưa nhìn thấy nội dung này.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được. Hãy thử lại.');
      if (e instanceof ApiFailure && e.status === 403) setItems([]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-catalog">
      <header className="admin-heading">
        <span className="admin-eyebrow">GOEASE · QUẢN TRỊ</span>
        <h1>
          {form
            ? saved
              ? 'Chỉnh sửa địa điểm'
              : 'Thêm địa điểm / quán ăn'
            : 'Địa điểm & giá tham khảo'}
        </h1>
        <p>
          Chuẩn bị dữ liệu để khách nhận được lịch trình và dự toán tự động.
        </p>
      </header>
      {form && saved?.source && (
        <div>
          Nhập từ nguồn lúc{' '}
          {new Date(saved.source.fetchedAt).toLocaleString('vi-VN')}. Thông tin
          cần biên tập, giờ mở cửa chưa được xác minh. <SourceCredit expanded />
        </div>
      )}
      {error && (
        <div role="alert" className="admin-alert">
          {error}
          {saved && (
            <p>
              <a href="/admin" target="_blank" rel="noreferrer">
                Mở danh mục ở tab mới để đối chiếu ↗
              </a>
            </p>
          )}
        </div>
      )}
      {success && (
        <p role="status" className="admin-success">
          {success}
        </p>
      )}
      {importing ? (
        <Suspense
          fallback={<p role="status">Đang mở công cụ nhập địa điểm…</p>}
        >
          <AdminPlaceImport
            onBack={() => {
              setImporting(false);
              setRetry((v) => v + 1);
            }}
            onOpen={(id) => {
              setImporting(false);
              setRetry((v) => v + 1);
              void open(id);
            }}
          />
        </Suspense>
      ) : !form ? (
        <>
          <div className="admin-actions">
            <button
              className="journey-outline"
              disabled={busy}
              onClick={() => setImporting(true)}
            >
              Nhập địa điểm từ Geoapify
            </button>
            <button
              className="journey-primary"
              disabled={busy || !destinations.length}
              onClick={() => {
                setSaved(null);
                setForm(
                  newPlace(
                    destinations.find((d) => d.name === 'Hội An')?.id ??
                      destinations[0]!.id,
                  ),
                );
                setHistory([]);
                setError('');
                setSuccess('');
              }}
            >
              Thêm địa điểm / quán ăn
            </button>
          </div>
          <div className="admin-filters">
            <label>
              Tìm trong danh mục
              <input
                value={q}
                maxLength={100}
                placeholder="Tên địa điểm, quán ăn…"
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label>
              Trạng thái
              <select
                aria-label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">Tất cả</option>
                {Object.entries(statusText).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <AdminBatch
            selected={selected}
            onDone={(ids) => {
              setSelected((v) => v.filter((p) => !ids.includes(p.id)));
              setRetry((v) => v + 1);
            }}
          />
          {!!items.length && (
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={items.every((p) =>
                  selected.some((s) => s.id === p.id),
                )}
                onChange={(e) =>
                  setSelected((v) =>
                    e.target.checked
                      ? [
                          ...v,
                          ...items.filter((p) => !v.some((s) => s.id === p.id)),
                        ].slice(0, 50)
                      : v.filter((p) => !items.some((s) => s.id === p.id)),
                  )
                }
              />
              Chọn các địa điểm trên trang (tối đa 50)
            </label>
          )}
          {loading ? (
            <p role="status">Đang tải danh mục…</p>
          ) : listError ? (
            <div role="alert">
              {listError}
              <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
            </div>
          ) : !items.length ? (
            <p>Chưa có địa điểm phù hợp. Thêm địa điểm mới hoặc đổi bộ lọc.</p>
          ) : (
            <div className="admin-place-list">
              {items.map((p) => (
                <article key={p.id} className="admin-place-card">
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${p.name}`}
                      checked={selected.some((s) => s.id === p.id)}
                      disabled={
                        selected.length >= 50 &&
                        !selected.some((s) => s.id === p.id)
                      }
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, p]
                            : v.filter((s) => s.id !== p.id),
                        )
                      }
                    />
                    Chọn địa điểm
                  </label>
                  <span
                    className={`admin-status status-${p.publicationStatus}`}
                  >
                    {statusText[p.publicationStatus]}
                  </span>
                  <h2>{p.name}</h2>
                  <p>
                    {p.venueType === 'restaurant'
                      ? 'Quán ăn'
                      : p.venueType === 'food_idea'
                        ? 'Gợi ý món ăn'
                        : 'Địa điểm'}{' '}
                    · {destinations.find((d) => d.id === p.destinationId)?.name}
                  </p>
                  <p>
                    {p.referencePrice
                      ? `${moneyText(p.referencePrice.amountMinor)} / ${p.referencePrice.basis === 'per_person' ? 'người' : 'nhóm'}`
                      : 'Chưa bật giá tự động'}
                  </p>
                  {p.referencePrice &&
                    p.referencePrice.reviewAfter < catalogToday() && (
                      <p className="admin-warning">
                        Giá đến hạn kiểm tra — tạm không dùng cho dự toán mới.
                      </p>
                    )}
                  <button
                    className="journey-outline"
                    disabled={busy}
                    onClick={() => void open(p.id)}
                    aria-label={`Chỉnh sửa ${p.name}`}
                  >
                    Chỉnh sửa
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="admin-actions">
            <button
              disabled={!offset || loading}
              onClick={() => setOffset((v) => Math.max(0, v - 20))}
            >
              Trang trước
            </button>
            <button
              disabled={!hasMore || loading}
              onClick={() => setOffset((v) => v + 20)}
            >
              Trang tiếp
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!adminPlaceInputSchema.safeParse(form).success) {
              setError(
                'Điền đủ tên, mô tả, vị trí, nguồn và thông tin giá nếu bật.',
              );
              return;
            }
            setPreview(true);
          }}
        >
          <button
            type="button"
            className="admin-back"
            disabled={busy}
            onClick={() => {
              if (
                success ||
                (saved &&
                  JSON.stringify(form) ===
                    JSON.stringify(formFromDto(saved))) ||
                confirm('Về danh sách? Thay đổi chưa lưu sẽ bị bỏ.')
              ) {
                setForm(null);
                setSuccess('');
                setError('');
              }
            }}
          >
            ← Về danh sách
          </button>
          <fieldset disabled={busy} className="admin-form-fields">
            <legend>Thông tin khách sẽ thấy</legend>
            <div className="admin-two">
              <label>
                Điểm đến
                <select
                  aria-label="Điểm đến"
                  disabled={!!saved}
                  value={form.destinationId}
                  onChange={(e) => update({ destinationId: e.target.value })}
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Loại địa điểm
                <select
                  aria-label="Loại địa điểm"
                  value={form.venueType}
                  onChange={(e) => {
                    const venueType = e.target
                      .value as AdminPlaceInput['venueType'];
                    update({
                      venueType,
                      category: venueType === 'place' ? 'culture' : 'food',
                      ...(venueType === 'food_idea'
                        ? { referencePrice: null }
                        : {}),
                    });
                  }}
                >
                  <option value="place">Điểm tham quan</option>
                  <option value="restaurant">Quán ăn cụ thể</option>
                  <option value="food_idea">Gợi ý món ăn, chưa có quán</option>
                </select>
              </label>
            </div>
            <label>
              Tên địa điểm / quán ăn
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Giới thiệu ngắn
              <textarea
                required
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              Địa chỉ / vị trí tìm trên bản đồ
              <input
                required
                maxLength={200}
                value={form.locationQuery}
                placeholder="Tên cơ sở, số nhà, đường, khu vực"
                onChange={(e) => update({ locationQuery: e.target.value })}
              />
            </label>
            <div className="admin-two">
              <label>
                Thời gian dành ở đây (phút)
                <input
                  required
                  type="number"
                  min={15}
                  max={720}
                  step={1}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    update({ durationMinutes: Number(e.target.value) })
                  }
                />
              </label>
              {form.venueType === 'place' && (
                <label>
                  Nhóm trải nghiệm
                  <select
                    aria-label="Nhóm trải nghiệm"
                    value={form.category}
                    onChange={(e) =>
                      update({
                        category: e.target.value as AdminPlaceInput['category'],
                      })
                    }
                  >
                    <option value="culture">Văn hóa</option>
                    <option value="nature">Thiên nhiên</option>
                  </select>
                </label>
              )}
            </div>
            <label>
              Giờ mở cửa (nếu đã kiểm tra)
              <input
                maxLength={400}
                value={form.openingHoursNote}
                placeholder="Để trống nếu chưa rõ"
                onChange={(e) => update({ openingHoursNote: e.target.value })}
              />
            </label>
            <label>
              Link nguồn thông tin
              <input
                required
                type="url"
                placeholder="https://…"
                maxLength={2048}
                value={form.sourceUrl}
                onChange={(e) => update({ sourceUrl: e.target.value })}
              />
            </label>
          </fieldset>
          <fieldset disabled={busy} className="admin-form-fields">
            <legend>Giá cho dự toán tự động</legend>
            <p>
              Chọn một mức tham khảo áp dụng chung cho nhóm khách. Giá trẻ em,
              combo hoặc ưu đãi có điều kiện riêng không tự suy ra ở bước này.
            </p>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={!!form.referencePrice}
                disabled={form.venueType === 'food_idea'}
                onChange={(e) =>
                  update({
                    referencePrice: e.target.checked ? newPrice() : null,
                  })
                }
              />
              Có giá đủ căn cứ để tự tính
            </label>
            {form.referencePrice ? (
              <>
                <label>
                  Tên khoản giá
                  <input
                    required
                    maxLength={120}
                    value={form.referencePrice.label}
                    placeholder="Ví dụ: bữa ăn tham khảo / vé tham quan"
                    onChange={(e) => updatePrice({ label: e.target.value })}
                  />
                </label>
                <div className="admin-two">
                  <label>
                    Giá tham khảo (VND)
                    <input
                      required
                      type="number"
                      min={0}
                      max={1e12}
                      step={1}
                      value={
                        Number.isFinite(form.referencePrice.amountMinor)
                          ? form.referencePrice.amountMinor
                          : ''
                      }
                      placeholder="0 chỉ khi đã xác nhận miễn phí"
                      onChange={(e) =>
                        updatePrice({
                          amountMinor:
                            e.target.value === ''
                              ? Number.NaN
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Đơn vị tính
                    <select
                      aria-label="Đơn vị tính"
                      value={form.referencePrice.basis}
                      onChange={(e) =>
                        updatePrice({
                          basis: e.target.value as ReferencePrice['basis'],
                          maxTravelers:
                            e.target.value === 'group_total' ? 1 : 1000,
                        })
                      }
                    >
                      <option value="per_person">Theo người</option>
                      <option value="group_total">Cho cả nhóm</option>
                    </select>
                  </label>
                </div>
                <label>
                  Áp dụng cho nhóm tối đa (người)
                  <input
                    required
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={form.referencePrice.maxTravelers}
                    onChange={(e) =>
                      updatePrice({ maxTravelers: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Bao gồm gì / điều kiện áp dụng
                  <textarea
                    required
                    rows={2}
                    maxLength={500}
                    value={form.referencePrice.conditions}
                    onChange={(e) =>
                      updatePrice({ conditions: e.target.value })
                    }
                  />
                </label>
                <label>
                  Link nguồn giá
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    value={form.referencePrice.sourceUrl}
                    placeholder="https://…"
                    onChange={(e) => updatePrice({ sourceUrl: e.target.value })}
                  />
                </label>
                <div className="admin-two">
                  <label>
                    Ngày đối chiếu giá
                    <input
                      required
                      type="date"
                      max={catalogToday()}
                      value={form.referencePrice.checkedAt}
                      onChange={(e) =>
                        updatePrice({ checkedAt: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Cần kiểm tra lại vào
                    <input
                      required
                      type="date"
                      min={form.referencePrice.checkedAt}
                      value={form.referencePrice.reviewAfter}
                      onChange={(e) =>
                        updatePrice({ reviewAfter: e.target.value })
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <p>Khách sẽ thấy chưa có giá. App không tự coi là miễn phí.</p>
            )}
          </fieldset>
          {preview && (
            <section
              ref={previewPanel}
              className="admin-preview"
              aria-label="Xem trước nội dung"
            >
              <span className="admin-eyebrow">KHÁCH SẼ THẤY</span>
              <h2>{form.name}</h2>
              <p>{form.description}</p>
              <p>{form.locationQuery}</p>
              <p>{form.openingHoursNote || 'Chưa xác minh giờ mở cửa'}</p>
              <PlacePlanning
                place={{
                  ...form,
                  id: saved?.id ?? '',
                  revision: saved?.revision ?? 0,
                  destinationName: '',
                  slug: '',
                  subtitle: '',
                  imageUrl: '',
                  durationLabel: '',
                  travelLabel: '',
                  bestTimeLabel: '',
                  tip: '',
                  highlights: [],
                  imageCredit: '',
                  planning: {
                    durationMinutes: form.durationMinutes,
                    locationQuery: form.locationQuery,
                    costNote: '',
                    priceOptions: [],
                  },
                }}
              />
              <p>
                Xuất bản sẽ cập nhật nội dung công khai và dữ liệu dùng cho lịch
                mới. Chuyến đã lưu giữ nguyên.
              </p>
              <button
                type="button"
                className="journey-primary"
                disabled={busy}
                onClick={() => void save('published')}
              >
                {busy
                  ? 'Đang lưu…'
                  : saved?.publicationStatus === 'published'
                    ? 'Cập nhật nội dung công khai'
                    : 'Đăng địa điểm'}
              </button>
            </section>
          )}
          <div className="admin-save-bar">
            <button
              type="button"
              className="journey-outline"
              disabled={busy}
              onClick={() =>
                void save(
                  saved?.publicationStatus === 'published'
                    ? 'published'
                    : 'draft',
                )
              }
            >
              {saved?.publicationStatus === 'published'
                ? 'Lưu thay đổi'
                : 'Lưu bản nháp'}
            </button>
            <button type="submit" className="journey-primary" disabled={busy}>
              Xem trước để xuất bản
            </button>
            {saved?.publicationStatus === 'published' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      'Ngừng hiển thị địa điểm này cho khách mới? Lịch đã lưu vẫn giữ nguyên.',
                    )
                  )
                    void save('archived');
                }}
              >
                Ngừng hiển thị
              </button>
            )}
          </div>
          {!!history.length && (
            <details className="admin-history">
              <summary>Lịch sử lưu gần đây</summary>
              {history.map((h, i) => (
                <p key={i}>
                  Phiên bản {h.entityRevision} ·{' '}
                  {new Date(h.occurredAt).toLocaleString('vi-VN')} ·{' '}
                  {h.action === 'catalog.publication_changed'
                    ? 'Đổi trạng thái hiển thị'
                    : 'Lưu nội dung'}
                </p>
              ))}
            </details>
          )}
        </form>
      )}
    </section>
  );
}
