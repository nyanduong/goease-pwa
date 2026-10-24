import { AdminPageHeader } from './admin-visuals';
import {
  AdminFieldEvidence,
  type SourceEvidence,
} from './admin-field-evidence';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  adminPlaceInputSchema,
  catalogToday,
  type AdminPlaceDto,
  type AdminOverview,
  type AdminPlaceInput,
  type DestinationDto,
  type ReferencePrice,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { PlacePlanning } from './place-planning';
import { SourceCredit } from './source-credit';
import { AdminBatch } from './admin-batch';
import { AdminPlaceTable } from './admin-place-table';
import { AdminMap } from './admin-map';
import { AdminPlaceTools } from './admin-place-tools';
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
  inclusions: '',
  exclusions: '',
  sourceUrl: '',
  checkedAt: catalogToday(),
  reviewAfter: catalogToday(),
});
const formFromDto = ({
  id,
  revision,
  updatedAt,
  source,
  imageUrl,
  imageCredit,
  ...input
}: AdminPlaceDto) => {
  void id;
  void revision;
  void updatedAt;
  void source;
  void imageUrl;
  void imageCredit;
  return input;
};
export function AdminCatalog({
  destinations,
  openPlace,
  scope = '',
  locationKey = '',
}: {
  destinations: DestinationDto[];
  scope?: string;
  locationKey?: string;
  openPlace?: { id: string; request: number } | null;
}) {
  const [selected, setSelected] = useState<AdminPlaceDto[]>([]);
  const [items, setItems] = useState<AdminPlaceDto[]>([]);
  const [importing, setImporting] = useState(false);
  const [category, setCategory] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [sort, setSort] = useState('updated');
  const [mapView, setMapView] = useState(false);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [autosave, setAutosave] = useState(false);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState<AdminPlaceInput | null>(null);
  const [saved, setSaved] = useState<AdminPlaceDto | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    AdminPlaceDto[]
  >([]);
  const [duplicateCheck, setDuplicateCheck] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sourceEvidence, setSourceEvidence] = useState<SourceEvidence>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <small className="admin-field-error" role="alert">
        {fieldErrors[key]}
      </small>
    ) : null;
  const [success, setSuccess] = useState('');
  const key = useRef({ payload: '', key: '' });
  const previewPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(locationKey.split('?')[1] ?? '');
    if (!locationKey.startsWith('#places')) return;
    if (
      form &&
      (!saved || JSON.stringify(form) !== JSON.stringify(formFromDto(saved))) &&
      !confirm('Đổi trang danh mục? Thay đổi chưa lưu sẽ bị bỏ.')
    )
      return;
    setForm(null);
    setImporting(false);
    setQ(params.get('q') ?? '');
    setStatus(params.get('status') ?? 'all');
    setQualityFilter(params.get('quality') ?? 'all');
    setMapView(params.get('view') === 'map');
    setOffset(0);
    if (params.get('import')) {
      setForm(null);
      setImporting(true);
    }
    if (params.get('create') && destinations.length) {
      setSaved(null);
      setSourceEvidence(null);
      setHistory([]);
      setImporting(false);
      setForm(newPlace(scope || destinations[0]!.id));
    }
  }, [locationKey]);
  useEffect(() => {
    setOffset(0);
  }, [scope]);
  useEffect(() => {
    if (
      !autosave ||
      !saved ||
      saved.publicationStatus !== 'draft' ||
      !form ||
      busy ||
      error ||
      JSON.stringify(form) === JSON.stringify(formFromDto(saved)) ||
      !adminPlaceInputSchema.safeParse(form).success
    )
      return;
    const timer = setTimeout(() => {
      void save('draft');
    }, 2000);
    return () => clearTimeout(timer);
  }, [form, saved, autosave, busy, error]);
  useEffect(() => {
    if (
      !form ||
      (saved && JSON.stringify(form) === JSON.stringify(formFromDto(saved)))
    )
      return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [form, saved]);
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
    void api<{ items: AdminPlaceDto[]; hasMore: boolean; total: number }>(
      `/admin/places?${new URLSearchParams({ q, status, category, source: sourceFilter, quality: qualityFilter, sort, ...(scope ? { destinationId: scope } : {}), offset: String(offset) })}`,
    )
      .then((v) => {
        if (active) {
          setItems(v.items);
          setHasMore(v.hasMore);
          setTotal(v.total);
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
  }, [
    q,
    status,
    category,
    sourceFilter,
    qualityFilter,
    sort,
    scope,
    offset,
    retry,
  ]);
  useEffect(() => {
    setDuplicateCandidates([]);
    setDuplicateCheck('');
    if (saved || !form || form.name.trim().length < 3) return;
    let active = true;
    const timer = setTimeout(() => {
      setDuplicateCheck('Đang kiểm tra tên tương tự…');
      void api<{ items: AdminPlaceDto[] }>(
        `/admin/places?${new URLSearchParams({ q: form.name.trim().slice(0, 100), destinationId: form.destinationId, status: 'all' })}`,
      )
        .then((v) => {
          if (active) {
            setDuplicateCandidates(v.items);
            setDuplicateCheck(
              v.items.length
                ? 'Có địa điểm cùng tên hoặc chứa tên này. Đối chiếu địa chỉ trước khi tạo thêm.'
                : 'Chưa thấy tên này trong danh mục khu vực. Đây không phải kết luận không trùng.',
            );
          }
        })
        .catch(() => {
          if (active)
            setDuplicateCheck(
              'Chưa kiểm tra được tên trùng. Hãy tìm trong danh mục trước khi tạo thêm.',
            );
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form?.name, form?.destinationId, saved]);
  useEffect(() => {
    let active = true;
    setOverview(null);
    setOverviewError('');
    void api<AdminOverview>(
      `/admin/catalog/overview${scope ? `?destinationId=${scope}` : ''}`,
    )
      .then((v) => {
        if (active) setOverview(v);
      })
      .catch(() => {
        if (active) setOverviewError('Chưa tải được thống kê khu vực.');
      });
    return () => {
      active = false;
    };
  }, [scope, retry]);
  const update = (patch: Partial<AdminPlaceInput>) => {
    setForm((f) =>
      f
        ? {
            ...f,
            ...(patch.locationQuery !== undefined &&
            patch.locationQuery !== f.locationQuery
              ? { mapLocation: null }
              : {}),
            ...patch,
          }
        : f,
    );
    setError('');
    setSuccess('');
    setPreview(false);
    setFieldErrors({});
  };
  const updatePrice = (patch: Partial<ReferencePrice>) =>
    update({ referencePrice: { ...form!.referencePrice!, ...patch } });
  async function open(id: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const value = await api<{
        place: AdminPlaceDto;
        history: HistoryItem[];
        sourceEvidence: SourceEvidence;
      }>(`/admin/places/${id}`);
      setSaved(value.place);
      setForm(formFromDto(value.place));
      setHistory(value.history);
      setSourceEvidence(value.sourceEvidence);
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
      setFieldErrors(
        Object.fromEntries(
          checked.error.issues.map((i) => [
            String(i.path[0] ?? 'referencePrice'),
            i.code === 'custom'
              ? i.message
              : 'Thông tin chưa hợp lệ. Kiểm tra nội dung và giới hạn của trường này.',
          ]),
        ),
      );
      setError('Chưa thể lưu. Kiểm tra các trường được đánh dấu bên dưới.');
      return;
    }
    setFieldErrors({});
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
      <AdminPageHeader
        title={
          form
            ? saved
              ? 'Chỉnh sửa địa điểm'
              : 'Thêm địa điểm / quán ăn'
            : 'Quản lý địa điểm'
        }
        description={
          form
            ? 'Cập nhật thông tin địa điểm để khách hàng nhận được lịch trình và dự toán chính xác hơn.'
            : 'Xem, chỉnh sửa và quản lý địa điểm, quán ăn, điểm tham quan trên GoEase.'
        }
        illustrated={false}
        actions={
          !form && !importing ? (
            <div className="admin-actions admin-catalog-actions">
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
                  setSourceEvidence(null);
                  setForm(
                    newPlace(
                      (scope ||
                        destinations.find((d) => d.name === 'Hội An')?.id) ??
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
          ) : undefined
        }
        region={
          destinations.find((d) => d.id === scope)?.name ?? 'Tất cả khu vực'
        }
      />

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
            key={scope}
            destinationId={scope}
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
          {overviewError && (
            <p role="alert">
              {overviewError}{' '}
              <button onClick={() => setRetry((v) => v + 1)}>
                Tải lại thống kê
              </button>
            </p>
          )}
          {overview && (
            <div className="admin-place-statistics">
              {[
                {
                  label: 'Tổng địa điểm',
                  value: overview.total,
                  status: 'all',
                  tone: 'blue',
                },
                {
                  label: 'Nháp',
                  value: overview.draft,
                  status: 'draft',
                  tone: 'amber',
                },
                {
                  label: 'Cần kiểm tra',
                  value: overview.needsAttention,
                  status: 'all',
                  tone: 'orange',
                },
                {
                  label: 'Đã xuất bản',
                  value: overview.published,
                  status: 'published',
                  tone: 'green',
                },
                {
                  label: 'Đã lưu trữ',
                  value: overview.archived,
                  status: 'archived',
                  tone: 'gray',
                },
              ].map((k) => (
                <button
                  className={`admin-place-stat ${k.tone}`}
                  key={k.label}
                  onClick={() => {
                    if (k.label === 'Cần kiểm tra') location.hash = 'work';
                    else {
                      setStatus(k.status);
                      setOffset(0);
                    }
                  }}
                >
                  <span>{k.label}</span>
                  <strong>{k.value}</strong>
                  <small>
                    {k.label === 'Cần kiểm tra'
                      ? 'Mở việc cần làm'
                      : 'Xem danh sách →'}
                  </small>
                </button>
              ))}
            </div>
          )}
          <div className="admin-filter-layout">
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
            <div className="admin-advanced-filters">
              <label>
                Nhóm địa điểm
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">Tất cả loại</option>
                  <option value="food">Ăn uống</option>
                  <option value="culture">Văn hóa</option>
                  <option value="nature">Thiên nhiên</option>
                </select>
              </label>
              <label>
                Nguồn
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">Tất cả nguồn</option>
                  <option value="geoapify">Geoapify / OSM</option>
                  <option value="manual">Biên tập</option>
                </select>
              </label>
              <label>
                Chất lượng
                <select
                  value={qualityFilter}
                  onChange={(e) => {
                    setQualityFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">Tất cả chất lượng</option>
                  <option value="price">Giá cần bổ sung</option>
                  <option value="hours">Thiếu giờ mở cửa</option>
                  <option value="location">Thiếu tọa độ</option>
                </select>
              </label>
              <label>
                Sắp xếp
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="updated">Cập nhật mới nhất</option>
                  <option value="oldest">Cũ nhất trước</option>
                  <option value="name">Tên A–Z</option>
                </select>
              </label>
              <button
                aria-pressed={mapView}
                onClick={() => setMapView((v) => !v)}
              >
                {mapView ? 'Bảng danh sách' : 'Xem bản đồ'}
              </button>
            </div>
          </div>
          <p className="admin-list-count">
            {total} địa điểm · Trang {Math.floor(offset / 20) + 1}
            {mapView
              ? ' · Bản đồ hiển thị các kết quả trên trang hiện tại'
              : ''}
          </p>
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
          ) : mapView ? (
            <AdminMap places={items} onOpen={(id) => void open(id)} />
          ) : (
            <div className="admin-catalog-columns">
              <div>
                {' '}
                <AdminPlaceTable
                  items={items}
                  selected={selected}
                  busy={busy}
                  onOpen={(id) => void open(id)}
                  onSelect={(p, checked) =>
                    setSelected((v) =>
                      checked ? [...v, p] : v.filter((s) => s.id !== p.id),
                    )
                  }
                />
              </div>
              <aside className="admin-catalog-map-summary">
                <section className="admin-panel">
                  <div className="admin-panel-title">
                    <h2>Bản đồ địa điểm</h2>
                    <button type="button" onClick={() => setMapView(true)}>
                      Mở rộng ↗
                    </button>
                  </div>
                  <AdminMap places={items} onOpen={(id) => void open(id)} />
                </section>
                <section className="admin-panel">
                  <h2>Nhóm địa điểm</h2>
                  <p>Trong trang kết quả hiện tại</p>
                  {[
                    { code: 'food', label: 'Ăn uống' },
                    { code: 'culture', label: 'Văn hóa' },
                    { code: 'nature', label: 'Thiên nhiên' },
                  ].map((c) => (
                    <button
                      className="admin-category-stat"
                      key={c.code}
                      onClick={() => {
                        setCategory(c.code);
                        setOffset(0);
                      }}
                    >
                      <span>{c.label}</span>
                      <strong>
                        {items.filter((p) => p.category === c.code).length}
                      </strong>
                      <progress
                        max={items.length}
                        value={
                          items.filter((p) => p.category === c.code).length
                        }
                      />
                    </button>
                  ))}
                </section>
              </aside>
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
          {saved?.publicationStatus === 'draft' && (
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={autosave}
                onChange={(e) => setAutosave(e.target.checked)}
              />
              Tự lưu bản nháp hợp lệ sau 2 giây
            </label>
          )}
          <div className="admin-editor-grid">
            <nav className="admin-editor-index" aria-label="Các phần chỉnh sửa">
              {[
                ['basic', 'Thông tin cơ bản'],
                ['category', 'Danh mục'],
                ['description', 'Mô tả & giới thiệu'],
                ['location', 'Địa chỉ & bản đồ'],
                ['duration', 'Thời gian gợi ý'],
                ['hours', 'Giờ mở cửa'],
                ['price', 'Giá & điều kiện'],
                ['images', 'Ảnh địa điểm'],
                ['evidence', 'Nguồn dữ liệu'],
                ['notes', 'Ghi chú vận hành'],
              ].map(([id, label], i) => (
                <button
                  type="button"
                  key={id}
                  onClick={() =>
                    document
                      .getElementById(`admin-section-${id}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <span>{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            <div>
              <fieldset
                disabled={busy}
                className="admin-form-fields"
                id="admin-section-basic"
              >
                <legend>Thông tin khách sẽ thấy</legend>
                <div className="admin-two">
                  <label>
                    Điểm đến
                    <select
                      aria-label="Điểm đến"
                      disabled={!!saved}
                      value={form.destinationId}
                      onChange={(e) =>
                        update({ destinationId: e.target.value })
                      }
                    >
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label id="admin-section-category">
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
                      <option value="food_idea">
                        Gợi ý món ăn, chưa có quán
                      </option>
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
                  {fieldError('name')}
                </label>
                {!saved && duplicateCheck && (
                  <div className="admin-duplicate-check" role="status">
                    <p>{duplicateCheck}</p>
                    {duplicateCandidates.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          if (
                            confirm(
                              'Mở địa điểm có sẵn? Nội dung mới chưa lưu sẽ bị bỏ.',
                            )
                          )
                            void open(p.id);
                        }}
                      >
                        {p.name} · {p.locationQuery}
                      </button>
                    ))}
                  </div>
                )}
                <label id="admin-section-description">
                  Giới thiệu ngắn
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={form.description}
                    onChange={(e) => update({ description: e.target.value })}
                  />
                  {fieldError('description')}
                </label>
                <label id="admin-section-location">
                  Địa chỉ / vị trí tìm trên bản đồ
                  <input
                    required
                    maxLength={200}
                    value={form.locationQuery}
                    placeholder="Tên cơ sở, số nhà, đường, khu vực"
                    onChange={(e) => update({ locationQuery: e.target.value })}
                  />
                  {fieldError('locationQuery')}
                </label>
                <div className="admin-two">
                  <label id="admin-section-duration">
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
                            category: e.target
                              .value as AdminPlaceInput['category'],
                          })
                        }
                      >
                        <option value="culture">Văn hóa</option>
                        <option value="nature">Thiên nhiên</option>
                      </select>
                    </label>
                  )}
                </div>
                <label id="admin-section-hours">
                  Giờ mở cửa (nếu đã kiểm tra)
                  <input
                    maxLength={400}
                    value={form.openingHoursNote}
                    placeholder="Để trống nếu chưa rõ"
                    onChange={(e) =>
                      update({ openingHoursNote: e.target.value })
                    }
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
                  {fieldError('sourceUrl')}
                </label>
              </fieldset>
              <fieldset disabled={busy} className="admin-form-fields">
                <legend id="admin-section-price">
                  Giá cho dự toán tự động
                </legend>
                {fieldError('referencePrice')}
                <p>
                  Chọn một mức tham khảo áp dụng chung cho nhóm khách. Giá trẻ
                  em, ưu đãi có điều kiện riêng không tự suy ra. Thiếu giá hoặc
                  điều kiện thì chỉ lưu bản nháp.
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
                      Áp dụng cho nhóm tối thiểu (người)
                      <input
                        required
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={form.referencePrice.minTravelers ?? 1}
                        onChange={(e) =>
                          updatePrice({ minTravelers: Number(e.target.value) })
                        }
                      />
                    </label>
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
                        onChange={(e) =>
                          updatePrice({ sourceUrl: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Bao gồm trong giá
                      <input
                        required
                        maxLength={500}
                        value={form.referencePrice.inclusions ?? ''}
                        onChange={(e) =>
                          updatePrice({ inclusions: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Không bao gồm trong giá
                      <input
                        required
                        maxLength={500}
                        placeholder="Ghi Không có nếu đã xác minh không có khoản loại trừ"
                        value={form.referencePrice.exclusions ?? ''}
                        onChange={(e) =>
                          updatePrice({ exclusions: e.target.value })
                        }
                      />
                    </label>
                    {form.category !== 'food' && (
                      <>
                        <label className="admin-checkbox">
                          <input
                            type="checkbox"
                            checked={!!form.referencePrice.bundle}
                            onChange={(e) => {
                              const { bundle: _old, ...price } =
                                form.referencePrice!;
                              void _old;
                              update({
                                referencePrice: e.target.checked
                                  ? {
                                      ...price,
                                      bundle: {
                                        code: '',
                                        validDays: 1,
                                        maxEntries: 1,
                                      },
                                    }
                                  : price,
                              });
                            }}
                          />
                          Dùng chung vé gói với các điểm khác
                        </label>
                        {form.referencePrice.bundle && (
                          <>
                            <p>
                              Chỉ gán cùng mã cho các điểm thực sự được vé bao
                              gồm, cùng giá và điều kiện. Số lượt tính mỗi lần
                              vào cửa; không dùng cho gói có hạn mức riêng từng
                              nhóm di tích hoặc thời hạn theo giờ chưa được hỗ
                              trợ.
                            </p>
                            <label>
                              Mã vé gói
                              <input
                                required
                                pattern="[a-z0-9-]{3,80}"
                                value={form.referencePrice.bundle.code}
                                onChange={(e) =>
                                  updatePrice({
                                    bundle: {
                                      ...form.referencePrice!.bundle!,
                                      code: e.target.value,
                                    },
                                  })
                                }
                              />
                            </label>
                            <label>
                              Hiệu lực (ngày, tính cả ngày đầu)
                              <input
                                required
                                type="number"
                                min={1}
                                max={31}
                                value={form.referencePrice.bundle.validDays}
                                onChange={(e) =>
                                  updatePrice({
                                    bundle: {
                                      ...form.referencePrice!.bundle!,
                                      validDays: Number(e.target.value),
                                    },
                                  })
                                }
                              />
                            </label>
                            <label>
                              Số lượt vào cửa trong một gói
                              <input
                                required
                                type="number"
                                min={1}
                                max={300}
                                value={form.referencePrice.bundle.maxEntries}
                                onChange={(e) =>
                                  updatePrice({
                                    bundle: {
                                      ...form.referencePrice!.bundle!,
                                      maxEntries: Number(e.target.value),
                                    },
                                  })
                                }
                              />
                            </label>
                          </>
                        )}
                      </>
                    )}
                    <div className="admin-two">
                      <label>
                        Ngày đối chiếu giá
                        <input
                          required
                          type="date"
                          max={catalogToday()}
                          value={form.referencePrice.checkedAt}
                          onInput={(e) =>
                            updatePrice({ checkedAt: e.currentTarget.value })
                          }
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
                          onInput={(e) =>
                            updatePrice({ reviewAfter: e.currentTarget.value })
                          }
                          onChange={(e) =>
                            updatePrice({ reviewAfter: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <p>
                    Chỉ lưu bản nháp. Cần giá và điều kiện đầy đủ trước khi xuất
                    bản.
                  </p>
                )}
              </fieldset>
            </div>
            <aside>
              <section className="admin-panel" id="admin-section-evidence">
                <AdminFieldEvidence
                  form={form}
                  evidence={saved ? sourceEvidence : null}
                />
              </section>
              <AdminPlaceTools
                form={form}
                saved={saved}
                update={update}
                busy={busy}
                onRestore={() => {
                  if (saved) void open(saved.id);
                  setRetry((v) => v + 1);
                }}
              />
            </aside>
          </div>
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
                  ...(Object.fromEntries(
                    Object.entries(form).filter(
                      ([key]) => key !== 'mapLocation',
                    ),
                  ) as Omit<AdminPlaceInput, 'mapLocation'>),
                  ...(form.mapLocation
                    ? { mapLocation: form.mapLocation }
                    : {}),
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
