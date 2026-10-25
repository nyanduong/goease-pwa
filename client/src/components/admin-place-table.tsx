import { useEffect, useRef } from 'react';
import { AdminPlaceImage } from './admin-visuals';
import type { AdminPlaceDto } from '@goease/contracts';
export function AdminPlaceTable({
  items,
  selected,
  onSelect,
  onSelectPage,
  onOpen,
  busy,
  allMatching = false,
}: {
  items: AdminPlaceDto[];
  selected: AdminPlaceDto[];
  onSelect: (p: AdminPlaceDto, checked: boolean) => void;
  onSelectPage: (checked: boolean) => void;
  onOpen: (id: string) => void;
  busy: boolean;
  allMatching?: boolean;
}) {
  const pageCheckbox = useRef<HTMLInputElement>(null);
  const checked =
    allMatching ||
    (items.length > 0 &&
      items.every((p) => selected.some((s) => s.id === p.id)));
  useEffect(() => {
    if (pageCheckbox.current)
      pageCheckbox.current.indeterminate =
        !checked && items.some((p) => selected.some((s) => s.id === p.id));
  }, [items, selected, checked]);
  return (
    <div className="admin-table-scroll catalog-library-scroll">
      <table className="admin-data-table catalog-library-table">
        <thead>
          <tr>
            <th className="catalog-select-cell">
              <input
                ref={pageCheckbox}
                type="checkbox"
                aria-label="Chọn toàn bộ trang hiện tại"
                checked={checked}
                disabled={busy || !items.length}
                onChange={(e) => onSelectPage(e.target.checked)}
              />
            </th>
            <th>Địa điểm</th>
            <th>Loại</th>
            <th>Cần hoàn thiện</th>
            <th>Trạng thái</th>
            <th>Cập nhật</th>
            <th>
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const isSelected =
              allMatching || selected.some((s) => s.id === p.id);
            const readiness = p.publicationReadiness;
            const published =
              p.publicationStatus === 'published' && p.proposalRevision == null;
            return (
              <tr key={p.id} className={isSelected ? 'is-selected' : ''}>
                <td className="catalog-select-cell">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${p.name}`}
                    checked={isSelected}
                    disabled={busy || (!isSelected && selected.length >= 50)}
                    onChange={(e) => onSelect(p, e.target.checked)}
                  />
                </td>
                <td>
                  <button
                    className="catalog-place-open"
                    onClick={() => onOpen(p.id)}
                    disabled={busy}
                    aria-label={`Mở ${p.name}`}
                  >
                    <span className="catalog-place-cover">
                      <AdminPlaceImage place={p} />
                    </span>
                    <span className="catalog-place-copy">
                      <h2>{p.name}</h2>
                      <span
                        className="catalog-place-address"
                        title={p.locationQuery}
                      >
                        <span>{p.locationQuery}</span>
                      </span>
                    </span>
                  </button>
                </td>
                <td data-label="Loại">
                  {p.category === 'food'
                    ? 'Ăn uống'
                    : p.category === 'culture'
                      ? 'Văn hóa'
                      : 'Thiên nhiên'}
                </td>
                <td data-label="Cần hoàn thiện">
                  <span
                    className={`catalog-readiness ${readiness?.ready ? 'is-ready' : published ? 'is-neutral' : 'is-missing'}`}
                    title="Máy chủ sẽ kiểm tra lại điều kiện và phiên bản khi xem trước/xuất bản."
                  >
                    <span>{readiness?.label ?? 'Xem trước để kiểm tra'}</span>
                  </span>
                </td>
                <td data-label="Trạng thái">
                  <span
                    className={`admin-status status-${p.publicationStatus}`}
                  >
                    {p.publicationStatus === 'published'
                      ? 'Đã xuất bản'
                      : p.publicationStatus === 'draft'
                        ? 'Bản nháp'
                        : 'Đã lưu trữ'}
                  </span>
                </td>
                <td data-label="Cập nhật">
                  <time dateTime={p.updatedAt}>
                    {new Date(p.updatedAt).toLocaleDateString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                    })}
                  </time>
                </td>
                <td className="catalog-edit-cell">
                  <button
                    className="catalog-edit-button"
                    disabled={busy}
                    aria-label={`Chỉnh sửa ${p.name}`}
                    onClick={() => onOpen(p.id)}
                  >
                    <span>Chỉnh sửa</span>
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
