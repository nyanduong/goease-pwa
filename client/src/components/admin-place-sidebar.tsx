import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  MapPin,
  NotebookPen,
} from 'lucide-react';
import {
  adminPlaceInputSchema,
  catalogToday,
  type AdminPlaceDto,
  type AdminPlaceInput,
} from '@goease/contracts';
import { AdminMap } from './admin-map';

export type PlaceEditorTab = 'overview' | 'photos' | 'practical' | 'sources';
export function AdminPlaceSidebar({
  form,
  saved,
  update,
  onField,
  busy,
}: {
  form: AdminPlaceInput;
  saved: AdminPlaceDto | null;
  update: (patch: Partial<AdminPlaceInput>) => void;
  onField: (field: string) => void;
  busy: boolean;
}) {
  const validation = adminPlaceInputSchema.safeParse({
    ...form,
    publicationStatus: 'published',
  });
  const issues = new Map<string, string>();
  for (const issue of validation.error?.issues ?? []) {
    const field = String(issue.path[0] ?? 'description');
    const labels: Record<string, string> = {
      images: 'Chọn ảnh bìa',
      name: 'Kiểm tra tên địa điểm',
      destinationId: 'Chọn tỉnh / thành phố',
      description: 'Kiểm tra phần giới thiệu',
      locationQuery: 'Bổ sung địa chỉ',
      sourceUrl: 'Kiểm tra nguồn thông tin',
      referencePrice: 'Kiểm tra giá và điều kiện',
      durationMinutes: 'Kiểm tra thời gian tham quan',
    };
    issues.set(field, labels[field] ?? 'Kiểm tra thông tin địa điểm');
  }
  if (/địa điểm nhập từ|cần biên tập/i.test(form.description))
    issues.set('description', 'Kiểm tra phần giới thiệu');
  const mapPlace: AdminPlaceDto = {
    ...form,
    id: saved?.id ?? 'new',
    revision: saved?.revision ?? 0,
    updatedAt: saved?.updatedAt ?? new Date().toISOString(),
  };
  function point(patch: { latitude?: number; longitude?: number }) {
    update({
      mapLocation: {
        latitude: patch.latitude ?? form.mapLocation?.latitude ?? 0,
        longitude: patch.longitude ?? form.mapLocation?.longitude ?? 0,
        precision: 'area',
        label: form.name || 'Vị trí tham khảo',
        sourceUrl: form.sourceUrl,
        checkedAt: catalogToday(),
      },
    });
  }
  return (
    <aside className="place-editor-sidebar">
      <section
        className="place-editor-card place-publish-checklist"
        aria-label="Trước khi xuất bản"
      >
        <header>
          <ClipboardCheck size={22} />
          <h2>Trước khi xuất bản</h2>
        </header>
        <p>Kiểm tra và hoàn thiện các thông tin quan trọng.</p>
        <strong
          className={`place-readiness ${issues.size ? 'needs-review' : ''}`}
        >
          {issues.size
            ? `Cần kiểm tra ${issues.size} mục`
            : 'Đủ điều kiện kiểm tra xuất bản'}
        </strong>
        {!!form.name.trim() && !!form.locationQuery.trim() && (
          <div className="place-check-ok">
            <CheckCircle2 size={21} />
            Đã có tên và địa chỉ
          </div>
        )}
        {[...issues].map(([field, label]) => (
          <button
            type="button"
            key={field}
            className="place-check-action"
            onClick={() => onField(field)}
          >
            <CircleAlert size={20} />
            <span>{label}</span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
        <div className="place-extra-checks">
          <h3>Bổ sung khi có thông tin</h3>
          {!form.referencePrice && (
            <button type="button" onClick={() => onField('referencePrice')}>
              Giá tham khảo chưa xác minh →
            </button>
          )}
          {!form.openingHoursNote && (
            <button type="button" onClick={() => onField('openingHoursNote')}>
              Giờ mở cửa chưa xác minh →
            </button>
          )}
          <small>
            Giá và giờ chưa rõ không đồng nghĩa miễn phí hoặc mở cả ngày.
          </small>
        </div>
      </section>
      <section className="place-editor-card place-editor-map">
        <header>
          <MapPin size={21} />
          <h2>Vị trí tham khảo</h2>
        </header>
        <AdminMap places={[mapPlace]} />
        <small>Chưa xác minh lối vào</small>
        <details>
          <summary>Kiểm tra vị trí →</summary>
          <fieldset disabled={busy}>
            <p>
              Nhập tọa độ đã đối chiếu với nguồn. Vị trí này là tham khảo, chưa
              phải lối vào được xác minh.
            </p>
            <div className="admin-two">
              <label>
                Vĩ độ
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={form.mapLocation?.latitude ?? ''}
                  onChange={(e) =>
                    e.target.value === ''
                      ? update({ mapLocation: null })
                      : point({ latitude: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Kinh độ
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={form.mapLocation?.longitude ?? ''}
                  onChange={(e) =>
                    e.target.value === ''
                      ? update({ mapLocation: null })
                      : point({ longitude: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {form.mapLocation && (
              <button
                type="button"
                onClick={() => update({ mapLocation: null })}
              >
                Xóa vị trí chưa chắc chắn
              </button>
            )}
          </fieldset>
        </details>
      </section>
      <details className="place-editor-card place-editor-notes">
        <summary>
          <NotebookPen size={20} />
          Ghi chú nội bộ
        </summary>
        <label>
          Chỉ quản trị viên nhìn thấy
          <textarea
            rows={4}
            maxLength={1000}
            disabled={busy}
            value={form.internalNote ?? ''}
            onChange={(e) => update({ internalNote: e.target.value })}
          />
        </label>
      </details>
    </aside>
  );
}
