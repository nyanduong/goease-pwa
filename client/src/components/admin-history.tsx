import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FilePenLine,
  History,
  Settings,
  TriangleAlert,
  Search,
  ChevronRight,
  X,
  MapPin,
} from '../icons';

import { useRef, useState } from 'react';
import type { CatalogHistoryDto, CatalogHistoryQuery } from '@goease/contracts';
export type HistoryEntry = CatalogHistoryDto;

// Describe only what the recorded action establishes. Saving/receiving data is
// never described as publication or independent verification.
const activityCopy: Record<
  string,
  {
    title: string;
    result: string;
    kind: 'published' | 'draft' | 'review' | 'source' | 'settings';
  }
> = {
  'catalog.created': {
    title: 'Đã thêm địa điểm',
    result: 'Thông tin ban đầu đã được lưu.',
    kind: 'draft',
  },
  'catalog.imported': {
    title: 'Đã thêm địa điểm từ nguồn dữ liệu',
    result: 'Địa điểm mới được lưu nháp để kiểm tra trước khi xuất bản.',
    kind: 'source',
  },
  'catalog.proposal_saved': {
    title: 'Đã lưu chỉnh sửa để kiểm tra',
    result: 'Chỉnh sửa đã được lưu; thông tin khách đang thấy chưa thay đổi.',
    kind: 'draft',
  },
  'catalog.restored': {
    title: 'Đã lưu nội dung khôi phục',
    result: 'Nội dung khôi phục đã được ghi vào lịch sử.',
    kind: 'draft',
  },
  'catalog.proposal_restored': {
    title: 'Đã chuẩn bị nội dung khôi phục',
    result:
      'Nội dung cũ được đưa vào bản chỉnh sửa để kiểm tra trước khi xuất bản.',
    kind: 'draft',
  },
  'catalog.restore_prepared': {
    title: 'Đã chuẩn bị nội dung khôi phục',
    result:
      'Nội dung cũ được đưa vào bản chỉnh sửa; thông tin khách đang thấy chưa thay đổi.',
    kind: 'draft',
  },
  'catalog.published': {
    title: 'Đã xuất bản thông tin địa điểm',
    result: 'Nội dung được duyệt đã được đưa lên cho khách xem.',
    kind: 'published',
  },
  'catalog.source_changed': {
    title: 'Nguồn dữ liệu có thông tin mới',
    result: 'Thông tin mới cần được đối chiếu trước khi sử dụng.',
    kind: 'source',
  },
  'catalog.updated': {
    title: 'Đã lưu thay đổi thông tin',
    result:
      'Lịch sử cũ ghi nhận thay đổi, chưa cho biết nội dung có được xuất bản hay không.',
    kind: 'draft',
  },
  'catalog.publication_changed': {
    title: 'Đã đổi trạng thái hiển thị',
    result: 'Mở địa điểm để xem trạng thái hiển thị hiện tại.',
    kind: 'published',
  },
  'catalog.review_keep': {
    title: 'Đã giữ thông tin hiện tại',
    result: 'Thông tin hiện tại được giữ lại sau khi kiểm tra.',
    kind: 'review',
  },
  'catalog.review_revise': {
    title: 'Đã yêu cầu chỉnh sửa thêm',
    result: 'Việc kiểm tra vẫn chờ xử lý sau khi bổ sung thông tin.',
    kind: 'review',
  },
  'catalog.review_reject': {
    title: 'Đã từ chối thay đổi được đề nghị',
    result: 'Nội dung và trạng thái hiển thị hiện tại được giữ nguyên.',
    kind: 'review',
  },
  'catalog.review_apply': {
    title: 'Đã chọn dùng thông tin từ nguồn',
    result:
      'Thông tin được đưa vào bản chỉnh sửa để kiểm tra trước khi xuất bản.',
    kind: 'review',
  },
  'catalog.review_ignore': {
    title: 'Đã bỏ qua yêu cầu kiểm tra',
    result: 'Nội dung và trạng thái hiển thị hiện tại được giữ nguyên.',
    kind: 'review',
  },
  'catalog.review_later': {
    title: 'Đã hẹn kiểm tra lại địa điểm',
    result: 'Việc kiểm tra được hẹn xử lý sau; nội dung chưa thay đổi.',
    kind: 'review',
  },
  'catalog.review_distinct': {
    title: 'Đã xác nhận hai địa điểm khác nhau',
    result: 'Hai địa điểm được giữ riêng, không gộp thành một.',
    kind: 'review',
  },
  'catalog.settings_saved': {
    title: 'Đã lưu cài đặt quản lý dữ liệu',
    result: 'Cài đặt mới đã được lưu.',
    kind: 'settings',
  },
  'catalog.schedule_saved': {
    title: 'Đã lưu lịch lấy dữ liệu',
    result:
      'Lịch lấy dữ liệu đã được lưu; xem Quy tắc & lịch để biết lịch đang bật hay tắt.',
    kind: 'settings',
  },
  'catalog.campaign_paused': {
    title: 'Đã tạm dừng đợt thu thập',
    result: 'Đợt thu thập được tạm dừng theo yêu cầu.',
    kind: 'source',
  },
  'catalog.campaign_resumed': {
    title: 'Đã tiếp tục đợt thu thập',
    result: 'Phần việc còn lại được tiếp tục xử lý.',
    kind: 'source',
  },
  'catalog.policy_created': {
    title: 'Đã lưu bộ quy tắc mới',
    result: 'Bộ quy tắc mới đã được lưu; các đợt đã tạo giữ nguyên quy tắc cũ.',
    kind: 'settings',
  },
  'catalog.run_requested': {
    title: 'Đã yêu cầu lấy dữ liệu địa điểm',
    result: 'Yêu cầu đã được tiếp nhận, chưa phải kết quả thu thập.',
    kind: 'source',
  },
  'catalog.run_succeeded': {
    title: 'Đã hoàn tất lượt lấy dữ liệu',
    result:
      'Lượt lấy dữ liệu đã hoàn tất. Dữ liệu mới vẫn cần kiểm tra trước khi xuất bản.',
    kind: 'source',
  },
  'catalog.run_failed': {
    title: 'Lấy dữ liệu chưa thành công',
    result: 'Mở Đợt thu thập để xem lỗi và thử lại phần chưa thành công.',
    kind: 'source',
  },
  'catalog.destination_created': {
    title: 'Đã thêm điểm đến',
    result: 'Điểm đến đã được lưu trong danh mục quản trị.',
    kind: 'settings',
  },
  'catalog.destination_catalogued': {
    title: 'Đã cập nhật danh mục tỉnh, thành',
    result: 'Danh mục tỉnh, thành đã được cập nhật trong hệ thống.',
    kind: 'settings',
  },
  'catalog.destination_updated': {
    title: 'Đã đổi cài đặt điểm đến',
    result: 'Mở Cài đặt để xem trạng thái hiện tại của điểm đến.',
    kind: 'settings',
  },
};

const dayKey = (date: string) =>
  new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const dayLabel = (date: string) =>
  new Date(date).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
const clockLabel = (date: string) =>
  new Date(date).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });
const kinds = {
  published: { label: 'Hiển thị cho khách', Icon: CheckCircle2 },
  draft: { label: 'Nội dung địa điểm', Icon: FilePenLine },
  review: { label: 'Kiểm tra thông tin', Icon: Clock3 },
  source: { label: 'Thu thập dữ liệu', Icon: Database },
  settings: { label: 'Cài đặt', Icon: Settings },
  other: { label: 'Hoạt động khác', Icon: History },
};

const shortTitles: Record<string, string> = {
  'catalog.published': 'Xuất bản địa điểm',
  'catalog.proposal_saved': 'Lưu chỉnh sửa',
  'catalog.review_later': 'Hẹn kiểm tra lại',
  'catalog.run_succeeded': 'Lấy dữ liệu hoàn tất',
  'catalog.run_failed': 'Lấy dữ liệu thất bại',
  'catalog.run_requested': 'Yêu cầu lấy dữ liệu',
};
function presentation(entry: HistoryEntry) {
  const copy = activityCopy[entry.action];
  const failed =
    ['failure', 'failed', 'error', 'denied'].includes(entry.outcome) ||
    entry.action === 'catalog.run_failed';
  const special: Record<string, [string, string]> = {
    'catalog.published': ['Đã xuất bản', 'good'],
    'catalog.proposal_saved': ['Chưa xuất bản', 'info'],
    'catalog.review_later': ['Xem sau', 'warning'],
    'catalog.run_succeeded': ['Hoàn tất', 'good'],
    'catalog.run_requested': ['Đã yêu cầu', 'neutral'],
  };
  const [badge, tone] = failed
    ? ['Có lỗi', 'error']
    : (special[entry.action] ?? [
        kinds[copy?.kind ?? 'other'].label,
        'neutral',
      ]);
  return {
    title:
      failed && entry.action !== 'catalog.run_failed'
        ? 'Thao tác chưa thành công'
        : (copy?.title ?? 'Đã ghi nhận hoạt động quản lý dữ liệu'),
    short:
      failed && entry.action !== 'catalog.run_failed'
        ? 'Thao tác chưa thành công'
        : (shortTitles[entry.action] ??
          copy?.title.replace(/^Đã /, '') ??
          'Hoạt động khác'),
    result:
      failed && entry.action !== 'catalog.run_failed'
        ? 'Thao tác chưa hoàn tất. Xem thông tin hỗ trợ để đối chiếu khi cần.'
        : (copy?.result ?? 'Lịch sử chưa có mô tả chi tiết cho hoạt động này.'),
    badge,
    tone,
    Icon: failed ? TriangleAlert : kinds[copy?.kind ?? 'other'].Icon,
  };
}

export function AdminHistory({
  items,
  total,
  offset,
  hasMore,
  loading,
  failedToLoad,
  search,
  kind,
  period,
  onSearch,
  onKind,
  onPeriod,
  onPage,
  onOpen,
}: {
  items: HistoryEntry[];
  total: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  failedToLoad: boolean;
  search: string;
  kind: CatalogHistoryQuery['kind'];
  period: CatalogHistoryQuery['period'];
  onSearch: (q: string) => void;
  onKind: (kind: CatalogHistoryQuery['kind']) => void;
  onPeriod: (period: CatalogHistoryQuery['period']) => void;
  onPage: (offset: number) => void;
  onOpen: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null | undefined>();
  const panel = useRef<HTMLElement>(null);
  const list = useRef<HTMLElement>(null);
  const selected =
    selectedId === null
      ? null
      : (items.find((item) => item.id === selectedId) ?? items[0] ?? null);
  const detail = selected ? presentation(selected) : null;
  const today = dayKey(new Date().toISOString());
  const days = new Map<string, HistoryEntry[]>();
  for (const entry of items) {
    const key = dayKey(entry.occurredAt);
    days.set(key, [...(days.get(key) ?? []), entry]);
  }
  const choose = (id: string) => {
    if (loading || failedToLoad) return;
    setSelectedId(id);
    if (window.matchMedia('(max-width:1100px)').matches)
      requestAnimationFrame(() => {
        panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        panel.current?.focus({ preventScroll: true });
      });
  };
  const close = () => {
    const selectedButton = list.current?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    setSelectedId(null);
    if (window.matchMedia('(max-width:1100px)').matches)
      (selectedButton ?? list.current)?.scrollIntoView({ block: 'center' });
    selectedButton?.focus({ preventScroll: true });
  };
  return (
    <div className="history-browser">
      <section
        ref={list}
        className="admin-panel history-browser-list"
        aria-label="Nhật ký hoạt động"
        aria-busy={loading}
      >
        <h2 className="sr-only">Nhật ký hoạt động</h2>
        <div className="history-browser-filters">
          <label className="history-browser-search">
            <Search size={17} />
            <input
              value={search}
              maxLength={100}
              aria-label="Tìm hoạt động"
              placeholder="Tìm địa điểm hoặc người thực hiện…"
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Lọc loại hoạt động"
            value={kind}
            onChange={(event) =>
              onKind(event.target.value as CatalogHistoryQuery['kind'])
            }
          >
            <option value="all">Tất cả hoạt động</option>
            <option value="publication">Xuất bản & hiển thị</option>
            <option value="editing">Chỉnh sửa nội dung</option>
            <option value="review">Kiểm tra thông tin</option>
            <option value="collection">Thu thập dữ liệu</option>
            <option value="settings">Cài đặt</option>
          </select>
          <select
            aria-label="Lọc thời gian hoạt động"
            value={period}
            onChange={(event) =>
              onPeriod(event.target.value as CatalogHistoryQuery['period'])
            }
          >
            <option value="all">Mọi thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày gần đây</option>
            <option value="30days">30 ngày gần đây</option>
          </select>
        </div>
        {loading && <p role="status">Đang tải hoạt động…</p>}
        {failedToLoad && items.length > 0 && (
          <p role="status">
            Chưa cập nhật được nhật ký. Bảng đang hiển thị kết quả lần tải
            trước.
          </p>
        )}
        {!loading && !failedToLoad && !items.length && (
          <div className="admin-empty">
            <History size={30} />
            <h3>
              {search || kind !== 'all' || period !== 'all'
                ? 'Không có hoạt động phù hợp'
                : 'Chưa có hoạt động để hiển thị'}
            </h3>
            <p>
              {search || kind !== 'all' || period !== 'all'
                ? 'Thử đổi từ khóa hoặc bộ lọc.'
                : 'Các lần lưu, xuất bản và xử lý dữ liệu sẽ xuất hiện ở đây.'}
            </p>
          </div>
        )}
        {items.length > 0 && (
          <div className="history-browser-table-wrap">
            <table className="history-browser-table">
              <thead>
                <tr>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Người thực hiện</th>
                  <th scope="col">Địa điểm / phạm vi</th>
                  <th scope="col">Hoạt động</th>
                </tr>
              </thead>
              {[...days].map(([day, entries]) => (
                <tbody key={day}>
                  <tr className="history-browser-day">
                    <th colSpan={4} scope="rowgroup">
                      {day === today ? 'Hôm nay · ' : ''}
                      {dayLabel(entries[0]!.occurredAt)}{' '}
                      <span>{entries.length} hoạt động trên trang</span>
                    </th>
                  </tr>
                  {entries.map((entry) => {
                    const view = presentation(entry);
                    return (
                      <tr
                        key={entry.id}
                        className={`history-browser-row${selected?.id === entry.id ? ' is-selected' : ''}`}
                        onClick={() => choose(entry.id)}
                      >
                        <td>
                          <time dateTime={entry.occurredAt}>
                            {clockLabel(entry.occurredAt)}
                          </time>
                        </td>
                        <td>
                          <span className="history-browser-actor">
                            <span
                              className={`history-browser-avatar${entry.actorType === 'system' ? ' is-system' : ''}`}
                            >
                              {entry.actorType === 'system' ? (
                                <Settings size={15} />
                              ) : (
                                entry.actor.slice(0, 1).toUpperCase()
                              )}
                            </span>
                            <span>{entry.actor || 'Chưa rõ'}</span>
                          </span>
                        </td>
                        <td>
                          <span className="history-browser-target">
                            {entry.name || 'Chưa rõ đối tượng'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            aria-pressed={selected?.id === entry.id}
                            aria-controls="history-selected-detail"
                            disabled={loading || failedToLoad}
                            onClick={(event) => {
                              event.stopPropagation();
                              choose(entry.id);
                            }}
                            onKeyDown={(event) => {
                              if (!['ArrowDown', 'ArrowUp'].includes(event.key))
                                return;
                              event.preventDefault();
                              const index = items.findIndex(
                                (item) => item.id === entry.id,
                              );
                              const next =
                                items[
                                  index + (event.key === 'ArrowDown' ? 1 : -1)
                                ];
                              if (next) {
                                setSelectedId(next.id);
                                const buttons =
                                  list.current?.querySelectorAll<HTMLButtonElement>(
                                    'tbody button',
                                  );
                                buttons?.[
                                  index + (event.key === 'ArrowDown' ? 1 : -1)
                                ]?.focus();
                              }
                            }}
                            aria-label={`Xem hoạt động: ${view.short} · ${entry.name} · ${clockLabel(entry.occurredAt)}`}
                          >
                            <span>{view.short}</span>
                            <span className={`history-status is-${view.tone}`}>
                              {view.badge}
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <footer className="history-browser-pagination">
          <span>
            {total > 0
              ? `Hiển thị ${offset + 1}–${offset + items.length} / ${total} hoạt động`
              : '0 hoạt động'}{' '}
            · Trang {Math.floor(offset / 30) + 1}
          </span>
          <div>
            <button
              disabled={!offset || loading}
              onClick={() => onPage(Math.max(0, offset - 30))}
            >
              Trang trước
            </button>
            <button
              disabled={!hasMore || loading}
              onClick={() => onPage(offset + 30)}
            >
              Trang tiếp
            </button>
          </div>
        </footer>
        <p className="history-browser-help">
          Chọn một hoạt động để xem chi tiết. Thời gian hiển thị theo giờ Việt
          Nam.
        </p>
      </section>
      <section
        ref={panel}
        id="history-selected-detail"
        tabIndex={-1}
        className="admin-panel history-browser-detail"
        aria-label="Chi tiết hoạt động"
      >
        <div className="history-detail-heading">
          <h2>Chi tiết hoạt động</h2>
          {selected && (
            <button onClick={close} aria-label="Đóng chi tiết hoạt động">
              <X size={18} />
            </button>
          )}
        </div>
        {!selected || !detail ? (
          <div className="admin-empty">
            <History size={28} />
            <h3>Chọn một hoạt động</h3>
            <p>Thông tin, kết quả và ghi chú sẽ hiển thị tại đây.</p>
          </div>
        ) : (
          <div key={selected.id}>
            <div className={`history-detail-title is-${detail.tone}`}>
              <detail.Icon size={24} />
              <h3>{detail.title}</h3>
            </div>
            <h4>{selected.name || 'Chưa rõ đối tượng'}</h4>
            {selected.destinationName && (
              <p className="history-detail-destination">
                <MapPin size={16} />
                {selected.destinationName}
              </p>
            )}
            <dl className="history-detail-facts">
              <dt>Người thực hiện</dt>
              <dd>{selected.actor || 'Chưa rõ'}</dd>
              <dt>Thời gian</dt>
              <dd>
                {clockLabel(selected.occurredAt)} ·{' '}
                {dayLabel(selected.occurredAt)}
              </dd>
            </dl>
            <h5>Kết quả</h5>
            <p className={`history-detail-result is-${detail.tone}`}>
              {detail.result}
            </p>
            <h5>Ghi chú</h5>
            <p className="history-detail-note">
              {selected.note || 'Không có ghi chú.'}
            </p>
            {selected.placeId && (
              <button
                className="journey-primary history-detail-open"
                onClick={() => onOpen(selected.placeId!)}
              >
                Mở địa điểm <ArrowRight size={16} />
              </button>
            )}
            {selected.action.startsWith('catalog.run_') ||
            selected.action.startsWith('catalog.campaign_') ? (
              <a className="history-detail-link" href="#automatic">
                Mở Đợt thu thập <ArrowRight size={15} />
              </a>
            ) : null}
            <details className="history-detail-support">
              <summary>Thông tin hỗ trợ</summary>
              <dl>
                <dt>Mã hoạt động</dt>
                <dd>{selected.id}</dd>
                <dt>Loại hoạt động</dt>
                <dd>{selected.action}</dd>
                <dt>Kết quả được lưu</dt>
                <dd>{selected.outcome || 'Chưa ghi nhận'}</dd>
                {selected.entityRevision != null && (
                  <>
                    <dt>Phiên bản nội dung</dt>
                    <dd>
                      {selected.previousRevision != null
                        ? `${selected.previousRevision} → `
                        : ''}
                      {selected.entityRevision}
                    </dd>
                  </>
                )}
                {selected.campaignId && (
                  <>
                    <dt>Mã đợt thu thập</dt>
                    <dd>{selected.campaignId}</dd>
                  </>
                )}
                {selected.runId && (
                  <>
                    <dt>Mã lượt xử lý</dt>
                    <dd>{selected.runId}</dd>
                  </>
                )}
                {selected.batchId && (
                  <>
                    <dt>Mã lần xử lý theo lô</dt>
                    <dd>{selected.batchId}</dd>
                  </>
                )}
              </dl>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
