import { useCallback, useEffect, useRef, useState } from 'react';
import { tourismRegions, type AdminDestinationDto } from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { DestinationRegions } from './destination-regions';

type Pending = {
  id: string;
  name: string;
  enabled: boolean;
  payload: string;
  key: string;
};
export function AdminDestinations() {
  const generation = useRef(0);
  const [rows, setRows] = useState<AdminDestinationDto[]>([]);
  const [region, setRegion] = useState(''),
    [subregion, setSubregion] = useState('');
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
      const params = new URLSearchParams({
        q,
        limit: '200',
        ...(region ? { region } : {}),
        ...(subregion ? { tourismRegion: subregion } : {}),
      });
      const data = await api<{ items: AdminDestinationDto[] }>(
        `/admin/destinations?${params}`,
      );
      if (attempt === generation.current) setRows(data.items);
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
  }, [region, subregion, q]);
  useEffect(() => {
    void load();
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
  return (
    <section
      className="admin-panel admin-destination-manager"
      aria-label="Danh mục tỉnh thành"
    >
      <h2>Danh mục tỉnh/thành Việt Nam</h2>
      <p>
        34 tỉnh/thành được nạp sẵn. Bật để khách chọn khi tạo chuyến; tắt sẽ ẩn
        tỉnh/thành và các địa điểm bên trong khỏi khám phá. Nội dung đã biên tập
        và chuyến đã lưu được giữ lại.
      </p>
      <p>
        Hội An là khu vực bên trong Đà Nẵng; Sa Pa thuộc Lào Cai. Bật hiển thị
        chưa có nghĩa đủ dữ liệu cho Goe. Lịch thu thập được quản lý riêng trong
        Quy tắc &amp; lịch.
      </p>
      <details>
        <summary>Nguồn danh mục và phân vùng</summary>
        <p>
          <a
            href="https://chinhphu.vn/?classid=1&amp;docid=214409&amp;orggroupid=3&amp;pageid=27160"
            target="_blank"
            rel="noreferrer"
          >
            Quyết định 19/2025/QĐ-TTg
          </a>
          , hiệu lực 01/07/2025. Danh mục có phiên bản, không tự đổi theo nguồn
          mạng.
        </p>
        <p>
          3 miền và 8 vùng là phân nhóm du lịch của GoEase. Một tỉnh sau sáp
          nhập có thể trải trên nhiều vùng; phân nhóm này không mô tả ranh giới
          hành chính. Khu vực du lịch bên trong hiện có Hội An và Sa Pa, chưa
          phải danh sách đầy đủ.
        </p>
      </details>
      <fieldset disabled={busy || !!pending}>
        <DestinationRegions
          region={region}
          subregion={subregion}
          onChange={(r, s) => {
            setRegion(r);
            setSubregion(s);
          }}
        />
        <label>
          Tìm tỉnh/thành hoặc khu vực
          <input
            value={q}
            maxLength={100}
            placeholder="Hà Nội, Hội An, Sa Pa…"
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </fieldset>
      {error && (
        <div role="alert">
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
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Đang tải tỉnh/thành…</p>
      ) : !rows.length ? (
        <p>Không có tỉnh/thành phù hợp bộ lọc.</p>
      ) : (
        <>
          <p>
            {rows.length} tỉnh/thành trong danh sách ·{' '}
            {rows.filter((d) => d.publicationStatus === 'published').length}{' '}
            đang bật
          </p>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tỉnh/thành</th>
                  <th>Vùng du lịch</th>
                  <th>Hiển thị cho khách</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                      {d.provinceCode && <small> · Mã {d.provinceCode}</small>}
                      {!!d.tourismAreas?.length && (
                        <p>Khu vực: {d.tourismAreas.join(', ')}</p>
                      )}
                    </td>
                    <td>
                      {tourismRegions.find((r) => r.code === d.tourismRegion)
                        ?.name ?? 'Chưa phân vùng'}
                    </td>
                    <td>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.publicationStatus === 'published'}
                        aria-label={`Hiển thị ${d.name}`}
                        disabled={busy || !!pending || !d.provinceCode}
                        onClick={() => {
                          const enabled = d.publicationStatus !== 'published';
                          if (
                            !enabled &&
                            !confirm(
                              `Tắt ${d.name}? Khách sẽ không thấy tỉnh/thành và các địa điểm bên trong. Chuyến đã lưu được giữ nguyên; lịch thu thập không thay đổi.`,
                            )
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
                        {busy && pending?.id === d.id
                          ? 'Đang lưu…'
                          : d.publicationStatus === 'published'
                            ? 'Đang bật · Tắt'
                            : 'Đang tắt · Bật'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
