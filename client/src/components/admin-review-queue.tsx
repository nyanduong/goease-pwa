import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Search,
} from 'lucide-react';
import {
  needsPlaceDescription,
  catalogPhotoCover,
  type CatalogReviewDto,
  type CatalogReviewListDto,
  type CatalogRunDto,
} from '@goease/contracts';
import { AdminPlaceImage } from './admin-visuals';
import { catalogTime } from './admin-review-utils';
const categories: [CatalogReviewDto['kind'], string][] = [
  ['draft', 'Bản nháp'],
  ['duplicate', 'Có thể trùng'],
  ['source', 'Nguồn thay đổi'],
  ['price', 'Giá cần kiểm tra'],
  ['quality', 'Thông tin công khai'],
];
export function AdminReviewQueue({
  items,
  total,
  counts,
  publishedCount,
  offset,
  hasMore,
  loading,
  query,
  kind,
  sort,
  selectedId,
  onSelect,
  onQuery,
  onKind,
  onSort,
  onPage,
  run,
  children,
}: {
  items: CatalogReviewDto[];
  total: number;
  counts: CatalogReviewListDto['counts'];
  publishedCount: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  query: string;
  kind: string;
  sort: 'priority' | 'newest';
  selectedId: string | null;
  onSelect: (item: CatalogReviewDto) => void;
  onQuery: (value: string) => void;
  onKind: (value: string) => void;
  onSort: (value: 'priority' | 'newest') => void;
  onPage: (value: number) => void;
  run: CatalogRunDto | undefined;
  children: ReactNode;
}) {
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="admin-check-workspace">
      {!!publishedCount && (
        <div className="admin-check-priority">
          <AlertCircle size={19} />
          <span>
            <strong>
              {publishedCount} việc liên quan đến nội dung đang công khai
            </strong>
            <small>
              Ưu tiên kiểm tra để thông tin khách đang xem luôn chính xác.
            </small>
          </span>
          <button onClick={() => onSort('priority')} disabled={loading}>
            Ưu tiên trước <ArrowRight size={16} />
          </button>
        </div>
      )}
      {run?.state === 'failed' && (
        <div className="admin-soft-notice">
          Đợt thu thập gần nhất cần kiểm tra.{' '}
          <a href="#automatic">Xem lỗi và thử lại ↗</a>
        </div>
      )}
      <div className="admin-check-tools">
        <div
          className="admin-check-tabs"
          role="group"
          aria-label="Loại việc cần kiểm tra"
        >
          {([['', 'Tất cả'], ...categories] as [string, string][]).map(
            ([code, label]) => (
              <button
                key={code}
                aria-pressed={kind === code}
                disabled={loading}
                onClick={() => onKind(code)}
              >
                {label}
                <span>
                  {code ? counts[code as CatalogReviewDto['kind']] : allCount}
                </span>
              </button>
            ),
          )}
        </div>
        <label className="admin-check-search">
          <Search size={17} />
          <span className="sr-only">Tìm việc theo địa điểm</span>
          <input
            value={query}
            maxLength={100}
            placeholder="Tìm tên địa điểm…"
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        <label className="admin-check-sort">
          <span className="sr-only">Sắp xếp việc cần kiểm tra</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as 'priority' | 'newest')}
          >
            <option value="priority">Ưu tiên trước</option>
            <option value="newest">Mới cập nhật</option>
          </select>
        </label>
      </div>
      <div className="admin-check-columns" aria-busy={loading}>
        <section
          className="admin-check-list"
          aria-label="Danh sách cần kiểm tra"
        >
          <header>
            <h2>{total} việc cần kiểm tra</h2>
            <span role="status">
              {loading
                ? 'Đang cập nhật…'
                : sort === 'priority'
                  ? 'Ưu tiên nội dung công khai'
                  : 'Mới cập nhật'}
            </span>
          </header>
          {!items.length && (
            <div className="admin-check-empty">
              <ListChecks size={32} />
              <h3>
                {query || kind
                  ? 'Không có việc khớp bộ lọc'
                  : 'Hiện không có việc cần xử lý'}
              </h3>
              <p>
                {query || kind
                  ? 'Thử tìm tên khác hoặc xem tất cả loại việc.'
                  : 'Các vấn đề mới sẽ xuất hiện tại đây để bạn kiểm tra.'}
              </p>
              {(query || kind) && (
                <button
                  onClick={() => {
                    onQuery('');
                    onKind('');
                  }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          )}
          <div className="admin-check-rows">
            {items.map((item) => {
              const warning = needsPlaceDescription(item.place.description)
                ? 'Thiếu giới thiệu'
                : !catalogPhotoCover(item.place.images ?? [])
                  ? 'Thiếu ảnh bìa'
                  : item.kind === 'draft'
                    ? 'Chờ kiểm tra'
                    : null;
              return (
                <button
                  className="admin-check-row"
                  key={item.id}
                  aria-pressed={item.id === selectedId}
                  disabled={loading}
                  onClick={() => onSelect(item)}
                >
                  <AdminPlaceImage place={item.place} />
                  <span className="admin-check-row-copy">
                    <strong>{item.place.name}</strong>
                    <span className="admin-check-badges">
                      <span className={`admin-check-tag is-${item.kind}`}>
                        {categories.find(([code]) => code === item.kind)?.[1]}
                      </span>
                      {warning && (
                        <span className="admin-check-tag is-warning">
                          {warning}
                        </span>
                      )}
                    </span>
                    <small>
                      {item.place.publicationStatus === 'published'
                        ? 'Đang hiển thị cho khách'
                        : item.place.publicationStatus === 'archived'
                          ? 'Đã ngừng hiển thị'
                          : 'Chưa hiển thị cho khách'}
                    </small>
                    <time dateTime={item.updatedAt}>
                      {catalogTime(item.updatedAt)}
                    </time>
                  </span>
                </button>
              );
            })}
          </div>
          <footer>
            <span>
              {total
                ? `${offset + 1}–${Math.min(offset + items.length, total)} / ${total}`
                : '0 việc'}
            </span>
            <div>
              <button
                aria-label="Trang trước"
                disabled={!offset || loading}
                onClick={() => onPage(Math.max(0, offset - 20))}
              >
                <ChevronLeft size={18} />
              </button>
              <span>Trang {Math.floor(offset / 20) + 1}</span>
              <button
                aria-label="Trang tiếp"
                disabled={!hasMore || loading}
                onClick={() => onPage(offset + 20)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        </section>
        <div className="admin-check-inspector">
          {children || (
            <div className="admin-check-empty">
              <ListChecks size={34} />
              <h2>Chọn một việc để kiểm tra</h2>
              <p>Thông tin và thao tác xử lý sẽ hiển thị tại đây.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
