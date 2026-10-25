import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FilePenLine,
  History,
  Info,
  RefreshCw,
  Settings,
  TriangleAlert,
} from 'lucide-react';

export type HistoryEntry = {
  id: string;
  action: string;
  actor: string;
  placeId: string | null;
  name: string;
  occurredAt: string;
  outcome: string;
  note?: string;
  campaignId?: string | null;
  batchId?: string | null;
  runId?: string | null;
  entityRevision?: number | null;
  previousRevision?: number | null;
};

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

export function AdminHistory({
  items,
  offset,
  hasMore,
  loading,
  failedToLoad,
  onPage,
  onOpen,
  onRefresh,
  onReviews,
}: {
  items: HistoryEntry[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  failedToLoad: boolean;
  onPage: (offset: number) => void;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onReviews: () => void;
}) {
  const today = dayKey(new Date().toISOString());
  const days = new Map<string, HistoryEntry[]>();
  for (const entry of items) {
    const key = dayKey(entry.occurredAt);
    days.set(key, [...(days.get(key) ?? []), entry]);
  }
  return (
    <div className="admin-history-layout">
      <section
        className="admin-panel admin-activity-log"
        aria-label="Nhật ký hoạt động"
        aria-busy={loading}
      >
        <div className="admin-activity-heading">
          <div>
            <h2>Hoạt động gần đây</h2>
            <p>Thứ tự mới nhất trước · Giờ Việt Nam</p>
          </div>
          <button disabled={loading} onClick={onRefresh}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
        {loading && <p role="status">Đang tải hoạt động…</p>}
        {failedToLoad && items.length > 0 && (
          <p role="status">
            Chưa cập nhật được nhật ký. Các hoạt động bên dưới thuộc lần tải
            trước.
          </p>
        )}
        {!loading && !failedToLoad && !items.length && (
          <div className="admin-empty">
            <History size={32} />
            <h3>Chưa có hoạt động để hiển thị</h3>
            <p>Các lần lưu, xuất bản và xử lý dữ liệu sẽ xuất hiện ở đây.</p>
          </div>
        )}
        {[...days].map(([day, entries]) => (
          <section
            className="admin-activity-day"
            key={day}
            aria-label={`Hoạt động ngày ${dayLabel(entries[0]!.occurredAt)}`}
          >
            <h3>
              {day === today ? 'Hôm nay' : dayLabel(entries[0]!.occurredAt)}
              {day === today && <span>{dayLabel(entries[0]!.occurredAt)}</span>}
            </h3>
            <ol>
              {entries.map((entry) => {
                const failed =
                  ['failure', 'failed', 'error', 'denied'].includes(
                    entry.outcome,
                  ) || entry.action === 'catalog.run_failed';
                const copy = activityCopy[entry.action];
                const { label, Icon } = kinds[copy?.kind ?? 'other'];
                const EntryIcon = failed ? TriangleAlert : Icon;
                return (
                  <li
                    key={entry.id}
                    className={`admin-activity-entry${failed ? ' is-failed' : ''}`}
                  >
                    <time dateTime={entry.occurredAt}>
                      {clockLabel(entry.occurredAt)}
                    </time>
                    <span
                      className={`admin-activity-icon is-${failed ? 'failed' : (copy?.kind ?? 'other')}`}
                    >
                      <EntryIcon size={18} />
                    </span>
                    <article>
                      <div className="admin-activity-title">
                        <h4>
                          {failed && entry.action !== 'catalog.run_failed'
                            ? 'Thao tác chưa thành công'
                            : (copy?.title ??
                              'Đã ghi nhận hoạt động quản lý dữ liệu')}
                        </h4>
                        <span>{failed ? 'Cần xử lý' : label}</span>
                      </div>
                      {entry.placeId ? (
                        <button
                          className="admin-activity-place"
                          onClick={() => onOpen(entry.placeId!)}
                        >
                          {entry.name || 'Địa điểm'} <ArrowRight size={14} />
                        </button>
                      ) : (
                        <strong className="admin-activity-target">
                          {entry.name}
                        </strong>
                      )}
                      <p>
                        {failed && entry.action !== 'catalog.run_failed'
                          ? 'Thao tác chưa hoàn tất. Xem thông tin hỗ trợ để đối chiếu khi cần.'
                          : (copy?.result ??
                            'Lịch sử chưa có mô tả chi tiết cho hoạt động này.')}
                      </p>
                      <small className="admin-activity-actor">
                        Người thực hiện:{' '}
                        <strong>
                          {entry.actor || 'Chưa rõ người thực hiện'}
                        </strong>
                      </small>
                      {entry.note && (
                        <blockquote>
                          <span>Ghi chú của người xử lý</span>
                          {entry.note}
                        </blockquote>
                      )}
                      {entry.action === 'catalog.run_failed' && (
                        <a
                          className="admin-activity-followup"
                          href="#automatic"
                        >
                          Xem đợt thu thập <ArrowRight size={14} />
                        </a>
                      )}
                      <details className="admin-activity-support">
                        <summary>Thông tin hỗ trợ</summary>
                        <dl>
                          <dt>Mã hoạt động</dt>
                          <dd>{entry.id}</dd>
                          <dt>Loại hoạt động</dt>
                          <dd>{entry.action}</dd>
                          <dt>Thời điểm</dt>
                          <dd>
                            {dayLabel(entry.occurredAt)} ·{' '}
                            {clockLabel(entry.occurredAt)}
                          </dd>
                          <dt>Kết quả được lưu</dt>
                          <dd>{entry.outcome || 'Chưa ghi nhận'}</dd>
                          {entry.entityRevision != null && (
                            <>
                              <dt>Phiên bản nội dung</dt>
                              <dd>
                                {entry.previousRevision != null
                                  ? `${entry.previousRevision} → `
                                  : ''}
                                {entry.entityRevision}
                              </dd>
                            </>
                          )}
                          {entry.campaignId && (
                            <>
                              <dt>Mã đợt thu thập</dt>
                              <dd>{entry.campaignId}</dd>
                            </>
                          )}
                          {entry.runId && (
                            <>
                              <dt>Mã lượt xử lý</dt>
                              <dd>{entry.runId}</dd>
                            </>
                          )}
                          {entry.batchId && (
                            <>
                              <dt>Mã lần xử lý theo lô</dt>
                              <dd>{entry.batchId}</dd>
                            </>
                          )}
                        </dl>
                      </details>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <footer className="admin-activity-pagination">
          <span>
            Trang {Math.floor(offset / 30) + 1}
            {items.length > 0 && ` · ${items.length} hoạt động`}
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
              Xem hoạt động cũ hơn
            </button>
          </div>
        </footer>
      </section>
      <aside className="admin-history-guide">
        <section className="admin-panel">
          <span className="admin-history-guide-icon">
            <Clock3 size={22} />
          </span>
          <h2>Việc nào đang chờ bạn?</h2>
          <p>
            Nhật ký cho biết những gì đã xảy ra. Các việc cần kiểm tra và quyết
            định nằm trong danh sách chờ duyệt.
          </p>
          <button className="journey-primary" onClick={onReviews}>
            Xem việc chờ duyệt <ArrowRight size={15} />
          </button>
        </section>
        <section className="admin-panel">
          <h2>Theo dõi việc lấy dữ liệu</h2>
          <p>
            Xem đợt đang chạy, kết quả thu thập và phần bị lỗi tại màn hình
            riêng.
          </p>
          <a href="#automatic">
            Mở Đợt thu thập <ArrowRight size={15} />
          </a>
        </section>
        <p className="admin-history-hint">
          <Info size={17} /> Nhật ký hiển thị hoạt động toàn hệ thống. Thông tin
          cũ có thể chưa ghi đầy đủ chi tiết.
        </p>
      </aside>
    </div>
  );
}
