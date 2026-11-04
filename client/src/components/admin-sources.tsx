import { AdminPageHelp } from './admin-page-help';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Database,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from '../icons';
import type { AdminOverview, AdminSourceStatus } from '@goease/contracts';
import { api } from '../api';
import { Sheet } from './journey-sheet';

const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Chưa có';
const states: Record<
  AdminSourceStatus['connectionState'],
  { label: string; tone: string; description: string }
> = {
  fetched: {
    label: 'Đã nhận dữ liệu thành công',
    tone: 'good',
    description: 'Có thể xem hoạt động và hạn mức trong chi tiết.',
  },
  not_configured: {
    label: 'Chưa kết nối',
    tone: 'neutral',
    description: 'Cần cấu hình kết nối trước khi lấy dữ liệu.',
  },
  not_checked: {
    label: 'Chưa kiểm chứng kết nối',
    tone: 'neutral',
    description: 'Đã cấu hình khóa. Chạy một đợt thu thập để kiểm tra nguồn.',
  },
  checking: {
    label: 'Đang lấy dữ liệu',
    tone: 'pending',
    description: 'Nguồn đang được xử lý. Làm mới để xem trạng thái tiếp theo.',
  },
  permission_denied: {
    label: 'Nguồn chưa cho phép truy cập',
    tone: 'warning',
    description: 'Kiểm tra khóa và quyền truy cập trong cấu hình nguồn.',
  },
  failed: {
    label: 'Lần lấy gần nhất bị lỗi',
    tone: 'warning',
    description:
      'Mở chi tiết để xem lỗi và chuyển đến đợt thu thập để thử lại.',
  },
};

export function AdminSources({
  scope,
  region,
}: {
  scope: string;
  region: string;
}) {
  const [source, setSource] = useState<AdminSourceStatus | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [overviewError, setOverviewError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<'sources' | 'quality'>('sources');
  const [modal, setModal] = useState<'details' | 'connect' | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSource(null);
    setOverview(null);
    setSourceError('');
    setOverviewError('');
    void Promise.allSettled([
      api<AdminSourceStatus>('/admin/v3/sources'),
      api<AdminOverview>(
        `/admin/catalog/overview${scope ? `?destinationId=${scope}` : ''}`,
      ),
    ]).then(([status, data]) => {
      if (!active) return;
      if (status.status === 'fulfilled') setSource(status.value);
      else
        setSourceError(
          status.reason instanceof Error
            ? status.reason.message
            : 'Chưa tải được trạng thái nguồn.',
        );
      if (data.status === 'fulfilled') setOverview(data.value);
      else
        setOverviewError(
          data.reason instanceof Error
            ? data.reason.message
            : 'Chưa tải được kho địa điểm.',
        );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [scope, retry]);

  const refresh = () => setRetry((value) => value + 1);
  const state = source ? states[source.connectionState] : null;
  const places = (filter: string) =>
    `#places?${filter}${scope ? `&destinationId=${scope}` : ''}`;
  const work = `#work${scope ? `?destinationId=${scope}` : ''}`;
  const issueLink = (code: string) =>
    ['price', 'hours', 'location'].includes(code)
      ? places(`quality=${code}`)
      : work;

  return (
    <section className="admin-v2-content admin-sources-page">
      <header className="sources-heading">
        <div>
          <div className="admin-title-line">
            <h1>Nguồn dữ liệu</h1>
            <AdminPageHelp title="Nguồn dữ liệu" />
          </div>
        </div>
        <button
          className="journey-outline"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={16} /> {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </header>
      <div
        className="sources-tabs"
        role="tablist"
        aria-label="Nguồn và chất lượng"
      >
        {(['sources', 'quality'] as const).map((key) => (
          <button
            key={key}
            id={`sources-tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`sources-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              if (
                ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'sources'
                    : event.key === 'End'
                      ? 'quality'
                      : key === 'sources'
                        ? 'quality'
                        : 'sources';
                setTab(next);
                document.getElementById(`sources-tab-${next}`)?.focus();
              }
            }}
          >
            {key === 'sources' ? 'Các nguồn' : 'Chất lượng địa điểm'}
            {key === 'quality' && overview && (
              <span>{overview.needsAttention.toLocaleString('vi-VN')}</span>
            )}
          </button>
        ))}
      </div>
      <div
        id="sources-panel-sources"
        role="tabpanel"
        aria-labelledby="sources-tab-sources"
        hidden={tab !== 'sources'}
      >
        <div className="sources-intro">
          <Database size={23} />
          <p>
            Chọn nguồn để xem tình trạng lấy dữ liệu và cấu hình kết nối.
            <small>Trạng thái nguồn áp dụng cho toàn hệ thống.</small>
          </p>
        </div>
        <div className="sources-section-heading">
          <h2>Nguồn cung cấp địa điểm</h2>
          <button
            className="journey-primary"
            onClick={() => setModal('connect')}
          >
            <Plus size={17} /> Kết nối nguồn
          </button>
        </div>
        {loading && (
          <p className="sources-loading" role="status">
            Đang đọc trạng thái nguồn…
          </p>
        )}
        {sourceError && (
          <div className="admin-alert" role="alert">
            {sourceError} <button onClick={refresh}>Thử tải lại nguồn</button>
          </div>
        )}
        <div className="sources-card-grid">
          {source && state && (
            <article className="sources-provider-card">
              <header>
                <span className="sources-provider-icon">
                  <Database size={28} />
                </span>
                <div>
                  <h3>Geoapify</h3>
                  <p>Dữ liệu từ OpenStreetMap</p>
                </div>
              </header>
              <p className={`sources-state is-${state.tone}`}>
                <span aria-hidden="true" />
                {state.label}
              </p>
              <p className="sources-provider-description">
                {state.description}
              </p>
              <dl>
                <div>
                  <dt>Lần nhận gần nhất</dt>
                  <dd>{time(source.lastFetchAt)}</dd>
                </div>
                <div>
                  <dt>Tìm kiếm trong 24 giờ</dt>
                  <dd>
                    {source.usage24h.requests.toLocaleString('vi-VN')} lượt
                  </dd>
                </div>
              </dl>
              <button
                className="journey-outline sources-card-action"
                onClick={() =>
                  setModal(source.configured ? 'details' : 'connect')
                }
              >
                {!source.configured
                  ? 'Cấu hình kết nối'
                  : ['failed', 'permission_denied'].includes(
                        source.connectionState,
                      )
                    ? 'Xem lỗi'
                    : 'Xem chi tiết'}
                <ArrowRight size={16} />
              </button>
            </article>
          )}
          {!loading && !sourceError && (
            <aside className="sources-add-card">
              <span className="sources-add-icon">
                <Plus size={24} />
              </span>
              <h3>Kết nối thêm nguồn</h3>
              <p>
                Hiện hỗ trợ Geoapify / OpenStreetMap. Nguồn khác cần được tích
                hợp trước khi sử dụng.
              </p>
              <button onClick={() => setModal('connect')}>
                Xem hướng dẫn <ArrowRight size={15} />
              </button>
            </aside>
          )}
        </div>
      </div>
      <div
        id="sources-panel-quality"
        role="tabpanel"
        aria-labelledby="sources-tab-quality"
        hidden={tab !== 'quality'}
      >
        <div className="sources-section-heading">
          <div>
            <h2>Chất lượng địa điểm</h2>
            <p>Thông tin cần kiểm tra tại {region}.</p>
          </div>
          <a href={work}>
            Mở hàng chờ <ArrowRight size={16} />
          </a>
        </div>
        {overview && (
          <section className="admin-panel sources-quality-list">
            {overview.issues.length ? (
              <>
                <p>
                  Một địa điểm có thể có nhiều vấn đề. Các số dưới đây không
                  cộng thành tổng địa điểm.
                </p>
                {overview.issues.map((issue) => (
                  <a
                    key={issue.code}
                    className="admin-issue-row"
                    href={issueLink(issue.code)}
                  >
                    <span>{issue.label}</span>
                    <strong>{issue.count.toLocaleString('vi-VN')}</strong>
                    <ArrowRight size={16} />
                  </a>
                ))}
              </>
            ) : (
              <div className="sources-quality-empty">
                <ShieldCheck size={28} />
                <h3>Chưa có vấn đề cần kiểm tra</h3>
                <p>
                  {overview.total
                    ? 'Chưa phát hiện vấn đề theo các quy tắc hiện tại.'
                    : 'Kho địa điểm trong khu vực này đang trống.'}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
      {loading && <p role="status">Đang tải kho địa điểm…</p>}
      {overviewError && (
        <div className="admin-alert" role="alert">
          {overviewError}{' '}
          <button onClick={refresh}>Thử tải lại kho địa điểm</button>
        </div>
      )}
      {overview && (
        <>
          <section
            className="sources-store"
            aria-label="Dữ liệu đã lưu vào GoEase"
          >
            <div className="sources-store-title">
              <h2>Dữ liệu đã lưu vào GoEase</h2>
              <p>{scope ? `Trong khu vực ${region}` : 'Tất cả khu vực'}</p>
            </div>
            <dl>
              {[
                {
                  label: 'địa điểm',
                  value: overview.total,
                  filter: 'status=all',
                },
                {
                  label: 'bản nháp',
                  value: overview.draft,
                  filter: 'status=draft',
                },
                {
                  label: 'đã xuất bản',
                  value: overview.published,
                  filter: 'status=published',
                },
                ...(overview.archived
                  ? [
                      {
                        label: 'đã lưu trữ',
                        value: overview.archived,
                        filter: 'status=archived',
                      },
                    ]
                  : []),
              ].map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>
                    <a
                      href={places(item.filter)}
                      aria-label={`${item.value} ${item.label}`}
                    >
                      {item.value.toLocaleString('vi-VN')}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <a href={places('status=all')} className="sources-store-link">
              Mở kho địa điểm <ArrowRight size={16} />
            </a>
            <small>
              Kết quả nhận từ nguồn có thể trùng hoặc chưa được lưu vào kho.
            </small>
          </section>
          <a
            href={work}
            className={`sources-attention${overview.needsAttention ? '' : ' is-clear'}`}
          >
            {overview.needsAttention ? (
              <TriangleAlert size={23} />
            ) : (
              <ShieldCheck size={23} />
            )}
            <span>
              <strong>
                {overview.needsAttention
                  ? `${overview.needsAttention.toLocaleString('vi-VN')} địa điểm có thông tin cần kiểm tra`
                  : 'Chưa có địa điểm cần kiểm tra'}
              </strong>
              <small>
                {overview.needsAttention
                  ? 'Bao gồm cả địa điểm nháp và đã xuất bản.'
                  : 'Theo các quy tắc chất lượng hiện tại.'}
              </small>
            </span>
            <span className="sources-attention-action">
              Kiểm tra chất lượng <ArrowRight size={16} />
            </span>
          </a>
        </>
      )}
      {modal && (
        <Sheet
          title={
            modal === 'connect'
              ? 'Kết nối nguồn dữ liệu'
              : 'Chi tiết nguồn Geoapify'
          }
          onClose={() => setModal(null)}
        >
          <div className="sources-detail">
            {modal === 'connect' ? (
              <>
                <div className="sources-detail-intro">
                  <Database size={26} />
                  <div>
                    <h3>Geoapify / OpenStreetMap</h3>
                    <p>Nguồn cung cấp địa điểm hiện được hỗ trợ.</p>
                  </div>
                </div>
                <h3>Thiết lập kết nối</h3>
                <ol>
                  <li>
                    Người thiết lập cấu hình khóa Geoapify trên máy chủ API.
                  </li>
                  <li>Khởi động lại API, rồi làm mới trạng thái nguồn.</li>
                  <li>
                    Mở Đợt thu thập và chạy một phạm vi nhỏ để kiểm chứng kết
                    nối.
                  </li>
                </ol>
                <p className="admin-soft-notice">
                  Khóa được giữ trên máy chủ. Cấu hình khóa thành công chưa đồng
                  nghĩa đã nhận dữ liệu.
                </p>
                <details>
                  <summary>Thông tin cho người thiết lập</summary>
                  <p>
                    Đặt GEOAPIFY_API_KEY trong cấu hình riêng của API. Không đưa
                    khóa vào VITE_* hoặc trình duyệt.
                  </p>
                </details>
                <h3>Thêm nhà cung cấp khác</h3>
                <p>
                  Cần bổ sung tích hợp và xác định quyền sử dụng dữ liệu trước
                  khi kết nối. Hiện chưa có thao tác thêm nhà cung cấp trực tiếp
                  trên màn hình này.
                </p>
                <a className="journey-primary" href="#automatic">
                  Mở đợt thu thập <ArrowRight size={16} />
                </a>
              </>
            ) : (
              <>
                {loading && <p role="status">Đang đọc trạng thái nguồn…</p>}
                {sourceError && (
                  <div role="alert" className="admin-alert">
                    {sourceError}
                    <button onClick={refresh}>Thử tải lại nguồn</button>
                  </div>
                )}
                {source && state && (
                  <>
                    <section className="sources-explainer">
                      <h3>Nguồn này dùng để làm gì?</h3>
                      <p>
                        GoEase dùng Geoapify để tìm địa điểm và xác định vùng
                        tìm kiếm. Thông tin địa điểm lấy từ OpenStreetMap, như
                        tên, địa chỉ, tọa độ và loại địa điểm.
                      </p>
                      <p>
                        <strong>
                          Dữ liệu nhận về chưa hiển thị ngay cho khách.
                        </strong>{' '}
                        Địa điểm mới được lưu thành bản nháp để kiểm tra trước
                        khi xuất bản.
                      </p>
                    </section>
                    <section
                      className={`sources-connection-summary is-${state.tone}`}
                    >
                      <h3>Tình trạng lần gọi gần nhất</h3>
                      <p className={`sources-state is-${state.tone}`}>
                        <span aria-hidden="true" />
                        {source.connectionState === 'fetched'
                          ? 'Geoapify đã trả phản hồi thành công'
                          : state.label}
                      </p>
                      <p>
                        {source.connectionState === 'fetched'
                          ? 'Muốn biết địa điểm nào đã được lưu, hãy mở kết quả của đợt thu thập.'
                          : state.description}
                      </p>
                      <small>
                        {source.checkedAt
                          ? `Ghi nhận lúc ${time(source.checkedAt)}`
                          : 'Chưa ghi nhận lần gọi nguồn.'}
                      </small>
                      <a href="#automatic">
                        {['failed', 'permission_denied'].includes(
                          source.connectionState,
                        )
                          ? 'Mở đợt bị lỗi để kiểm tra'
                          : 'Xem các đợt thu thập'}{' '}
                        <ArrowRight size={16} />
                      </a>
                    </section>
                    <h3>GoEase đã lấy dữ liệu thế nào trong 24 giờ qua?</h3>
                    <p className="sources-detail-caption">
                      Tính chung mọi khu vực và người vận hành. Đây là hoạt động
                      giữa GoEase và Geoapify, không phải lượt khách tìm kiếm
                      trên ứng dụng.
                    </p>
                    <dl className="sources-detail-list sources-explained-metrics">
                      <div>
                        <dt>
                          Yêu cầu lấy dữ liệu
                          <small>
                            Số lượt GoEase ghi nhận để tìm địa điểm hoặc tra
                            vùng tìm kiếm.
                          </small>
                        </dt>
                        <dd>{source.usage24h.requests} lượt</dd>
                      </div>
                      <div>
                        <dt>
                          Nhận phản hồi thành công
                          <small>
                            Nguồn trả lời thành công; kết quả vẫn có thể rỗng
                            hoặc trùng.
                          </small>
                        </dt>
                        <dd>{source.usage24h.fetched} lượt</dd>
                      </div>
                      <div>
                        <dt>
                          Kết quả nhận từ nguồn
                          <small>
                            Tổng kết quả qua các lượt gọi, gồm cả kết quả tra
                            vùng tìm kiếm.
                          </small>
                        </dt>
                        <dd>{source.usage24h.received} kết quả</dd>
                      </div>
                      <div>
                        <dt>
                          Không lấy được dữ liệu
                          <small>
                            Số lượt kết thúc với lỗi. Xem đợt thu thập để biết
                            nguyên nhân.
                          </small>
                        </dt>
                        <dd>{source.usage24h.failed} lượt</dd>
                      </div>
                    </dl>
                    <p className="admin-soft-notice">
                      <Info size={16} />{' '}
                      <strong>
                        {source.usage24h.received} kết quả không có nghĩa là{' '}
                        {source.usage24h.received} địa điểm mới.
                      </strong>{' '}
                      Một địa điểm có thể xuất hiện nhiều lần; kết quả có thể
                      chưa được nhập hoặc chỉ dùng để xác định vùng tìm kiếm.
                      Muốn xem số địa điểm thực tế, mở kho địa điểm.
                    </p>
                    <a
                      className="sources-detail-store-link"
                      href={places('status=all')}
                    >
                      Mở kho địa điểm tại {region} <ArrowRight size={16} />
                    </a>
                    <details>
                      <summary>GoEase được phép lấy bao nhiêu dữ liệu?</summary>
                      <p>
                        Các giới hạn do GoEase đặt ra để tránh gọi nguồn quá
                        nhiều. Đây không phải hạn mức hoặc số dư của gói
                        Geoapify.
                      </p>
                      <dl className="sources-detail-list">
                        <div>
                          <dt>Tất cả khu vực và người dùng cộng lại</dt>
                          <dd>
                            Tối đa {source.quota.requestsPerHour} lượt/giờ
                          </dd>
                        </div>
                        <div>
                          <dt>Mỗi người vận hành</dt>
                          <dd>
                            Tối đa {source.quota.requestsPerActorHour} lượt/giờ
                          </dd>
                        </div>
                        <div>
                          <dt>Số lượt có thể gọi nguồn cùng lúc</dt>
                          <dd>Tối đa {source.quota.concurrentSearches} lượt</dd>
                        </div>
                        <div>
                          <dt>Mỗi lượt tìm địa điểm yêu cầu nhiều nhất</dt>
                          <dd>{source.maxResultsPerRun} kết quả</dd>
                        </div>
                      </dl>
                      <p>
                        GoEase chưa đọc được số credits (đơn vị tính phí), số dư
                        hoặc chi phí thực tế của tài khoản Geoapify. Không thể
                        suy ra chi phí từ các con số ở trên.
                      </p>
                    </details>
                    <details>
                      <summary>Dùng dữ liệu này cần lưu ý gì?</summary>
                      <p>
                        Cần ghi công Geoapify và cộng đồng OpenStreetMap khi sử
                        dụng dữ liệu. Dữ liệu OpenStreetMap theo giấy phép
                        ODbL-1.0. Kết nối này không cung cấp quyền dùng ảnh; ảnh
                        địa điểm có nguồn và giấy phép riêng.
                      </p>
                    </details>
                    <details>
                      <summary>Thông tin kỹ thuật cho người hỗ trợ</summary>
                      <p>
                        Đã cấu hình khóa: {source.configured ? 'Có' : 'Chưa'}.
                        Khóa cấu hình chưa chứng minh lần gọi nguồn thành công.
                      </p>
                      {source.lastErrorCode && (
                        <p>
                          Mã lỗi gần nhất: <code>{source.lastErrorCode}</code>
                        </p>
                      )}
                      <p>
                        Lưu toàn bộ phản hồi gốc của nguồn:{' '}
                        {source.rights.rawPayloadStored
                          ? 'có, theo chính sách nguồn'
                          : 'không'}
                        .
                      </p>
                      <p>
                        Dữ liệu mới được nhập vào nháp. Nội dung admin đã biên
                        tập được giữ lại; thay đổi nguồn được đối chiếu theo quy
                        tắc hiện hành.
                      </p>
                      <a href="#rules">Mở quy tắc & lịch →</a>
                    </details>
                    <button
                      className="journey-outline"
                      onClick={refresh}
                      disabled={loading}
                    >
                      <RefreshCw size={16} /> Làm mới trạng thái
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </Sheet>
      )}
    </section>
  );
}
