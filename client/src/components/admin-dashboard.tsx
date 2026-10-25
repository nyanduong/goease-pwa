import { AdminPageHeader, AdminPlaceImage } from './admin-visuals';
import { AdminSourceConnection } from './admin-campaigns';
import { catalogQuality } from '@goease/contracts';
import { AdminRegionSettings } from './admin-region-settings';
import { AdminDestinations } from './admin-destinations';
import { DestinationRegions, matchesRegion } from './destination-regions';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  MapPin,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Database,
  RefreshCw,
  Plus,
  Clock,
  Search,
  Bell,
  SlidersHorizontal,
} from 'lucide-react';
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
export function AdminTopbar({
  destinations,
  scope,
  onScope,
  name,
  showScope = true,
}: {
  destinations: DestinationDto[];
  scope: string;
  onScope: (s: string) => void;
  name: string;
  showScope?: boolean;
}) {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(''),
    [subregion, setSubregion] = useState('');
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('admin-search')?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <header className="admin-topbar">
      {showScope && (
        <>
          <details className="admin-region-filters">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" />
              Lọc miền / vùng
              {(region || subregion) && (
                <span className="admin-filter-dot" aria-label="Đang lọc" />
              )}
            </summary>
            <DestinationRegions
              region={region}
              subregion={subregion}
              onChange={(r, s) => {
                setRegion(r);
                setSubregion(s);
              }}
            />
          </details>
          <label className="admin-region">
            <MapPin size={19} />
            <select
              aria-label="Khu vực quản lý"
              value={scope}
              onChange={(e) => onScope(e.target.value)}
            >
              <option value="">Tất cả điểm đến · chỉ xem</option>
              {destinations
                .filter(
                  (d) => d.id === scope || matchesRegion(d, region, subregion),
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      <form
        className="admin-global-search"
        onSubmit={(e) => {
          e.preventDefault();
          location.hash = `places?q=${encodeURIComponent(q)}`;
        }}
      >
        <Search size={19} />
        <input
          id="admin-search"
          aria-label="Tìm kiếm toàn danh mục"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm địa điểm, quán ăn, địa chỉ…"
          maxLength={100}
        />
        <kbd>Ctrl K</kbd>
      </form>
      <a
        className="admin-bell"
        href="#work"
        aria-label="Thông báo và việc cần làm"
      >
        <Bell size={21} />
      </a>
      <div className="admin-profile">
        <span>{name.slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{name}</strong>
          <small>Quản trị viên</small>
        </div>
      </div>
    </header>
  );
}

export function AdminDashboard({
  scope,
  screen,
  operations,
  onOpen,
  destinations,
}: {
  scope: string;
  screen: 'overview' | 'sources' | 'settings';
  operations: CatalogOperationsDto | null;
  onOpen: (id: string) => void;
  destinations: DestinationDto[];
}) {
  const [data, setData] = useState<AdminOverview | null>(null),
    [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setError('');
    setNotice('');
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
  }, [scope, screen, retry]);
  async function save() {
    if (!settings) return;
    setBusy(true);
    setError('');
    setNotice('');
    const { revision, ...fields } = settings;
    try {
      setSettings(
        await api<AdminSettings>('/admin/catalog/settings', {
          method: 'PUT',
          body: JSON.stringify({ ...fields, expectedRevision: revision }),
        }),
      );
      setNotice(
        'Đã lưu cấu hình. Quy tắc được áp dụng cho lần kiểm tra tiếp theo.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được cấu hình.');
    } finally {
      setBusy(false);
    }
  }
  const title = {
    overview: 'Tổng quan',
    sources: 'Nguồn dữ liệu',
    settings: 'Cài đặt',
  }[screen];
  const region =
    destinations.find((d) => d.id === scope)?.name ?? 'tất cả khu vực';
  const href = (filter: string) => `#places?${filter}`;
  const qualityLink = (code: string) =>
    ['price', 'hours', 'location'].includes(code)
      ? href(`quality=${code}`)
      : '#work';
  return (
    <section className="admin-v2-content">
      <AdminPageHeader
        title={title}
        region={region}
        illustrated={screen === 'overview'}
        greeting={screen === 'overview'}
        description={
          screen === 'overview'
            ? 'Theo dõi địa điểm và những việc cần xử lý.'
            : screen === 'sources'
              ? 'Quản lý nguồn dữ liệu, theo dõi chất lượng và xử lý thông tin cần kiểm tra.'
              : 'Quản lý khu vực hiển thị và cách cập nhật dữ liệu.'
        }
        actions={
          screen === 'overview' ? (
            <div className="admin-actions">
              <a className="journey-outline" href="#places?create=1">
                <Plus size={16} /> Thêm địa điểm
              </a>
              <a className="journey-primary" href="#work">
                Xem việc cần kiểm tra <ArrowUpRight size={16} />
              </a>
            </div>
          ) : undefined
        }
      />

      {error && (
        <div className="admin-alert" role="alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Thử tải lại</button>
        </div>
      )}
      {notice && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}
      {screen === 'sources' && <AdminSourceConnection />}
      {screen === 'settings' && <AdminDestinations />}
      {!data && !error && (
        <p role="status">Đang tổng hợp dữ liệu từ danh mục…</p>
      )}
      {data && settings && (
        <>
          {screen === 'settings' ? (
            <div className="admin-settings-grid">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
                className="admin-panel"
              >
                <h2>Phạm vi & kiểm tra chất lượng</h2>
                <fieldset disabled={busy}>
                  <label>
                    Khu vực mặc định
                    <select
                      value={settings.defaultDestinationId ?? ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultDestinationId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Tất cả điểm đến · chỉ xem</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nhắc kiểm tra sau số ngày chưa biên tập
                    <input
                      type="number"
                      min={7}
                      max={365}
                      value={settings.freshnessDays}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          freshnessDays: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.showQualityAlerts}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          showQualityAlerts: e.target.checked,
                        })
                      }
                    />
                    Hiển thị cảnh báo chất lượng trên tổng quan
                  </label>
                  <div className="admin-soft-notice">
                    Tự động áp dụng dùng quy tắc có phiên bản.{' '}
                    <a href="#rules">Tạo và mô phỏng quy tắc →</a>. Quy tắc đã
                    chốt trong một đợt không đổi khi sửa cài đặt.
                  </div>
                  <AdminRegionSettings
                    settings={settings}
                    onChange={setSettings}
                    destinations={destinations}
                  />
                  <button className="journey-primary" type="submit">
                    {busy ? 'Đang lưu…' : 'Lưu cài đặt'}
                  </button>
                </fieldset>
              </form>
              <aside className="admin-panel">
                <h2>Giới hạn bảo vệ hệ thống</h2>
                <p>
                  Giới hạn hiện hành: 50 kết quả/lượt, 20 lượt tìm/giờ toàn hệ
                  thống, 10 lượt/người/giờ, tối đa 2 lần gọi nguồn đồng thời.
                </p>
                <p>
                  Nguồn mới không tự ghi đè nội dung đã biên tập. Không tự xuất
                  bản hoặc xóa địa điểm.
                </p>
                <a href="#automatic">Thiết lập lịch cập nhật →</a>
                <hr />
                <h2>Nguồn & bảo mật</h2>
                <p>
                  Khóa nguồn nằm ở máy chủ. Người vận hành không cần dán khóa
                  vào trình duyệt.
                </p>
                <a href="#sources">Kiểm tra nguồn dữ liệu →</a>
              </aside>
            </div>
          ) : (
            <>
              <div className="admin-kpi-grid">
                {[
                  {
                    title: 'Tổng địa điểm',
                    value: data.total,
                    icon: MapPin,
                    link: href('status=all'),
                    tone: 'blue',
                    note: 'Trong khu vực đang xem',
                  },
                  {
                    title: 'Địa điểm nháp',
                    value: data.draft,
                    icon: FileText,
                    link: href('status=draft'),
                    tone: 'amber',
                    note: 'Chưa hiển thị cho khách',
                  },
                  {
                    title: 'Cần kiểm tra',
                    value: data.needsAttention,
                    icon: AlertTriangle,
                    link: '#work',
                    tone: 'orange',
                    note: 'Cần bổ sung hoặc đối chiếu',
                  },
                  {
                    title: 'Đã xuất bản',
                    value: data.published,
                    icon: CheckCircle2,
                    link: href('status=published'),
                    tone: 'green',
                    note: 'Khách có thể tìm thấy',
                  },
                ].map((k) => (
                  <a
                    className={`admin-kpi ${k.tone}`}
                    href={k.link}
                    key={k.title}
                  >
                    <span className="admin-kpi-icon">
                      <k.icon size={25} />
                    </span>
                    <div>
                      <span>{k.title}</span>
                      <strong>{k.value.toLocaleString('vi-VN')}</strong>
                      <small>{k.note}</small>
                    </div>
                    <ArrowUpRight size={17} />
                  </a>
                ))}
              </div>
              {!data.total && (
                <div className="admin-empty">
                  <h2>Bắt đầu xây dựng danh mục</h2>
                  <p>
                    Thêm một địa điểm có nguồn hoặc chạy thử nguồn đã kết nối.
                    Dữ liệu mới được giữ ở bản nháp.
                  </p>
                  <a href="#places?create=1">Thêm địa điểm đầu tiên →</a>
                </div>
              )}
              {screen === 'overview' ? (
                <>
                  <div className="admin-dashboard-grid">
                    <section className="admin-panel">
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
                                <ArrowUpRight size={16} />
                              </button>
                            ))
                        ) : (
                          <p>
                            Chưa phát hiện khoảng trống theo các quy tắc đang
                            kiểm tra.
                          </p>
                        )
                      ) : (
                        <p>
                          Cảnh báo tổng quan đang tắt.{' '}
                          <a href="#settings">Mở cài đặt</a>
                        </p>
                      )}
                    </section>
                    <section className="admin-panel">
                      <div className="admin-panel-title">
                        <h2>Địa điểm trên bản đồ</h2>
                        <a href="#places?view=map">Mở bản đồ →</a>
                      </div>
                      <AdminMap places={data.places} onOpen={onOpen} />
                      {data.mapTruncated && (
                        <small>
                          Bản đồ tổng quan giới hạn 500 địa điểm. Chọn khu vực
                          để thu hẹp.
                        </small>
                      )}
                    </section>
                    <aside className="admin-panel admin-quick">
                      <h2>Thao tác nhanh</h2>
                      {[
                        {
                          icon: Plus,
                          title: 'Thêm địa điểm mới',
                          note: 'Tạo bản nháp có nguồn',
                          link: '#places?create=1',
                        },
                        {
                          icon: Database,
                          title: 'Nhập địa điểm',
                          note: 'Xem trước dữ liệu nguồn',
                          link: '#places?import=1',
                        },
                        {
                          icon: RefreshCw,
                          title: 'Cập nhật tự động',
                          note: 'Chạy ngay hoặc đặt lịch',
                          link: '#automatic',
                        },
                        {
                          icon: Clock,
                          title: 'Xem lịch sử',
                          note: 'Theo dõi thay đổi và kết quả',
                          link: '#history',
                        },
                      ].map((a) => (
                        <a key={a.title} href={a.link}>
                          <a.icon size={23} />
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
                        {data.jobs.active} lượt đang xử lý ·{' '}
                        {data.jobs.succeeded} thành công · {data.jobs.failed}{' '}
                        thất bại
                      </p>
                      {operations?.runs.slice(0, 3).map((r) => (
                        <a
                          key={r.id}
                          href="#history"
                          className="admin-run-summary"
                        >
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
                              {r.counts.created} mới · {r.counts.review} cần đối
                              chiếu
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
                        Đồng bộ thành công gần nhất:{' '}
                        {date(data.sources.lastSuccess)}
                      </p>
                      {data.sources.lastError && (
                        <p className="admin-warning">
                          {data.sources.lastError}
                        </p>
                      )}
                      <a href="#sources">Kiểm tra chi tiết nguồn →</a>
                    </section>
                  </div>
                </>
              ) : (
                <>
                  <section className="admin-panel admin-source-card">
                    <Database size={36} />
                    <div>
                      <h2>Geoapify / OpenStreetMap</h2>
                      <p>
                        {operations?.connected
                          ? 'Đã cấu hình khóa trên máy chủ'
                          : 'Chưa kết nối'}
                        .{' '}
                        {data.sources.lastSuccess
                          ? 'Đã có lượt đồng bộ thành công.'
                          : 'Chưa có lần lấy dữ liệu thành công.'}
                      </p>
                      <small>
                        Powered by Geoapify · © OpenStreetMap contributors ·
                        ODbL-1.0
                      </small>
                    </div>
                    <a className="journey-outline" href="#automatic">
                      Chạy kiểm tra
                    </a>
                  </section>
                  <div className="admin-bottom-grid">
                    <Quality data={data} />
                    <section className="admin-panel">
                      <h2>Hoạt động nguồn</h2>
                      <dl>
                        <dt>Địa điểm từ Geoapify</dt>
                        <dd>{data.sources.geoapify}</dd>
                        <dt>Biên tập / nguồn thủ công</dt>
                        <dd>{data.sources.manual}</dd>
                        <dt>Lần thử gần nhất</dt>
                        <dd>{date(data.sources.lastAttempt)}</dd>
                        <dt>Lần thành công gần nhất</dt>
                        <dd>{date(data.sources.lastSuccess)}</dd>
                      </dl>
                      {data.sources.lastError && (
                        <p role="alert">{data.sources.lastError}</p>
                      )}
                    </section>
                    <section className="admin-panel">
                      <h2>Quy tắc ưu tiên dữ liệu</h2>
                      <ol>
                        <li>Nội dung admin đã biên tập được giữ lại.</li>
                        <li>Nguồn mới lưu bằng chứng để đối chiếu.</li>
                        <li>
                          Thay đổi tên, vị trí, loại hình hoặc đóng cửa cần được
                          kiểm tra.
                        </li>
                        <li>
                          Chỉ giờ của bản nháp chưa biên tập được tự áp dụng khi
                          đã bật.
                        </li>
                      </ol>
                      <a href="#rules">Cấu hình quy tắc →</a>
                    </section>
                  </div>
                  <section className="admin-panel">
                    <h2>Vấn đề dữ liệu</h2>
                    {data.issues.map((i) => (
                      <a
                        href={qualityLink(i.code)}
                        className="admin-issue-row"
                        key={i.code}
                      >
                        <span>{i.label}</span>
                        <strong>{i.count}</strong>
                        <ArrowUpRight size={17} />
                      </a>
                    ))}
                    <details>
                      <summary>Hướng dẫn kết nối cho người thiết lập</summary>
                      <p>
                        Đặt GEOAPIFY_API_KEY trong server/.env và khởi động lại
                        API. Không đưa khóa vào VITE_* hoặc trình duyệt. Mỗi
                        điểm đến cần lưu và bật phạm vi trong Cài đặt.
                      </p>
                    </details>
                  </section>
                </>
              )}
            </>
          )}
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
        <div
          className="admin-quality-ring"
          style={{
            background: `conic-gradient(#39ad7c ${percent}%, #eaf0ea 0)`,
          }}
        >
          <div>
            <strong>{active ? `${percent}%` : '—'}</strong>
            <small>Đủ 6 tiêu chí</small>
          </div>
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
      <small>
        6 nhóm trường: tên, giới thiệu, địa chỉ, thời lượng, nguồn và giá. Độ
        đầy đủ không đồng nghĩa dữ liệu hợp lệ, còn hiệu lực hoặc đã xác minh;
        khả năng khám phá, Goe và ngân sách được kiểm tra riêng.
      </small>
    </section>
  );
}
