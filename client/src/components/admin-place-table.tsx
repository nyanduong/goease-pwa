import { catalogQuality, type AdminPlaceDto } from '@goease/contracts';
import { Pencil } from 'lucide-react';
export function AdminPlaceTable({
  items,
  selected,
  onSelect,
  onOpen,
  busy,
}: {
  items: AdminPlaceDto[];
  selected: AdminPlaceDto[];
  onSelect: (p: AdminPlaceDto, checked: boolean) => void;
  onOpen: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-data-table">
        <thead>
          <tr>
            <th>Chọn</th>
            <th>Địa điểm</th>
            <th>Loại hình</th>
            <th>Độ đầy đủ</th>
            <th>Nguồn</th>
            <th>Cập nhật</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const quality = catalogQuality(p);
            return (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${p.name}`}
                    checked={selected.some((s) => s.id === p.id)}
                    disabled={
                      selected.length >= 50 &&
                      !selected.some((s) => s.id === p.id)
                    }
                    onChange={(e) => onSelect(p, e.target.checked)}
                  />
                </td>
                <td>
                  <div className="admin-place-identity">
                    <img
                      src={p.imageUrl ?? '/images/explore-hoian.png'}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                    <div>
                      <h2>{p.name}</h2>
                      <small>{p.locationQuery}</small>
                      <small>{p.imageCredit}</small>
                    </div>
                  </div>
                </td>
                <td>
                  {p.category === 'food'
                    ? 'Ăn uống'
                    : p.category === 'culture'
                      ? 'Văn hóa'
                      : 'Thiên nhiên'}
                </td>
                <td>
                  <strong>{quality.completeness}%</strong>
                  <progress
                    value={quality.completeness}
                    max={100}
                    aria-label={`Độ đầy đủ ${p.name}`}
                  />
                  <small>
                    {quality.issues.length
                      ? `${quality.issues.length} điểm cần kiểm tra`
                      : 'Đủ thông tin'}
                  </small>
                </td>
                <td>{p.source ? 'Geoapify / OSM' : 'Biên tập'}</td>
                <td>{new Date(p.updatedAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  <span
                    className={`admin-status status-${p.publicationStatus}`}
                  >
                    {p.publicationStatus === 'published'
                      ? 'Đã xuất bản'
                      : p.publicationStatus === 'draft'
                        ? 'Nháp'
                        : 'Lưu trữ'}
                  </span>
                </td>
                <td>
                  <button
                    disabled={busy}
                    aria-label={`Chỉnh sửa ${p.name}`}
                    onClick={() => onOpen(p.id)}
                  >
                    <Pencil size={16} /> Chỉnh sửa
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
