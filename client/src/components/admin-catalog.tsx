import { AdminPageHeader } from './admin-visuals';
import {
  AdminFieldEvidence,
  type SourceEvidence,
} from './admin-field-evidence';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  adminPlaceInputSchema,
  adminPlaceQuerySchema,
  catalogToday,
  catalogEditableFields,
  catalogCapabilities,
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
import { AdminCatalogMap } from './admin-catalog-map';
import { AdminPlaceTools } from './admin-place-tools';
import { AdminPlaceSidebar, type PlaceEditorTab } from './admin-place-sidebar';
import { AdminWikimediaImages } from './admin-wikimedia-images';
import { AdminImageGallery } from './admin-image-gallery';
import { CheckCircle2, Info, ShieldCheck } from 'lucide-react';
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
  proposalRevision,
  publicRevision,
  capabilities,
  photoSearch,
  fieldProvenance,
  ...input
}: AdminPlaceDto) => {
  void id;
  void revision;
  void updatedAt;
  void source;
  void imageUrl;
  void imageCredit;
  void proposalRevision;
  void publicRevision;
  void capabilities;
  void photoSearch;
  void fieldProvenance;
  return input;
};
export function AdminCatalog({
  destinations,
  openPlace,
  scope = '',
  locationKey = '',
  refreshKey = 0,
  adminName = 'Quản trị viên',
}: {
  destinations: DestinationDto[];
  adminName?: string;
  scope?: string;
  locationKey?: string;
  refreshKey?: number;
  openPlace?: { id: string; request: number } | null;
}) {
  const [selected, setSelected] = useState<AdminPlaceDto[]>([]);
  const [allMatching, setAllMatching] = useState(false);
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
  const [editorTab, setEditorTab] = useState<PlaceEditorTab>('overview');
  const [photoCount, setPhotoCount] = useState(0);
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
  const [publicPlace, setPublicPlace] = useState<AdminPlaceDto | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    AdminPlaceDto[]
  >([]);
  const [duplicateCheck, setDuplicateCheck] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    setAllMatching(false);
    setSelected([]);
  }, [q, status, category, sourceFilter, qualityFilter, sort, scope]);
  const filter = adminPlaceQuerySchema.parse({
    q,
    status,
    category,
    source: sourceFilter,
    quality: qualityFilter,
    sort,
    ...(scope ? { destinationId: scope } : {}),
  });
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
    if (params.has('destinationId')) {
      setCategory('all');
      setSourceFilter('all');
      setSelected([]);
      setAllMatching(false);
    }
    setStatus(
      ['all', 'draft', 'published', 'archived'].includes(
        params.get('status') ?? '',
      )
        ? params.get('status')!
        : 'all',
    );
    setQualityFilter(
      ['all', 'price', 'hours', 'location'].includes(
        params.get('quality') ?? '',
      )
        ? params.get('quality')!
        : 'all',
    );
    setMapView(params.get('view') === 'map');
    setOffset(0);
    if (params.get('import')) {
      setForm(null);
      setImporting(true);
    }
    if (params.get('create') && destinations.length) {
      setSaved(null);
      setPublicPlace(null);
      setSourceEvidence(null);
      setHistory([]);
      setImporting(false);
      setEditorTab('overview');
      setForm(newPlace(scope));
    }
  }, [locationKey]);
  useEffect(() => {
    setOffset(0);
    setSelected([]);
    setSuccess('');
    setError('');
    setImporting(false);
  }, [scope]);
  useEffect(() => {
    setRetry((v) => v + 1);
  }, [refreshKey]);
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
        publicPlace?: AdminPlaceDto | null;
        history: HistoryItem[];
        sourceEvidence: SourceEvidence;
      }>(`/admin/places/${id}`);
      setEditorTab('overview');
      setSaved(value.place);
      setPublicPlace(value.publicPlace ?? null);
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
  function showField(field: string) {
    const tab: PlaceEditorTab =
      field === 'images'
        ? 'photos'
        : ['referencePrice', 'openingHoursNote'].includes(field)
          ? 'practical'
          : field === 'sourceUrl'
            ? 'sources'
            : 'overview';
    setEditorTab(tab);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        '[data-editor-field="' + field + '"]',
      );
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.querySelector<HTMLElement>('input,textarea,select,button')?.focus({
        preventScroll: true,
      });
    });
  }
  const isDirty =
    !!form &&
    (!saved || JSON.stringify(form) !== JSON.stringify(formFromDto(saved)));
  const destinationName =
    destinations.find((d) => d.id === form?.destinationId)?.name ??
    'Chưa chọn tỉnh / thành phố';
  async function save(
    publicationStatus: AdminPlaceInput['publicationStatus'],
    intent: 'save' | 'publish' = 'save',
  ) {
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
      showField(String(checked.error.issues[0]?.path[0] ?? 'description'));
      setError('Chưa thể lưu. Kiểm tra các trường được đánh dấu bên dưới.');
      return;
    }
    setFieldErrors({});
    const payload = JSON.stringify({
      place: checked.data,
      intent,
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
      if (intent === 'publish')
        setPublicPlace(
          value.place.publicationStatus === 'published' ? value.place : null,
        );
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
        intent === 'publish'
          ? 'Đã áp dụng bản công khai. Khả năng khám phá, xếp lịch và ngân sách được kiểm tra riêng.'
          : publicationStatus === 'archived'
            ? 'Đã ngừng hiển thị. Lịch khách đã lưu vẫn được giữ.'
            : 'Đã lưu đề xuất. Bản khách đang xem được giữ nguyên; xuất bản là bước riêng.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được. Hãy thử lại.');
      if (e instanceof ApiFailure && e.status === 403) setItems([]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`admin-catalog${form ? ' is-editing' : ''}`}>
      {!form && (
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
                    setPublicPlace(null);
                    setSourceEvidence(null);
                    setEditorTab('overview');
                    setForm(newPlace(scope));
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
              ? ' · Bản đồ truy vấn toàn bộ kết quả theo vùng đang xem'
              : ''}
          </p>
          <AdminBatch
            selected={selected}
            filter={filter}
            total={total}
            allMatching={allMatching}
            onAllMatching={setAllMatching}
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
              Chọn toàn bộ trang hiện tại
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
            <div className="admin-empty">
              <h2>Không có địa điểm khớp bộ lọc</h2>
              <p>
                Thử bớt điều kiện hoặc chọn một phạm vi khác. Kết quả rỗng không
                có nghĩa nguồn đã đóng cửa.
              </p>
              <button
                onClick={() => {
                  setQ('');
                  setStatus('all');
                  setCategory('all');
                  setSourceFilter('all');
                  setQualityFilter('all');
                  setOffset(0);
                }}
              >
                Xóa bộ lọc tìm kiếm
              </button>
              <a href="#automatic" className="journey-primary">
                Thiết lập đợt thu thập
              </a>
            </div>
          ) : mapView ? (
            <AdminCatalogMap filter={filter} onOpen={(id) => void open(id)} />
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
                  <AdminCatalogMap
                    filter={filter}
                    onOpen={(id) => void open(id)}
                  />
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
          className="place-editor-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            const checked = adminPlaceInputSchema.safeParse(form);
            if (!checked.success) {
              setFieldErrors(
                Object.fromEntries(
                  checked.error.issues.map((i) => [
                    String(i.path[0] ?? 'description'),
                    i.code === 'custom'
                      ? i.message
                      : 'Kiểm tra thông tin của trường này.',
                  ]),
                ),
              );
              showField(
                String(checked.error.issues[0]?.path[0] ?? 'description'),
              );
              setError(
                'Điền đủ tên, mô tả, vị trí, nguồn và thông tin giá nếu bật.',
              );
              return;
            }
            setPreview(true);
          }}
        >
          <div className="place-editor-masthead">
            <strong>GoEase</strong>
            <span>
              Địa điểm <i>/</i> {destinationName} <i>/</i> Chỉnh sửa
            </span>
            <span className="place-editor-account">
              <ShieldCheck size={18} />
              {adminName}
            </span>
          </div>
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
          <header className="place-editor-heading">
            <div>
              <div className="place-title-row">
                <h1>{form.name || 'Thêm địa điểm mới'}</h1>
                <span className="place-status-badge">
                  {statusText[saved?.publicationStatus ?? 'draft']}
                </span>
              </div>
              <p>
                {destinationName} ·{' '}
                {form.venueType === 'place'
                  ? 'Điểm tham quan'
                  : form.venueType === 'restaurant'
                    ? 'Quán ăn cụ thể'
                    : 'Gợi ý món ăn'}{' '}
                ·{' '}
                {form.category === 'culture'
                  ? 'Văn hóa'
                  : form.category === 'nature'
                    ? 'Thiên nhiên'
                    : 'Ăn uống'}
              </p>
            </div>
            <div className="place-editor-save-state">
              <span>
                {saved?.publicRevision
                  ? 'Đã có bản công khai'
                  : 'Chưa xuất bản'}
              </span>
              <span>
                <CheckCircle2 size={17} />
                {busy
                  ? 'Đang lưu…'
                  : isDirty
                    ? 'Có thay đổi chưa lưu'
                    : 'Đã lưu đề xuất'}
              </span>
            </div>
          </header>
          <div className="place-editor-layout">
            <div className="place-editor-main">
              <div
                className="place-editor-tabs"
                role="tablist"
                aria-label="Các phần chỉnh sửa"
              >
                {(
                  [
                    ['overview', 'Tổng quan'],
                    ['photos', 'Ảnh địa điểm'],
                    ['practical', 'Giá & giờ mở cửa'],
                    ['sources', 'Nguồn & lịch sử'],
                  ] as const
                ).map(([id, label], index, tabs) => (
                  <button
                    type="button"
                    role="tab"
                    id={'place-tab-' + id}
                    aria-controls={'place-panel-' + id}
                    aria-selected={editorTab === id}
                    tabIndex={editorTab === id ? 0 : -1}
                    key={id}
                    onClick={() => setEditorTab(id)}
                    onKeyDown={(e) => {
                      const delta =
                        e.key === 'ArrowRight'
                          ? 1
                          : e.key === 'ArrowLeft'
                            ? -1
                            : 0;
                      if (delta || e.key === 'Home' || e.key === 'End') {
                        e.preventDefault();
                        const target =
                          tabs[
                            e.key === 'Home'
                              ? 0
                              : e.key === 'End'
                                ? tabs.length - 1
                                : (index + delta + tabs.length) % tabs.length
                          ]![0];
                        setEditorTab(target);
                        document.getElementById('place-tab-' + target)?.focus();
                      }
                    }}
                  >
                    {label}
                    {id === 'photos' && <span>{photoCount}</span>}
                  </button>
                ))}
              </div>
              <section
                className="place-editor-photos"
                hidden={!['overview', 'photos'].includes(editorTab)}
                data-editor-field="images"
              >
                <AdminWikimediaImages
                  id={saved?.id}
                  form={form}
                  update={update}
                  compact={editorTab === 'overview'}
                  onViewAll={() => setEditorTab('photos')}
                  onCount={setPhotoCount}
                  disabled={busy}
                />
                {fieldError('images')}
                <fieldset
                  className="place-gallery-controls"
                  disabled={busy}
                  hidden={editorTab !== 'photos'}
                >
                  <AdminImageGallery form={form} update={update} />
                </fieldset>
              </section>
              <div
                role="tabpanel"
                id="place-panel-overview"
                aria-labelledby="place-tab-overview"
                hidden={editorTab !== 'overview'}
              >
                <fieldset
                  disabled={busy}
                  className="admin-form-fields"
                  id="admin-section-basic"
                >
                  <legend>
                    <Info size={21} />
                    Thông tin cơ bản
                  </legend>
                  <p className="place-card-description">
                    Nội dung khách sẽ thấy sau khi xuất bản.
                  </p>
                  <label data-editor-field="name">
                    Tên địa điểm / quán ăn
                    <input
                      required
                      maxLength={120}
                      value={form.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                    {fieldError('name')}
                  </label>
                  <div className="admin-two">
                    <label data-editor-field="destinationId">
                      Điểm đến
                      <select
                        required
                        aria-label="Điểm đến"
                        disabled={!!saved}
                        value={form.destinationId}
                        onChange={(e) =>
                          update({ destinationId: e.target.value })
                        }
                      >
                        <option value="">Chọn điểm đến cụ thể</option>
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
                            category:
                              venueType === 'place' ? 'culture' : 'food',
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
                  <label
                    data-editor-field="description"
                    id="admin-section-description"
                  >
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
                  <label
                    data-editor-field="locationQuery"
                    id="admin-section-location"
                  >
                    Địa chỉ / vị trí tìm trên bản đồ
                    <input
                      required
                      maxLength={200}
                      value={form.locationQuery}
                      placeholder="Tên cơ sở, số nhà, đường, khu vực"
                      onChange={(e) =>
                        update({ locationQuery: e.target.value })
                      }
                    />
                    {fieldError('locationQuery')}
                  </label>
                  <div className="admin-two">
                    <label
                      data-editor-field="durationMinutes"
                      id="admin-section-duration"
                    >
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
                </fieldset>
              </div>
              <div
                role="tabpanel"
                id="place-panel-photos"
                aria-labelledby="place-tab-photos"
                hidden={editorTab !== 'photos'}
              >
                <p className="place-tab-help">
                  Ảnh được chọn thuộc đề xuất. Lưu đề xuất trước khi xuất bản.
                </p>
              </div>
              <div
                role="tabpanel"
                id="place-panel-practical"
                aria-labelledby="place-tab-practical"
                hidden={editorTab !== 'practical'}
              >
                <fieldset disabled={busy} className="admin-form-fields">
                  <legend>Giờ mở cửa</legend>{' '}
                  <label
                    data-editor-field="openingHoursNote"
                    id="admin-section-hours"
                  >
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
                </fieldset>
                <fieldset
                  disabled={busy}
                  className="admin-form-fields"
                  data-editor-field="referencePrice"
                >
                  <legend id="admin-section-price">
                    Giá cho dự toán tự động
                  </legend>
                  {fieldError('referencePrice')}
                  <p>
                    Giá được dùng riêng cho dự toán và Goe. Thiếu giá vẫn có thể
                    xuất bản để khám phá nếu đủ điều kiện; không tự suy ra miễn
                    phí.
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
                          onChange={(e) =>
                            updatePrice({ label: e.target.value })
                          }
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
                                basis: e.target
                                  .value as ReferencePrice['basis'],
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
                            updatePrice({
                              minTravelers: Number(e.target.value),
                            })
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
                            updatePrice({
                              maxTravelers: Number(e.target.value),
                            })
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
                                vào cửa; không dùng cho gói có hạn mức riêng
                                từng nhóm di tích hoặc thời hạn theo giờ chưa
                                được hỗ trợ.
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
                              updatePrice({
                                reviewAfter: e.currentTarget.value,
                              })
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
                      Chưa có căn cứ giá. Địa điểm có thể phục vụ khám phá; Goe
                      và ngân sách vẫn cần dữ liệu đủ điều kiện.
                    </p>
                  )}
                </fieldset>
              </div>
              <div
                role="tabpanel"
                id="place-panel-sources"
                aria-labelledby="place-tab-sources"
                hidden={editorTab !== 'sources'}
              >
                <section className="admin-panel" id="admin-section-evidence">
                  <h2>Nguồn & lịch sử</h2>
                  {form && scope !== form.destinationId && (
                    <p className="admin-soft-notice">
                      Đang sửa địa điểm thuộc{' '}
                      {destinations.find((d) => d.id === form.destinationId)
                        ?.name ?? 'điểm đến chưa chọn'}
                      . Đổi phạm vi xem không chuyển địa điểm sang phạm vi khác.
                    </p>
                  )}
                  {form && saved && (
                    <div className="admin-soft-notice">
                      Đề xuất: {saved.proposalRevision ?? 'chưa có'} · Bản công
                      khai: {saved.publicRevision ?? 'chưa xuất bản'}. Lưu chỉnh
                      sửa không thay đổi bản khách đang xem.
                    </div>
                  )}
                  {form && saved?.source && (
                    <div>
                      Nhập từ nguồn lúc{' '}
                      {new Date(saved.source.fetchedAt).toLocaleString('vi-VN')}
                      . Thông tin cần biên tập, giờ mở cửa chưa được xác minh.{' '}
                      <SourceCredit expanded />
                    </div>
                  )}

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

                  <label data-editor-field="sourceUrl">
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

                  <details>
                    <summary>Khóa biên tập theo trường</summary>
                    <p>
                      Trường khóa được bảo vệ khi nguồn cập nhật, xuất bản và
                      phục hồi. Khóa không tự xác minh dữ kiện.
                    </p>
                    <div className="admin-lock-fields">
                      {catalogEditableFields.map((field) => (
                        <label className="admin-checkbox" key={field}>
                          <input
                            type="checkbox"
                            checked={form.fieldLocks?.includes(field) ?? false}
                            onChange={(e) =>
                              update({
                                fieldLocks: e.target.checked
                                  ? [...(form.fieldLocks ?? []), field]
                                  : (form.fieldLocks?.filter(
                                      (v) => v !== field,
                                    ) ?? []),
                              })
                            }
                          />
                          {
                            {
                              name: 'Tên địa điểm',
                              description: 'Mô tả',
                              category: 'Nhóm trải nghiệm',
                              venueType: 'Loại địa điểm',
                              locationQuery: 'Địa chỉ',
                              durationMinutes: 'Thời lượng',
                              openingHoursNote: 'Giờ mở cửa',
                              sourceUrl: 'Nguồn thông tin',
                              referencePrice: 'Giá',
                              mapLocation: 'Tọa độ',
                              images: 'Ảnh',
                            }[field]
                          }
                        </label>
                      ))}
                    </div>
                  </details>
                  {saved?.fieldProvenance?.length ? (
                    <details>
                      <summary>Lịch sử nguồn theo trường</summary>
                      {saved.fieldProvenance.map((p) => (
                        <div key={p.field} className="admin-version">
                          <strong>{p.field}</strong>
                          <span>
                            Nguồn: {p.origin} ·{' '}
                            {p.state === 'verified'
                              ? 'Đã xác minh'
                              : p.state === 'edited'
                                ? 'Đã biên tập'
                                : p.state === 'observed'
                                  ? 'Quan sát nguồn'
                                  : 'Chưa rõ'}
                          </span>
                          <small>
                            Nhận:{' '}
                            {p.receivedAt
                              ? new Date(p.receivedAt).toLocaleString('vi-VN')
                              : 'chưa có'}{' '}
                            · xác minh:{' '}
                            {p.verifiedAt
                              ? new Date(p.verifiedAt).toLocaleString('vi-VN')
                              : 'chưa có'}
                          </small>
                          {p.sourceUrl && (
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Mở căn cứ nguồn ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </details>
                  ) : null}
                  <AdminFieldEvidence
                    form={form}
                    evidence={saved ? sourceEvidence : null}
                  />
                </section>
                <AdminPlaceTools
                  saved={saved}
                  busy={busy}
                  onRestore={() => {
                    if (saved) void open(saved.id);
                    setRetry((v) => v + 1);
                  }}
                />
              </div>
            </div>
            <AdminPlaceSidebar
              form={form}
              saved={saved}
              update={update}
              onField={showField}
              busy={busy}
            />
          </div>
          {preview && (
            <section
              ref={previewPanel}
              className="admin-preview"
              aria-label="Xem trước nội dung"
            >
              <span className="admin-eyebrow">XEM TRƯỚC TÁC ĐỘNG XUẤT BẢN</span>
              <div className="admin-diff">
                <div>
                  <strong>
                    Bản khách đang thấy · {saved?.publicRevision ?? 'chưa có'}
                  </strong>
                  <pre>
                    {publicPlace
                      ? `${publicPlace.name}\n${publicPlace.description}\n${publicPlace.locationQuery}\nGiờ: ${publicPlace.openingHoursNote || 'Chưa rõ'}\nGiá: ${publicPlace.referencePrice ? `${publicPlace.referencePrice.amountMinor.toLocaleString('vi-VN')} VND` : 'Chưa rõ'}`
                      : 'Chưa có bản công khai.'}
                  </pre>
                </div>
                <div>
                  <strong>Đề xuất đang xem</strong>
                  <pre>{`${form.name}\n${form.description}\n${form.locationQuery}\nGiờ: ${form.openingHoursNote || 'Chưa rõ'}\nGiá: ${form.referencePrice ? `${form.referencePrice.amountMinor.toLocaleString('vi-VN')} VND` : 'Chưa rõ'}`}</pre>
                </div>
              </div>
              <p>
                Khả năng sử dụng sau khi xuất bản:{' '}
                {catalogCapabilities(form).discovery
                  ? 'khám phá đủ điều kiện'
                  : 'khám phá chưa đủ'}{' '}
                ·{' '}
                {catalogCapabilities(form).scheduling
                  ? 'Goe đủ dữ liệu'
                  : 'Goe chưa đủ dữ liệu'}{' '}
                ·{' '}
                {catalogCapabilities(form).budgeting
                  ? 'dự toán đủ dữ liệu'
                  : 'dự toán chưa đủ dữ liệu'}
                .
              </p>
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
                onClick={() => void save('published', 'publish')}
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
            <span className="place-save-caption">
              <CheckCircle2 size={22} />
              {busy
                ? 'Đang lưu…'
                : isDirty
                  ? 'Có thay đổi chưa lưu'
                  : 'Đã lưu đề xuất'}{' '}
              ·{' '}
              {saved?.publicRevision
                ? 'Bản công khai giữ nguyên khi lưu'
                : 'Chưa công khai'}
            </span>
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
                ? 'Lưu đề xuất'
                : 'Lưu đề xuất'}
            </button>
            <button type="submit" className="journey-primary" disabled={busy}>
              Xem trước xuất bản
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
                    void save('archived', 'publish');
                }}
              >
                Ngừng hiển thị
              </button>
            )}
          </div>
          {!!history.length && (
            <details className="admin-history" hidden={editorTab !== 'sources'}>
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
