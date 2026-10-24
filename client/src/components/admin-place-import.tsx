import { useRef, useState } from 'react';
import type {
  PlaceImportPreview,
  PlaceImportResult,
  PlaceImportSearch,
} from '@goease/contracts';
import { api } from '../api';
import { SourceCredit } from './source-credit';

const flags: Record<string, string> = {
  missing_address: 'Thiếu địa chỉ',
  missing_street: 'Thiếu tên đường',
  missing_house_number: 'Thiếu số nhà',
  address_truncated: 'Địa chỉ cần kiểm tra',
  missing_hours: 'Chưa có giờ mở cửa',
};
export function AdminPlaceImport({
  onBack,
  onOpen,
  destinationId,
}: {
  destinationId?: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const [group, setGroup] = useState<PlaceImportSearch['group']>('mixed');
  const [limit, setLimit] = useState<30 | 50>(50);
  const [preview, setPreview] = useState<PlaceImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [acknowledge, setAcknowledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PlaceImportResult | null>(null);
  const receipt = useRef({ payload: '', key: '' });
  const possible =
    preview?.items.some(
      (p) =>
        selected.includes(p.externalId) &&
        !p.existingPlaceId &&
        p.possibleDuplicates.length,
    ) ?? false;
  async function search() {
    if (busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPreview(null);
    setSelected([]);
    setAcknowledge(false);
    try {
      const value = await api<PlaceImportPreview>(
        '/admin/place-import/preview',
        {
          method: 'POST',
          body: JSON.stringify({
            group,
            limit,
            ...(destinationId ? { destinationId } : {}),
          }),
        },
      );
      setPreview(value);
      setSelected(
        value.items
          .filter((p) => !p.existingPlaceId && !p.possibleDuplicates.length)
          .map((p) => p.externalId),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa tìm được địa điểm. Hãy thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || !selected.length || busy || result) return;
    const payload = JSON.stringify({
      previewId: preview.previewId,
      externalIds: [...selected].sort(),
      acknowledgeDuplicates: acknowledge,
    });
    if (receipt.current.payload !== payload)
      receipt.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      setResult(
        await api<PlaceImportResult>('/admin/place-import/commit', {
          method: 'POST',
          headers: { 'Idempotency-Key': receipt.current.key },
          body: payload,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa xác nhận được kết quả nhập. Giữ lựa chọn và thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-import" aria-label="Nhập địa điểm từ Geoapify">
      <div className="admin-actions">
        <button disabled={busy} onClick={onBack}>
          ← Về danh mục
        </button>
      </div>
      <h2>Tìm và nhập địa điểm Hội An</h2>
      <p>
        Tìm trong phạm vi đã cấu hình của khu vực đang chọn (mặc định Hội An).
        Kết quả ưu tiên gần tâm tìm kiếm, không phải danh sách đầy đủ hay xếp
        hạng chất lượng.
      </p>
      <p>
        Chọn địa điểm để lưu bản nháp, sau đó mở từng mục để biên tập và xuất
        bản. Giá chưa rõ; ảnh là minh họa AI. Thời lượng mặc định 60 phút là ước
        tính cần chỉnh.
      </p>
      <SourceCredit expanded />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          Nhóm cần tìm
          <select
            value={group}
            disabled={busy}
            onChange={(e) =>
              setGroup(e.target.value as PlaceImportSearch['group'])
            }
          >
            <option value="mixed">Tham quan + nhà hàng + cà phê</option>
            <option value="sights">Tham quan</option>
            <option value="restaurant">Nhà hàng</option>
            <option value="cafe">Cà phê</option>
          </select>
        </label>
        <label>
          Số kết quả tối đa
          <select
            value={limit}
            disabled={busy}
            onChange={(e) => setLimit(Number(e.target.value) as 30 | 50)}
          >
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button className="journey-primary" disabled={busy} type="submit">
          {busy ? 'Đang xử lý…' : 'Tìm địa điểm'}
        </button>
      </form>
      {error && (
        <div role="alert" className="admin-alert">
          {error}
          <p>
            Lựa chọn đang xem vẫn được giữ. Nếu chưa rõ lần nhập có thành công
            không, bấm nhập lại với cùng lựa chọn.
          </p>
        </div>
      )}
      {result ? (
        <div role="status" className="admin-success">
          <h3>Đã tạo {result.created} bản nháp</h3>
          <p>
            Bỏ qua {result.existing} địa điểm đã có cùng mã nguồn. Khách chưa
            nhìn thấy các bản nháp mới.
          </p>
          <div className="admin-actions">
            {result.placeIds[0] && (
              <button onClick={() => onOpen(result.placeIds[0]!)}>
                Mở bản nháp đầu tiên
              </button>
            )}
          </div>
          <button onClick={onBack}>Về danh mục để biên tập</button>
        </div>
      ) : (
        preview && (
          <>
            <div className="admin-import-summary" role="status">
              <strong>
                {preview.items.length} địa điểm phù hợp / {preview.received} kết
                quả
              </strong>
              <p>
                Loại {preview.rejected} mục thiếu tên/thông tin hợp lệ hoặc
                ngoài phạm vi; gộp {preview.duplicateExternalIds} mã nguồn lặp.
                Bản xem trước hết hạn lúc{' '}
                {new Date(preview.expiresAt).toLocaleTimeString('vi-VN')}.
              </p>
            </div>
            {!preview.items.length ? (
              <p>
                Chưa có địa điểm phù hợp. Thử nhóm khác hoặc kiểm tra lại sau.
              </p>
            ) : (
              <>
                <div className="admin-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setSelected(
                        preview.items
                          .filter(
                            (p) =>
                              !p.existingPlaceId &&
                              !p.possibleDuplicates.length,
                          )
                          .map((p) => p.externalId),
                      );
                      setAcknowledge(false);
                    }}
                  >
                    Chọn mục mới không nghi trùng
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setSelected([]);
                      setAcknowledge(false);
                    }}
                  >
                    Bỏ chọn tất cả
                  </button>
                  <strong>Đã chọn {selected.length}</strong>
                </div>
                <div className="admin-import-list">
                  {preview.items.map((p) => (
                    <article key={p.externalId} className="admin-import-row">
                      <label className="admin-import-check">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${p.name}`}
                          checked={selected.includes(p.externalId)}
                          disabled={busy || !!p.existingPlaceId}
                          onChange={(e) => {
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, p.externalId]
                                : ids.filter((id) => id !== p.externalId),
                            );
                            setAcknowledge(false);
                          }}
                        />
                        <strong>{p.name}</strong>
                      </label>
                      <p>{p.address || 'Chưa có địa chỉ đầy đủ'}</p>
                      <small>
                        {p.category === 'food'
                          ? 'Ăn uống'
                          : p.category === 'nature'
                            ? 'Thiên nhiên'
                            : 'Tham quan'}{' '}
                        · {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)} · Vị
                        trí nguồn, chưa xác minh lối vào
                      </small>
                      <p>
                        {p.openingHoursNote
                          ? `Giờ từ nguồn, chưa xác minh: ${p.openingHoursNote}`
                          : 'Giờ mở cửa: Chưa rõ'}{' '}
                        · Giá: Chưa rõ
                      </p>
                      <p className="admin-import-flags">
                        {p.existingPlaceId
                          ? 'Đã có trong danh mục — sẽ bỏ qua'
                          : p.possibleDuplicates.length
                            ? `Nghi trùng: ${p.possibleDuplicates.join(', ')} — cần kiểm tra`
                            : 'Mới'}
                        {p.flags
                          .filter((f) => flags[f])
                          .map((f) => ` · ${flags[f]}`)}
                      </p>
                      <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                        Xem nguồn ↗
                      </a>
                      {p.existingPlaceId && (
                        <button
                          disabled={busy}
                          onClick={() => onOpen(p.existingPlaceId!)}
                        >
                          Mở mục đã có
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                {possible && (
                  <label className="admin-import-check">
                    <input
                      type="checkbox"
                      checked={acknowledge}
                      disabled={busy}
                      onChange={(e) => setAcknowledge(e.target.checked)}
                    />
                    Tôi đã kiểm tra các mục nghi trùng được chọn và vẫn muốn tạo
                    bản nháp riêng.
                  </label>
                )}
                <div className="admin-actions">
                  <button
                    className="journey-primary"
                    disabled={
                      busy || !selected.length || (possible && !acknowledge)
                    }
                    onClick={() => void commit()}
                  >
                    {busy ? 'Đang nhập…' : `Nhập ${selected.length} bản nháp`}
                  </button>
                  <p>
                    Không ghi đè dữ liệu đã có. Chỉ xuất bản sau khi bạn mở và
                    duyệt từng bản nháp.
                  </p>
                </div>
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
