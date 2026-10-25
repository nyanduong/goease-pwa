import { AdminPageHeader, AdminPlaceImage } from './admin-visuals';
import { catalogQuality } from '@goease/contracts';
import { useEffect, useState } from 'react';
import type {
  AdminOverview,
  AdminSettings,
  DestinationDto,
  CatalogOperationsDto,
} from '@goease/contracts';
import { api } from '../api';
import { AdminMap } from './admin-map';

const date = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Chưa có';
export function AdminDashboard({
  scope,
  operations,
  onOpen,
  destinations,
}: {
  scope: string;
  operations: CatalogOperationsDto | null;
  onOpen: (id: string) => void;
  destinations: DestinationDto[];
}) {
  const [data, setData] = useState<AdminOverview | null>(null),
    [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setData(null);
    void Promise.all([
      api<AdminOverview>(
        `/admin/catalog/overview${scope ? `?destinationId=${scope}` : ''}`,
      ),
      api<AdminSettings>('/admin/catalog/settings'),
    ])
      .then(([d, s]) => {
        if (active) {
          setData(d);
          setSettings(s);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được dữ liệu.');
      });
    return () => {
      active = false;
    };
  }, [scope, retry]);
  const region =
    destinations.find((d) => d.id === scope)?.name ?? 'tất cả khu vực';
  const href = (filter: string) => `#places?${filter}`;
  return (
    <section className="admin-v2-content">
      <AdminPageHeader
        title="Tổng quan"
        region={region}
        description="Theo dõi địa điểm và những việc cần xử lý."
        actions={
          <div className="admin-actions">
            <a className="journey-outline" href="#places?create=1">
              Thêm địa điểm
            </a>
            <a className="journey-primary" href="#work">
              Xem việc cần kiểm tra
            </a>
          </div>
        }
      />
      {error && (
        <div className="admin-alert" role="alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Thử tải lại</button>
        </div>
      )}
      {!data && !error && (
        <p role="status">Đang tổng hợp dữ liệu từ danh mục…</p>
      )}
      {data && settings && (
        <>
          <div className="admin-kpi-grid" aria-label="Số liệu danh mục">
            {[
              {
                title: 'Tổng địa điểm',
                value: data.total,

                link: href('status=all'),
                tone: 'blue',
              },
              {
                title: 'Địa điểm nháp',
                value: data.draft,

                link: href('status=draft'),
                tone: 'amber',
              },
              {
                title: 'Cần kiểm tra',
                value: data.needsAttention,

                link: '#work',
                tone: 'orange',
              },
              {
                title: 'Đã xuất bản',
                value: data.published,

                link: href('status=published'),
                tone: 'green',
              },
            ].map((k) => (
              <a className={`admin-kpi ${k.tone}`} href={k.link} key={k.title}>
                <div>
                  <span>{k.title}</span>
                  <strong>{k.value.toLocaleString('vi-VN')}</strong>
                </div>
              </a>
            ))}
          </div>
          {!data.total && (
            <div className="admin-empty">
              <h2>Bắt đầu xây dựng danh mục</h2>
              <p>
                Thêm một địa điểm có nguồn hoặc chạy thử nguồn đã kết nối. Dữ
                liệu mới được giữ ở bản nháp.
              </p>
              <a href="#places?create=1">Thêm địa điểm đầu tiên →</a>
            </div>
          )}
          <>
            <div className="admin-dashboard-grid">
              <section className="admin-panel admin-work-panel">
                <div className="admin-panel-title">
                  <h2>Cần xử lý ({data.needsAttention})</h2>
                  <a href="#work">Xem việc cần làm →</a>
                </div>
                {settings.showQualityAlerts ? (
                  data.issues.length ? (
                    [...data.places]
                      .filter(
                        (p) =>
                          p.publicationStatus !== 'archived' &&
                          catalogQuality(p, settings.freshnessDays).issues
                            .length,
                      )
                      .sort(
                        (a, b) =>
                          Number(b.publicationStatus === 'published') -
                          Number(a.publicationStatus === 'published'),
                      )
                      .slice(0, 4)
                      .map((p) => (
                        <button
                          className="admin-task-preview"
                          key={p.id}
                          onClick={() => onOpen(p.id)}
                        >
                          <AdminPlaceImage place={p} />
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {
                                catalogQuality(p, settings.freshnessDays)
                                  .issues[0]?.label
                              }
                            </small>
                          </span>
                        </button>
                      ))
                  ) : (
                    <p>
                      Chưa phát hiện khoảng trống theo các quy tắc đang kiểm
                      tra.
                    </p>
                  )
                ) : (
                  <p>
                    Cảnh báo tổng quan đang tắt.{' '}
                    <a href="#settings">Mở cài đặt</a>
                  </p>
                )}
              </section>
              <details className="admin-panel admin-overview-map">
                <summary>Xem địa điểm trên bản đồ</summary>
                <div className="admin-panel-title">
                  <a href="#places?view=map">Mở bản đồ →</a>
                </div>
                <AdminMap places={data.places} onOpen={onOpen} />
                {data.mapTruncated && (
                  <small>
                    Bản đồ tổng quan giới hạn 500 địa điểm. Chọn khu vực để thu
                    hẹp.
                  </small>
                )}
              </details>
              <aside className="admin-panel admin-quick">
                <h2>Thao tác nhanh</h2>
                {[
                  {
                    title: 'Thêm địa điểm mới',
                    note: 'Tạo bản nháp có nguồn',
                    link: '#places?create=1',
                  },
                  {
                    title: 'Nhập địa điểm',
                    note: 'Xem trước dữ liệu nguồn',
                    link: '#places?import=1',
                  },
                  {
                    title: 'Cập nhật tự động',
                    note: 'Chạy ngay hoặc đặt lịch',
                    link: '#automatic',
                  },
                  {
                    title: 'Xem lịch sử',
                    note: 'Theo dõi thay đổi và kết quả',
                    link: '#history',
                  },
                ].map((a) => (
                  <a key={a.title} href={a.link}>
                    <div>
                      <strong>{a.title}</strong>
                      <small>{a.note}</small>
                    </div>
                  </a>
                ))}
              </aside>
            </div>
            <div className="admin-bottom-grid">
              <section className="admin-panel">
                <h2>Lần chạy tự động gần nhất</h2>
                <p>
                  {data.jobs.active} lượt đang xử lý · {data.jobs.succeeded}{' '}
                  thành công · {data.jobs.failed} thất bại
                </p>
                {operations?.runs.slice(0, 3).map((r) => (
                  <a key={r.id} href="#history" className="admin-run-summary">
                    <span
                      className={`admin-status status-${r.state === 'succeeded' ? 'published' : 'draft'}`}
                    >
                      {r.state === 'succeeded'
                        ? 'Hoàn tất'
                        : r.state === 'failed'
                          ? 'Cần xử lý'
                          : 'Đang xử lý'}
                    </span>
                    <div>
                      <strong>{date(r.createdAt)}</strong>
                      <small>
                        {r.counts.created} mới · {r.counts.review} cần đối chiếu
                      </small>
                    </div>
                  </a>
                ))}
                {!operations?.runs.length && (
                  <p>
                    Chưa có lượt cập nhật.{' '}
                    <a href="#automatic">Thiết lập nguồn và lịch</a>
                  </p>
                )}
              </section>
              <Quality data={data} />
              <section className="admin-panel">
                <h2>Nguồn & cảnh báo</h2>
                <p>
                  {operations?.connected
                    ? 'Geoapify đã cấu hình khóa'
                    : 'Geoapify chưa kết nối'}
                </p>
                <p>
                  Đồng bộ thành công gần nhất: {date(data.sources.lastSuccess)}
                </p>
                {data.sources.lastError && (
                  <p className="admin-warning">{data.sources.lastError}</p>
                )}
                <a href="#sources">Kiểm tra chi tiết nguồn →</a>
              </section>
            </div>
          </>
        </>
      )}
    </section>
  );
}
function Quality({ data }: { data: AdminOverview }) {
  const active = data.total - data.archived,
    percent = active ? Math.round((data.complete / active) * 100) : 0;
  return (
    <section className="admin-panel">
      <h2>Độ đầy đủ thông tin</h2>
      <div className="admin-quality-wrap">
        <strong className="admin-quality-number">
          {active ? `${percent}%` : '—'}
        </strong>
        <div
          className="admin-quality-track"
          role="progressbar"
          aria-label="Độ đầy đủ thông tin"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={active ? percent : undefined}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <div>
          <p>
            <strong>{data.complete}</strong> địa điểm đủ thông tin
          </p>
          <p>
            <strong>{active - data.complete}</strong> cần bổ sung
          </p>
          <a href="#sources">Xem chất lượng →</a>
        </div>
      </div>
      <details className="admin-detail-note">
        <summary>Cách tính</summary>
        <p>
          6 nhóm trường: tên, giới thiệu, địa chỉ, thời lượng, nguồn và giá. Độ
          đầy đủ không đồng nghĩa dữ liệu hợp lệ, còn hiệu lực hoặc đã xác minh;
          khả năng khám phá, Goe và ngân sách được kiểm tra riêng.
        </p>
      </details>
    </section>
  );
}
