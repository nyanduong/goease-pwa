import type { AdminPlaceInput, SourceSnapshot } from '@goease/contracts';
export type SourceEvidence = {
  snapshot: SourceSnapshot;
  fetchedAt: string | null;
} | null;
export function AdminFieldEvidence({
  form,
  evidence,
}: {
  form: AdminPlaceInput;
  evidence: SourceEvidence;
}) {
  const rows = [
    ['Tên địa điểm', form.name, evidence?.snapshot.name],
    ['Địa chỉ', form.locationQuery, evidence?.snapshot.address],
    ['Giờ mở cửa', form.openingHoursNote, evidence?.snapshot.openingHoursNote],
    [
      'Tọa độ',
      form.mapLocation
        ? `${form.mapLocation.latitude}, ${form.mapLocation.longitude}`
        : '',
      evidence
        ? `${evidence.snapshot.latitude}, ${evidence.snapshot.longitude}`
        : undefined,
    ],
  ];
  return (
    <details className="admin-field-evidence">
      <summary>Nguồn theo từng trường thông tin</summary>
      <p>
        So với quan sát nguồn gần nhất
        {evidence?.fetchedAt
          ? ` lúc ${new Date(evidence.fetchedAt).toLocaleString('vi-VN')}`
          : ''}
        . Trùng nguồn không có nghĩa đã xác minh tại cơ sở.
      </p>
      <dl>
        {rows.map(([label, current, incoming]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {!current
                ? 'Chưa có thông tin'
                : incoming === undefined
                  ? 'Nội dung biên tập theo link nguồn'
                  : current === incoming
                    ? 'Trùng quan sát Geoapify / OSM'
                    : 'Nội dung biên tập khác quan sát nguồn'}
            </dd>
          </div>
        ))}
      </dl>
      {evidence && (
        <a href={evidence.snapshot.sourceUrl} target="_blank" rel="noreferrer">
          Mở bản nguồn đối chiếu ↗
        </a>
      )}
      <p>Thời lượng: ước tính GoEase, {form.durationMinutes} phút.</p>
      <p>
        Giá:{' '}
        {form.referencePrice ? (
          <a
            href={form.referencePrice.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Nguồn giá · đối chiếu {form.referencePrice.checkedAt}
          </a>
        ) : (
          'Chưa có căn cứ giá để sử dụng.'
        )}
      </p>
      <p>
        Mô tả: nội dung người vận hành biên tập theo nguồn thông tin. Quyền ảnh
        nằm trong từng ảnh.
      </p>
    </details>
  );
}
