import { confirmAction } from '../confirmation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  travelRegions,
  travelRegionOf,
  type AdminDestinationDto,
} from '@goease/contracts';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Database,
  Lightbulb,
  Search,
} from '../icons';
import { api, ApiFailure } from '../api';
import { AdminProvinceImport } from './admin-province-import';

type Pending = {
  id: string;
  name: string;
  enabled: boolean;
  payload: string;
  key: string;
};

function paginationItems(current: number, total: number, compact: boolean) {
  const siblings = compact ? 0 : 1;
  const start = Math.max(
    0,
    Math.min(current - siblings, total - 1 - 2 * siblings),
  );
  const end = Math.min(total - 1, Math.max(current + siblings, 2 * siblings));
  const pages = new Set([0, total - 1]);
  for (let i = start; i <= end; i++) pages.add(i);
  const items: (number | string)[] = [];
  let previous = -1;
  for (const page of [...pages].sort((a, b) => a - b)) {
    if (previous >= 0 && page - previous > 1) items.push(`gap-${previous}`);
    items.push(page);
    previous = page;
  }
  return items;
}

export function AdminDestinations() {
  const generation = useRef(0);
  const [importTarget, setImportTarget] = useState<{
    destination: AdminDestinationDto;
    autoKey?: string;
  } | null>(null);
  const [rows, setRows] = useState<AdminDestinationDto[]>([]);
  const [region, setRegion] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [compactPages, setCompactPages] = useState(
    () => window.matchMedia('(max-width: 700px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setCompactPages(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const load = useCallback(async () => {
    const attempt = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const items: AdminDestinationDto[] = [];
      let hasMore = true;
      while (hasMore) {
        const data = await api<{
          items: AdminDestinationDto[];
          hasMore: boolean;
        }>('/admin/destinations?limit=200&offset=' + items.length);
        if (attempt !== generation.current) return;
        items.push(...data.items);
        hasMore = data.hasMore && data.items.length > 0;
      }
      if (attempt === generation.current) setRows(items);
    } catch (e) {
      if (attempt === generation.current) {
        setRows([]);
        setError(
          e instanceof Error ? e.message : 'Chưa tải được danh mục tỉnh/thành.',
        );
      }
    } finally {
      if (attempt === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  async function toggle(request: Pending) {
    if (busy) return;
    setBusy(true);
    setPending(request);
    setError('');
    setNotice('');
    try {
      const result = await api<{ destination: AdminDestinationDto }>(
        `/admin/destinations/${request.id}`,
        {
          method: 'PATCH',
          headers: { 'Idempotency-Key': request.key },
          body: request.payload,
        },
      );
      setRows((current) =>
        current.map((d) =>
          d.id === result.destination.id ? result.destination : d,
        ),
      );
      setPending(null);
      if (
        request.enabled &&
        result.destination.publicationStatus === 'published'
      )
        setImportTarget({
          destination: result.destination,
          autoKey: request.key,
        });
      else if (importTarget?.destination.id === result.destination.id)
        setImportTarget(null);
      setNotice(
        `${result.destination.publicationStatus === 'published' ? 'Đã bật' : 'Đã tắt'} ${request.name}.`,
      );
      window.dispatchEvent(new Event('goease-admin-destinations-changed'));
      window.dispatchEvent(new Event('goease-destinations-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được trạng thái.');
      if (e instanceof ApiFailure && e.status >= 400 && e.status < 500)
        setPending(null);
    } finally {
      setBusy(false);
    }
  }
  const enabledCount = rows.filter(
    (d) => d.publicationStatus === 'published',
  ).length;
  const fold = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLocaleLowerCase('vi-VN')
      .trim();
  const filtered = rows.filter(
    (d) =>
      (!region || travelRegionOf(d.tourismRegion) === region) &&
      (visibility === 'all' ||
        (d.publicationStatus === 'published') === (visibility === 'enabled')) &&
      fold(
        [d.name, d.provinceCode ?? '', ...(d.tourismAreas ?? [])].join(' '),
      ).includes(fold(q)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  function filterVisibility(value: string) {
    setVisibility(value);
    setPage(0);
  }
  return (
    <div className="settings-destinations">
      <section
        className="admin-panel admin-destination-manager"
        aria-label="Danh mục tỉnh thành"
      >
        <header className="settings-province-heading">
          <div>
            <h2>Hiển thị tỉnh/thành</h2>
          </div>
        </header>
        <fieldset
          className="settings-province-filters"
          disabled={busy || !!pending}
        >
          <label className="settings-province-search">
            <Search size={18} />
            <span className="sr-only">Tìm tỉnh/thành hoặc khu vực</span>
            <input
              value={q}
              maxLength={100}
              placeholder="Tìm tỉnh/thành…"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Miền du lịch</span>
            <select
              aria-label="Miền du lịch"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả miền</option>
              {travelRegions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Trạng thái hiển thị</span>
            <select
              aria-label="Trạng thái hiển thị"
              value={visibility}
              onChange={(e) => filterVisibility(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="enabled">Đang bật</option>
              <option value="disabled">Đang tắt</option>
            </select>
          </label>
        </fieldset>
        <div
          className="settings-visibility-filters"
          role="group"
          aria-label="Lọc hiển thị tỉnh thành"
        >
          {[
            { id: 'all', name: 'Tất cả', count: rows.length },
            { id: 'enabled', name: 'Đang bật', count: enabledCount },
            {
              id: 'disabled',
              name: 'Đang tắt',
              count: rows.length - enabledCount,
            },
          ].map((item) => (
            <button
              key={item.id}
              aria-pressed={visibility === item.id}
              disabled={busy || !!pending}
              onClick={() => filterVisibility(item.id)}
            >
              {item.name}
              <span>{loading || error ? '—' : item.count}</span>
            </button>
          ))}
        </div>
        {error && (
          <div role="alert" className="admin-alert">
            <p>{error}</p>
            {pending ? (
              <button disabled={busy} onClick={() => void toggle(pending)}>
                Thử lại bật/tắt {pending.name}
              </button>
            ) : (
              <button onClick={() => void load()}>Tải lại danh mục</button>
            )}
          </div>
        )}
        {notice && (
          <p className="admin-success" role="status">
            {notice}
          </p>
        )}
        {importTarget && (
          <AdminProvinceImport
            key={
              importTarget.destination.id +
              '-' +
              (importTarget.autoKey ?? 'resume')
            }
            {...importTarget}
          />
        )}
        {loading ? (
          <div className="settings-table-loading" role="status">
            <span className="sr-only">Đang tải tỉnh/thành…</span>
            <div className="settings-loading-heading" aria-hidden="true" />
            {Array.from({ length: pageSize }, (_, index) => (
              <div
                className="settings-loading-row"
                key={index}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : !filtered.length && !error ? (
          <div className="settings-province-empty">
            <h3>Không có tỉnh/thành phù hợp bộ lọc.</h3>
            <button
              onClick={() => {
                setQ('');
                setRegion('');
                filterVisibility('all');
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          !error && (
            <>
              <div className="settings-province-table-wrap">
                <table className="settings-province-table">
                  <thead>
                    <tr>
                      <th scope="col">Tỉnh / thành phố</th>
                      <th scope="col">Miền du lịch</th>
                      <th scope="col" className="admin-cell-switch">
                        Hiển thị
                      </th>
                      <th scope="col" className="admin-cell-actions">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.name}</strong>
                        </td>
                        <td className="admin-province-region">
                          <span>
                            {travelRegions.find(
                              (r) => r.code === travelRegionOf(d.tourismRegion),
                            )?.name ?? 'Chưa phân miền'}
                          </span>
                          {!!d.tourismAreas?.length && (
                            <small>Khu vực: {d.tourismAreas.join(', ')}</small>
                          )}
                        </td>
                        <td className="admin-cell-switch">
                          <button
                            className="settings-province-switch"
                            type="button"
                            role="switch"
                            aria-checked={d.publicationStatus === 'published'}
                            aria-label={'Hiển thị ' + d.name}
                            title={
                              (d.publicationStatus === 'published'
                                ? 'Tắt hiển thị '
                                : 'Bật hiển thị ') + d.name
                            }
                            aria-busy={busy && pending?.id === d.id}
                            disabled={busy || !!pending || !d.provinceCode}
                            onClick={async () => {
                              const enabled =
                                d.publicationStatus !== 'published';
                              if (
                                !enabled &&
                                !(await confirmAction(
                                  'Tắt ' +
                                    d.name +
                                    '? Khách sẽ không thấy tỉnh/thành và các địa điểm bên trong. Chuyến đã lưu được giữ nguyên; lịch thu thập không thay đổi.',
                                  {
                                    title: 'Ẩn tỉnh/thành với khách?',
                                    confirmLabel: 'Tắt hiển thị',
                                    tone: 'warning',
                                  },
                                ))
                              )
                                return;
                              void toggle({
                                id: d.id,
                                name: d.name,
                                enabled,
                                key: crypto.randomUUID(),
                                payload: JSON.stringify({
                                  enabled,
                                  expectedRevision: d.revision,
                                }),
                              });
                            }}
                          >
                            <span
                              className="settings-switch-track"
                              aria-hidden="true"
                            >
                              <span />
                            </span>
                            <span className="sr-only">
                              {busy && pending?.id === d.id
                                ? 'Đang lưu…'
                                : d.publicationStatus === 'published'
                                  ? 'Đang hiển thị'
                                  : 'Đang ẩn'}
                            </span>
                          </button>
                        </td>
                        <td className="admin-cell-actions">
                          <div className="admin-row-actions">
                            <button
                              className="journey-outline"
                              disabled={
                                busy ||
                                !!pending ||
                                d.publicationStatus !== 'published'
                              }
                              title={
                                d.publicationStatus === 'published'
                                  ? `Lấy địa điểm tại ${d.name}`
                                  : 'Bật hiển thị tỉnh/thành để lấy địa điểm'
                              }
                              onClick={() =>
                                setImportTarget({ destination: d })
                              }
                            >
                              Lấy địa điểm
                            </button>
                            {d.publicationStatus === 'published' && (
                              <a
                                className="settings-progress-link"
                                href={'#automatic?destinationId=' + d.id}
                                aria-label={`Xem tiến trình ${d.name}`}
                              >
                                Xem tiến trình <ArrowRight size={16} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="settings-province-pagination">
                <div className="settings-pagination-summary">
                  <p aria-live="polite" aria-atomic="true">
                    Hiển thị {currentPage * pageSize + 1}–
                    {Math.min((currentPage + 1) * pageSize, filtered.length)}{' '}
                    trong {filtered.length} tỉnh/thành
                  </p>
                  <label>
                    Số dòng mỗi trang
                    <select
                      aria-label="Số dòng mỗi trang"
                      value={pageSize}
                      disabled={busy || !!pending}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(0);
                      }}
                    >
                      {[5, 10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <nav aria-label="Phân trang tỉnh thành">
                  <button
                    aria-label="Trang trước"
                    disabled={currentPage === 0 || busy || !!pending}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  {paginationItems(currentPage, pageCount, compactPages).map(
                    (i) =>
                      typeof i === 'string' ? (
                        <span
                          key={i}
                          className="settings-pagination-gap"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={i}
                          aria-label={'Trang ' + (i + 1)}
                          aria-current={i === currentPage ? 'page' : undefined}
                          disabled={busy || !!pending}
                          onClick={() => setPage(i)}
                        >
                          {i + 1}
                        </button>
                      ),
                  )}
                  <button
                    aria-label="Trang sau"
                    disabled={
                      currentPage === pageCount - 1 || busy || !!pending
                    }
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </nav>
              </footer>
            </>
          )
        )}
      </section>
      <div className="settings-destination-tip">
        <Lightbulb size={21} />
        <p>Bật hiển thị chưa có nghĩa là đã đủ dữ liệu để Goe xếp lịch.</p>
        <a href="#places">
          Kiểm tra địa điểm <ArrowRight size={16} />
        </a>
      </div>
      <details className="settings-catalog-origin">
        <summary>
          <Database size={18} /> Nguồn danh mục & cách phân vùng
        </summary>
        <p>
          <a
            href="https://chinhphu.vn/?classid=1&docid=214409&orggroupid=3&pageid=27160"
            target="_blank"
            rel="noreferrer"
          >
            Quyết định 19/2025/QĐ-TTg
          </a>
          , hiệu lực 01/07/2025. Danh mục có phiên bản, không tự đổi theo nguồn
          mạng.
        </p>
        <p>
          3 miền và 8 vùng là phân nhóm du lịch của GoEase, không mô tả ranh
          giới hành chính. Hội An là khu vực trong Đà Nẵng; Sa Pa thuộc Lào Cai.
          Tìm tên khu vực để thấy tỉnh/thành tương ứng.
        </p>
      </details>
    </div>
  );
}
