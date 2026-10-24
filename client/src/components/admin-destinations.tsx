import { useCallback, useEffect, useRef, useState } from 'react';
import {
  tourismRegions,
  type AdminDestinationDto,
  type DestinationInput,
} from '@goease/contracts';
import { api } from '../api';
import { DestinationRegions } from './destination-regions';

type Form = Omit<DestinationInput, 'tourismRegion'> & {
  tourismRegion: DestinationInput['tourismRegion'] | '';
};
const blank = (): Form => ({
  name: '',
  slug: '',
  summary: '',
  tourismRegion: '',
  publicationStatus: 'draft',
});
export function AdminDestinations() {
  const generation = useRef(0);
  const [rows, setRows] = useState<AdminDestinationDto[]>([]),
    [more, setMore] = useState(false);
  const [region, setRegion] = useState(''),
    [subregion, setSubregion] = useState('');
  const [q, setQ] = useState(''),
    [offset, setOffset] = useState(0),
    [reload, setReload] = useState(0);
  const [form, setForm] = useState(blank),
    [editing, setEditing] = useState<AdminDestinationDto | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const request = useRef<{
    payload: string;
    identity: string;
    key: string;
  } | null>(null);
  const load = useCallback(async () => {
    const attempt = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q,
        offset: String(offset),
        limit: '20',
        ...(region ? { region } : {}),
        ...(subregion ? { tourismRegion: subregion } : {}),
      });
      const data = await api<{
        items: AdminDestinationDto[];
        hasMore: boolean;
      }>(`/admin/destinations?${params}`);
      if (attempt === generation.current) {
        setRows(data.items);
        setMore(data.hasMore);
      }
    } catch (e) {
      if (attempt === generation.current)
        setError(e instanceof Error ? e.message : 'Chưa tải được điểm đến.');
    } finally {
      if (attempt === generation.current) setLoading(false);
    }
  }, [region, subregion, q, offset]);
  useEffect(() => {
    void load();
  }, [load, reload]);
  async function save() {
    if (busy) return;
    const payload = JSON.stringify({
      destination: form,
      ...(editing ? { expectedRevision: editing.revision } : {}),
    });
    const identity = `${editing?.id ?? 'new'}:${payload}`;
    if (request.current?.identity !== identity)
      request.current = { identity, payload, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(
        editing ? `/admin/destinations/${editing.id}` : '/admin/destinations',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Idempotency-Key': request.current.key },
          body: request.current.payload,
        },
      );
      setNotice(
        'Đã lưu điểm đến và phân vùng. Cấu hình nguồn nhập riêng trước khi chạy nhập dữ liệu.',
      );
      setForm(blank());
      setEditing(null);
      request.current = null;
      setReload((v) => v + 1);
      window.dispatchEvent(new Event('goease-destinations-changed'));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa lưu được. Thông tin bạn nhập vẫn được giữ.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="admin-panel admin-destination-manager"
      aria-label="Điểm đến và phân vùng"
    >
      <h2>Điểm đến & phân vùng Việt Nam</h2>
      <p>
        3 miền, 8 vùng du lịch. Miền Tây thuộc miền Nam. Đây là phân vùng biên
        tập du lịch, không thay thế đơn vị hành chính. Điểm đến được xuất bản
        chỉ dùng Goe khi có đủ địa điểm, bữa ăn, giá và giờ phù hợp.
      </p>
      <DestinationRegions
        region={region}
        subregion={subregion}
        onChange={(r, s) => {
          setRegion(r);
          setSubregion(s);
          setOffset(0);
        }}
      />
      <label>
        Tìm điểm đến
        <input
          value={q}
          maxLength={100}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void load()}>Tải lại điểm đến</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Đang tải điểm đến…</p>
      ) : !rows.length ? (
        <p>
          Chưa có điểm đến trong vùng này. Thêm điểm đến để chuẩn bị nhập dữ
          liệu.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Điểm đến</th>
                <th>Vùng du lịch</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>
                    {tourismRegions.find((r) => r.code === d.tourismRegion)
                      ?.name ?? 'Chưa phân vùng'}
                  </td>
                  <td>
                    {d.publicationStatus === 'published'
                      ? 'Đang hiển thị'
                      : d.publicationStatus === 'archived'
                        ? 'Đã lưu trữ'
                        : 'Bản nháp'}
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(d);
                        setForm({
                          name: d.name,
                          slug: d.slug,
                          summary: d.summary,
                          tourismRegion: d.tourismRegion ?? '',
                          publicationStatus: d.publicationStatus,
                        });
                        setNotice('');
                      }}
                    >
                      Sửa {d.name}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="admin-actions">
        <button
          disabled={loading || offset === 0}
          onClick={() => setOffset((v) => Math.max(0, v - 20))}
        >
          Trang điểm đến trước
        </button>
        <button
          disabled={loading || !more}
          onClick={() => setOffset((v) => v + 20)}
        >
          Trang điểm đến sau
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h3>{editing ? `Sửa điểm đến: ${editing.name}` : 'Thêm điểm đến'}</h3>
        <fieldset disabled={busy}>
          <label>
            Tên điểm đến
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Đường dẫn điểm đến
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
              placeholder="vi-du-ha-giang"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </label>
          <label>
            Vùng của điểm đến
            <select
              required
              value={form.tourismRegion}
              onChange={(e) =>
                setForm({
                  ...form,
                  tourismRegion: e.target
                    .value as DestinationInput['tourismRegion'],
                })
              }
            >
              <option value="">Chọn vùng du lịch</option>
              {tourismRegions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giới thiệu điểm đến
            <textarea
              maxLength={1000}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <label>
            Trạng thái điểm đến
            <select
              value={form.publicationStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  publicationStatus: e.target
                    .value as DestinationInput['publicationStatus'],
                })
              }
            >
              <option value="draft">Bản nháp</option>
              <option value="published">Đang hiển thị</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </label>
          <button type="submit" className="journey-primary">
            {busy ? 'Đang lưu điểm đến…' : 'Lưu điểm đến'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(blank());
              }}
            >
              Thêm điểm đến khác
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
