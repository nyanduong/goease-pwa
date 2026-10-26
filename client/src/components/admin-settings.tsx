import { useEffect, useState } from 'react';
import type { AdminSettings, DestinationDto } from '@goease/contracts';
import { ArrowRight, Info } from 'lucide-react';
import { api } from '../api';
import { AdminDestinations } from './admin-destinations';
import { AdminRegionSettings } from './admin-region-settings';

const tabs = [
  { id: 'destinations', name: 'Tỉnh/thành hiển thị' },
  { id: 'reminders', name: 'Nhắc kiểm tra dữ liệu' },
  { id: 'advanced', name: 'Thiết lập nâng cao' },
] as const;
type SettingsTab = (typeof tabs)[number]['id'];

export function AdminSettingsPage({
  destinations,
}: {
  destinations: DestinationDto[];
}) {
  const [tab, setTab] = useState<SettingsTab>('destinations');
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setError('');
    void api<AdminSettings>('/admin/catalog/settings')
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được cài đặt.');
      });
    return () => {
      active = false;
    };
  }, [retry]);
  async function save() {
    if (!settings || busy) return;
    setError('');
    setNotice('');
    if (
      !Number.isInteger(settings.freshnessDays) ||
      settings.freshnessDays < 7 ||
      settings.freshnessDays > 365
    ) {
      setTab('reminders');
      setError('Số ngày nhắc kiểm tra phải là số nguyên từ 7 đến 365.');
      return;
    }
    setBusy(true);
    try {
      const { revision, ...fields } = settings;
      setSettings(
        await api<AdminSettings>('/admin/catalog/settings', {
          method: 'PUT',
          body: JSON.stringify({ ...fields, expectedRevision: revision }),
        }),
      );
      setNotice(
        'Đã lưu cài đặt. Các lần kiểm tra tiếp theo sẽ dùng thiết lập này.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được cài đặt.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-v2-content admin-settings-page">
      <header className="settings-heading">
        <h1>Cài đặt</h1>
        <p>Chọn nơi khách có thể khám phá và thiết lập cách quản lý dữ liệu.</p>
      </header>
      <div className="settings-tabs" role="tablist" aria-label="Nhóm cài đặt">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            id={`settings-tab-${item.id}`}
            aria-controls={`settings-panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                return;
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? tabs.length - 1
                    : (index +
                        (e.key === 'ArrowRight' ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              setTab(tabs[next]!.id);
              document
                .getElementById(`settings-tab-${tabs[next]!.id}`)
                ?.focus();
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="settings-panel-destinations"
        aria-labelledby="settings-tab-destinations"
        hidden={tab !== 'destinations'}
      >
        <AdminDestinations />
      </div>
      <div hidden={tab === 'destinations' || (!error && !notice && !!settings)}>
        {error && (
          <div className="admin-alert" role="alert">
            {error}
            {!settings && (
              <button onClick={() => setRetry((v) => v + 1)}>
                Thử tải lại cài đặt
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="admin-success" role="status">
            {notice}
          </p>
        )}
        {!settings && !error && <p role="status">Đang tải cài đặt…</p>}
      </div>
      <div
        role="tabpanel"
        id="settings-panel-reminders"
        aria-labelledby="settings-tab-reminders"
        hidden={tab !== 'reminders'}
      >
        {settings && (
          <form
            className="admin-panel settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <h2>Khi nào cần kiểm tra lại địa điểm?</h2>
            <p>Nhắc người vận hành rà soát thông tin lâu chưa được biên tập.</p>
            <fieldset disabled={busy}>
              <label>
                Nhắc kiểm tra sau số ngày chưa biên tập
                <input
                  type="number"
                  min={7}
                  max={365}
                  required
                  value={settings.freshnessDays}
                  onChange={(e) => {
                    setNotice('');
                    setSettings({
                      ...settings,
                      freshnessDays: Number(e.target.value),
                    });
                  }}
                />
                <small>
                  Từ 7 đến 365 ngày. Đây là lời nhắc, không tự ẩn hoặc xuất bản
                  địa điểm.
                </small>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={settings.showQualityAlerts}
                  onChange={(e) => {
                    setNotice('');
                    setSettings({
                      ...settings,
                      showQualityAlerts: e.target.checked,
                    });
                  }}
                />
                Hiển thị cảnh báo chất lượng trên tổng quan
              </label>
              <button type="submit" className="journey-primary">
                {busy ? 'Đang lưu…' : 'Lưu cài đặt'}
              </button>
            </fieldset>
          </form>
        )}
      </div>
      <div
        role="tabpanel"
        id="settings-panel-advanced"
        aria-labelledby="settings-tab-advanced"
        hidden={tab !== 'advanced'}
      >
        {settings && (
          <div className="settings-advanced-grid">
            <form
              className="admin-panel settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <h2>Phạm vi vận hành</h2>
              <p>Dành cho người thiết lập vùng tìm kiếm dữ liệu.</p>
              <fieldset disabled={busy}>
                <label>
                  Khu vực mặc định
                  <select
                    value={settings.defaultDestinationId ?? ''}
                    onChange={(e) => {
                      setNotice('');
                      setSettings({
                        ...settings,
                        defaultDestinationId: e.target.value || null,
                      });
                    }}
                  >
                    <option value="">Tất cả điểm đến · chỉ xem</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <AdminRegionSettings
                  settings={settings}
                  onChange={(value) => {
                    setNotice('');
                    setSettings(value);
                  }}
                  destinations={destinations}
                />
                <button type="submit" className="journey-primary">
                  {busy ? 'Đang lưu…' : 'Lưu cài đặt'}
                </button>
              </fieldset>
            </form>
            <aside className="admin-panel settings-help">
              <Info size={24} />
              <h2>Lịch thu thập và nguồn dữ liệu</h2>
              <p>
                Bật hiển thị tỉnh/thành và lịch thu thập là hai thiết lập riêng.
                Các đợt đã tạo giữ phạm vi và quy tắc tại thời điểm tạo.
              </p>
              <a href="#rules">
                Mở quy tắc & lịch <ArrowRight size={16} />
              </a>
              <a href="#sources">
                Kiểm tra kết nối nguồn <ArrowRight size={16} />
              </a>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
