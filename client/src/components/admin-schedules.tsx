import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  CatalogOperationsDto,
  CatalogScheduleInput,
  CatalogScheduleListDto,
  DestinationDto,
} from '@goease/contracts';
import { api } from '../api';
import { AdminPolicies } from './admin-policies';
import { Sheet } from './journey-sheet';
import { catalogTime } from './admin-review-utils';

type Schedule = CatalogOperationsDto['schedule'];
const groups = {
  mixed: 'Tham quan, nhà hàng và cà phê',
  sights: 'Địa điểm tham quan',
  restaurant: 'Nhà hàng',
  cafe: 'Quán cà phê',
};
const days = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];
const time = (s: Pick<Schedule, 'hour' | 'minute'>) =>
  `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
const timing = (
  s: Pick<Schedule, 'frequency' | 'weekday' | 'hour' | 'minute'>,
) =>
  `${s.frequency === 'daily' ? 'Hằng ngày' : `${days[s.weekday]} hằng tuần`} · ${time(s)}`;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
const toInput = (s: Schedule): CatalogScheduleInput => ({
  destinationId: s.destinationId,
  enabled: s.enabled,
  frequency: s.frequency,
  hour: s.hour,
  minute: s.minute,
  weekday: s.weekday,
  group: s.group,
  expectedRevision: s.revision,
});

export function AdminSchedules({
  destinations,
}: {
  destinations: DestinationDto[];
}) {
  const [tab, setTab] = useState<'schedules' | 'policies'>('schedules');
  const [policyScope, setPolicyScope] = useState('');
  const [items, setItems] = useState<Schedule[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Schedule | 'new' | null>(null);
  const [runsFor, setRunsFor] = useState<string | null>(null);
  const request = useRef({ body: '', key: '' });
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const all: Schedule[] = [];
      let more = true,
        sourceConnected = false;
      while (more) {
        const value = await api<CatalogScheduleListDto>(
          `/admin/catalog/schedules?offset=${all.length}`,
        );
        all.push(...value.items);
        more = value.hasMore && value.items.length > 0;
        sourceConnected = value.connected;
      }
      if (current === generation.current) {
        setItems(all);
        setConnected(sourceConnected);
      }
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error ? e.message : 'Chưa tải được danh sách lịch.',
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  async function save(input: CatalogScheduleInput) {
    const body = JSON.stringify(input);
    if (request.current.body !== body)
      request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setNotice('');
    try {
      const value = await api<CatalogOperationsDto>('/admin/catalog/schedule', {
        method: 'PUT',
        headers: { 'Idempotency-Key': request.current.key },
        body,
      });
      setItems((old) => [
        ...old.filter((s) => s.destinationId !== value.schedule.destinationId),
        value.schedule,
      ]);
      setConnected(value.connected);
      request.current = { body: '', key: '' };
      setNotice(
        input.enabled
          ? 'Đã lưu và bật lịch cập nhật.'
          : 'Đã tạm dừng lịch. Lượt đã nhận vẫn tiếp tục xử lý.',
      );
      setError('');
    } finally {
      setBusy(false);
    }
  }
  const name = (id?: string) =>
    destinations.find((d) => d.id === id)?.name ??
    'Khu vực không còn trong danh mục';
  const filtered = items
    .filter(
      (s) =>
        normalize(name(s.destinationId)).includes(normalize(query.trim())) &&
        (status === 'all' || s.enabled === (status === 'enabled')),
    )
    .sort((a, b) =>
      name(a.destinationId).localeCompare(name(b.destinationId), 'vi'),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  return (
    <section className="admin-v2-content admin-schedules">
      <div className="schedule-page-heading">
        <div>
          <h1>Tự động cập nhật</h1>
          <p>Quản lý lịch lấy dữ liệu cho từng khu vực.</p>
        </div>
        {tab === 'schedules' && items.length > 0 && (
          <button
            className="journey-primary"
            disabled={loading || busy || !!error}
            onClick={() => setEditor('new')}
          >
            <Plus size={18} /> Tạo lịch
          </button>
        )}
      </div>
      <div className="schedule-tabs" aria-label="Chế độ quản lý tự động">
        <button
          aria-pressed={tab === 'schedules'}
          onClick={() => setTab('schedules')}
        >
          <CalendarClock size={18} /> Lịch cập nhật
        </button>
        <button
          aria-pressed={tab === 'policies'}
          onClick={() => setTab('policies')}
        >
          Quy tắc nâng cao
        </button>
      </div>
      {tab === 'policies' ? (
        <>
          <div className="schedule-policy-intro">
            <h2>Tự xử lý thay đổi nào?</h2>
            <p>
              Quy tắc hiện hỗ trợ cập nhật giờ mở cửa của bản nháp đủ điều kiện.
              Chọn quy tắc khi tạo đợt thu thập; lịch định kỳ không tự dùng quy
              tắc đang chọn ở đây.
            </p>
            <label>
              Khu vực xem trước
              <select
                value={policyScope}
                onChange={(e) => setPolicyScope(e.target.value)}
              >
                <option value="">Chọn khu vực để mô phỏng</option>
                {destinations.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <AdminPolicies scope={policyScope} />
        </>
      ) : (
        <>
          {items.length > 0 && (
            <div className="schedule-explainer">
              <span>
                Dữ liệu mới vào bản nháp. Bạn duyệt trước khi hiển thị cho
                khách.
              </span>
            </div>
          )}
          {notice && (
            <p className="admin-success" role="status">
              {notice}
            </p>
          )}
          {error && (
            <div className="admin-alert" role="alert">
              {error}
              <button disabled={loading || busy} onClick={() => void load()}>
                Tải lại danh sách
              </button>
            </div>
          )}
          {!loading && !connected && !error && (
            <p className="admin-alert">
              Chưa cấu hình kết nối nguồn.{' '}
              <a href="#sources">Kiểm tra nguồn dữ liệu →</a>
            </p>
          )}
          {items.length > 0 && (
            <div className="schedule-toolbar">
              <label>
                <Search size={18} />
                <input
                  aria-label="Tìm khu vực có lịch"
                  placeholder="Tìm khu vực..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <select
                aria-label="Trạng thái lịch"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="enabled">Đang bật</option>
                <option value="paused">Tạm dừng</option>
              </select>
            </div>
          )}
          {loading ? (
            <p role="status" className="admin-empty">
              Đang tải lịch cập nhật…
            </p>
          ) : (
            <>
              <div
                className="schedule-list"
                aria-label="Danh sách lịch cập nhật"
              >
                {visible.map((s) => (
                  <article
                    className="schedule-row"
                    key={s.destinationId}
                    aria-label={`Lịch ${name(s.destinationId)}`}
                  >
                    <span className="schedule-icon">
                      <CalendarClock size={24} />
                    </span>
                    <div className="schedule-location">
                      <h2>{name(s.destinationId)}</h2>
                      <p>{groups[s.group]}</p>
                    </div>
                    <div className="schedule-timing">
                      <strong>{timing(s)}</strong>
                      <small>
                        {s.enabled
                          ? `Lần tới: ${catalogTime(s.nextRunAt)}`
                          : 'Chưa có lần chạy tiếp theo'}
                      </small>
                    </div>
                    <span
                      className={`schedule-status ${s.enabled ? 'is-on' : ''}`}
                    >
                      {s.enabled ? 'Đang bật' : 'Tạm dừng'}
                    </span>
                    <button
                      className="schedule-toggle"
                      role="switch"
                      aria-checked={s.enabled}
                      aria-label={`Tự động cập nhật ${name(s.destinationId)}`}
                      disabled={busy || !!error || (!s.enabled && !connected)}
                      onClick={() => {
                        void save({ ...toInput(s), enabled: !s.enabled }).catch(
                          (e: unknown) =>
                            setError(
                              e instanceof Error
                                ? e.message
                                : 'Chưa đổi được trạng thái lịch.',
                            ),
                        );
                      }}
                    >
                      <span />
                    </button>
                    <button
                      className="schedule-edit"
                      disabled={busy || !!error}
                      onClick={() => setEditor(s)}
                    >
                      <Pencil size={15} /> Chỉnh sửa
                    </button>
                    <button
                      className="schedule-run-link"
                      onClick={() => setRunsFor(s.destinationId!)}
                    >
                      Lần chạy
                    </button>
                  </article>
                ))}
              </div>
              {!visible.length && !error && (
                <div
                  className={`admin-empty${!items.length ? ' schedule-empty-start' : ''}`}
                >
                  <h2>
                    {items.length
                      ? 'Không tìm thấy lịch phù hợp'
                      : 'Chưa có lịch cập nhật'}
                  </h2>
                  <p>
                    {items.length
                      ? 'Thử tên khu vực khác hoặc bỏ bộ lọc.'
                      : 'Chọn khu vực và thời gian lấy dữ liệu. Kết quả được lưu thành bản nháp để bạn kiểm tra.'}
                  </p>
                  {items.length ? (
                    <button
                      onClick={() => {
                        setQuery('');
                        setStatus('all');
                        setPage(1);
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  ) : (
                    <button
                      className="journey-primary"
                      onClick={() => setEditor('new')}
                    >
                      Tạo lịch đầu tiên
                    </button>
                  )}
                </div>
              )}
              <footer className="schedule-list-footer">
                {items.length > 0 && (
                  <span aria-live="polite">
                    {filtered.length} lịch cập nhật
                    {pages > 1 ? ` · Trang ${currentPage}/${pages}` : ''}
                  </span>
                )}
                {pages > 1 && (
                  <div>
                    <button
                      aria-label="Trang trước"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      aria-label="Trang sau"
                      disabled={currentPage === pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
                <a href="#automatic">Xem các đợt thu thập →</a>
              </footer>
            </>
          )}
          <p className="schedule-footnote">
            Giờ Việt Nam · Mỗi khu vực có một lịch. Hệ thống cần hoạt động để
            lịch chạy.
          </p>
        </>
      )}
      {editor && (
        <ScheduleEditor
          schedule={editor === 'new' ? null : editor}
          destinations={destinations}
          existing={items}
          connected={connected}
          busy={busy}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
      {runsFor && (
        <ScheduleRuns
          destinationId={runsFor}
          name={name(runsFor)}
          onClose={() => setRunsFor(null)}
        />
      )}
    </section>
  );
}

function ScheduleRuns({
  destinationId,
  name,
  onClose,
}: {
  destinationId: string;
  name: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CatalogOperationsDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const key = useRef('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const value = await api<CatalogOperationsDto>(
          `/admin/catalog/operations?destinationId=${destinationId}`,
        );
        if (active) {
          setData(value);
          setError('');
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được lần chạy.');
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [destinationId, reload]);
  async function run() {
    setBusy(true);
    setError('');
    key.current ||= crypto.randomUUID();
    try {
      await api('/admin/catalog/run', {
        method: 'POST',
        headers: { 'Idempotency-Key': key.current },
        body: JSON.stringify({ destinationId }),
      });
      key.current = '';
      setReload((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa bắt đầu được lượt cập nhật.',
      );
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    paused: 'Đã tạm dừng',
    queued: 'Đang chờ',
    running: 'Đang lấy dữ liệu',
    retry: 'Sẽ tự thử lại',
    succeeded: 'Đã hoàn tất',
    failed: 'Cần xử lý',
  };
  return (
    <Sheet title={`Lần chạy · ${name}`} onClose={onClose}>
      <div className="schedule-run-body">
        <p>
          30 lần gần nhất của khu vực, gồm lượt theo lịch và lượt yêu cầu thủ
          công.
        </p>
        {error && (
          <p role="alert" className="admin-alert">
            {error}
            <button onClick={() => setReload((v) => v + 1)}>Tải lại</button>
          </p>
        )}
        {!data && !error && <p role="status">Đang tải lần chạy…</p>}
        {data && (
          <>
            <button
              className="journey-primary"
              disabled={
                busy ||
                !!error ||
                !data.connected ||
                data.runs.some((r) =>
                  ['queued', 'running', 'retry'].includes(r.state),
                )
              }
              onClick={() => void run()}
            >
              {busy ? 'Đang gửi…' : 'Chạy ngay'}
            </button>
            {!data.runs.length && <p>Chưa có lần chạy nào.</p>}
            {data.runs.map((r) => (
              <details className="admin-run" key={r.id}>
                <summary>
                  <strong>{labels[r.state]}</strong> ·{' '}
                  {catalogTime(r.createdAt)}
                </summary>
                <p>
                  {r.actor === 'system' ? 'Theo lịch' : 'Yêu cầu thủ công'} ·{' '}
                  {r.message || 'Đang chờ xử lý'}
                </p>
                {r.state === 'retry' && (
                  <p>Tự thử lại lúc {catalogTime(r.nextAttemptAt)}</p>
                )}
                <p>
                  {r.counts.created} mới · {r.counts.updated} cập nhật ·{' '}
                  {r.counts.review} cần kiểm tra · {r.counts.errors} lỗi
                </p>
              </details>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}

function ScheduleEditor({
  schedule,
  destinations,
  existing,
  connected,
  busy,
  onSave,
  onClose,
}: {
  schedule: Schedule | null;
  destinations: DestinationDto[];
  existing: Schedule[];
  connected: boolean;
  busy: boolean;
  onSave: (input: CatalogScheduleInput) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<CatalogScheduleInput>(
    schedule
      ? toInput(schedule)
      : {
          destinationId: '',
          enabled: true,
          frequency: 'weekly',
          hour: 2,
          minute: 0,
          weekday: 1,
          group: 'sights',
          expectedRevision: 0,
        },
  );
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [ready, setReady] = useState(!!schedule);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (schedule && !reload) return;
    setReady(false);
    if (!form.destinationId) return;
    let active = true;
    setReading(true);
    setError('');
    void api<CatalogOperationsDto>(
      `/admin/catalog/operations?destinationId=${form.destinationId}`,
    )
      .then((v) => {
        if (!active) return;
        if (!schedule && v.schedule.revision > 0) {
          setError(
            'Khu vực này đã có lịch. Đóng bảng và tải lại danh sách để chỉnh sửa.',
          );
          return;
        }
        // Reload is explicit: never silently apply an outdated edit to a newer revision.
        if (reload) setForm(toInput(v.schedule));
        else
          setForm((old) => ({ ...old, expectedRevision: v.schedule.revision }));
        setReady(true);
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Chưa đọc được lịch đã lưu.',
          );
      })
      .finally(() => {
        if (active) setReading(false);
      });
    return () => {
      active = false;
    };
  }, [form.destinationId, schedule, reload]);
  const selected = destinations.find((d) => d.id === form.destinationId);
  return (
    <dialog
      ref={dialog}
      className="schedule-sheet"
      aria-label={schedule ? 'Chỉnh sửa lịch cập nhật' : 'Tạo lịch cập nhật'}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <div>
          <h2>{schedule ? 'Chỉnh sửa lịch cập nhật' : 'Tạo lịch cập nhật'}</h2>
          <p>Chọn khu vực và thời gian muốn tự động lấy dữ liệu.</p>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          disabled={busy}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          void onSave(form)
            .then(onClose)
            .catch((e: unknown) =>
              setError(e instanceof Error ? e.message : 'Chưa lưu được lịch.'),
            );
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Khu vực
            <select
              required
              disabled={!!schedule}
              aria-label="Khu vực"
              value={form.destinationId}
              onChange={(e) => {
                setReady(false);
                setForm((v) => ({ ...v, destinationId: e.target.value }));
              }}
            >
              <option value="">Chọn khu vực</option>
              {destinations
                .filter(
                  (d) =>
                    d.id === schedule?.destinationId ||
                    !existing.some((s) => s.destinationId === d.id),
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Nhóm địa điểm
            <select
              aria-label="Nhóm địa điểm"
              value={form.group}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  group: e.target.value as CatalogScheduleInput['group'],
                }))
              }
            >
              {Object.entries(groups).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="schedule-sheet-time">
            <h3>Thời gian chạy</h3>
            <div className="schedule-frequency">
              {(['daily', 'weekly'] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  aria-pressed={form.frequency === f}
                  onClick={() => setForm((v) => ({ ...v, frequency: f }))}
                >
                  {f === 'daily' ? 'Hằng ngày' : 'Hằng tuần'}
                </button>
              ))}
            </div>
            <div className="schedule-time-inputs">
              {form.frequency === 'weekly' && (
                <label>
                  Ngày
                  <select
                    aria-label="Ngày"
                    value={form.weekday}
                    onChange={(e) =>
                      setForm((v) => ({
                        ...v,
                        weekday: Number(e.target.value),
                      }))
                    }
                  >
                    {days.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Giờ
                <input
                  type="time"
                  required
                  aria-label="Giờ"
                  value={time(form)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [hour, minute] = e.target.value
                      .split(':')
                      .map(Number);
                    setForm((v) => ({ ...v, hour: hour!, minute: minute! }));
                  }}
                />
              </label>
            </div>
            <small>Theo giờ Việt Nam (UTC+7)</small>
          </div>
          <div className="schedule-preview">
            <CalendarClock size={22} />
            <div>
              <h3>Lịch dự kiến</h3>
              <strong>{timing(form)}</strong>
              <p>
                {selected
                  ? `${groups[form.group]} tại ${selected.name}.`
                  : 'Chọn khu vực để hoàn tất lịch.'}
              </p>
              {schedule && !form.enabled && (
                <small>
                  Lịch đang tạm dừng. Lưu thay đổi không bật lại lịch.
                </small>
              )}
            </div>
          </div>
          <p className="schedule-safety">
            <ShieldCheck size={20} />
            Không tự xuất bản địa điểm
          </p>
          <p className="schedule-footnote">
            Lấy dữ liệu trong vùng tìm đã cấu hình, tối đa 50 kết quả/lượt;
            không bao phủ toàn tỉnh.{' '}
            <a href="#settings" onClick={onClose}>
              Xem cài đặt khu vực →
            </a>
          </p>
          {reading && <p role="status">Đang kiểm tra lịch của khu vực…</p>}
          {error && (
            <div className="admin-alert" role="alert">
              {error}
              <button
                type="button"
                disabled={reading}
                onClick={() => setReload((v) => v + 1)}
              >
                Nạp lại bản đã lưu
              </button>
            </div>
          )}
          {!connected && (
            <p className="admin-alert">Chưa cấu hình kết nối nguồn dữ liệu.</p>
          )}
        </fieldset>
        <footer>
          <p>Máy chủ cần hoạt động để lịch chạy.</p>
          <div>
            <button type="button" disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button
              className="journey-primary"
              disabled={
                busy ||
                reading ||
                !ready ||
                !form.destinationId ||
                (form.enabled && !connected)
              }
            >
              {busy
                ? 'Đang lưu…'
                : schedule
                  ? 'Lưu thay đổi'
                  : 'Tạo và bật lịch'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
