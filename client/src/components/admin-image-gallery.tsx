import { useState } from 'react';
import { catalogImageSchema, type AdminPlaceInput } from '@goease/contracts';
export function AdminImageGallery({
  form,
  update,
}: {
  form: AdminPlaceInput;
  update: (p: Partial<AdminPlaceInput>) => void;
}) {
  const [url, setUrl] = useState(''),
    [credit, setCredit] = useState(''),
    [sourceUrl, setSource] = useState(''),
    [license, setLicense] = useState('owned'),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState('');
  return (
    <details>
      <summary>
        Quản lý ảnh có quyền sử dụng ({form.images?.length ?? 0}/8)
      </summary>
      <p>
        Ảnh đầu tiên làm ảnh đại diện. Chỉ thêm ảnh bạn sở hữu, được cho phép
        hoặc có giấy phép phù hợp.
      </p>
      <div className="admin-image-gallery">
        {form.images?.map((im, i) => (
          <figure key={im.url + i}>
            <img
              src={im.url}
              alt={`Ảnh ${i + 1}`}
              referrerPolicy="no-referrer"
            />
            <figcaption>
              {im.credit} · {im.license}
            </figcaption>
            <a href={im.sourceUrl} target="_blank" rel="noreferrer">
              Nguồn / quyền sử dụng
            </a>
            {!im.reviewed && (
              <button
                type="button"
                onClick={() =>
                  update({
                    images: form.images!.map((image, n) =>
                      n === i ? { ...image, reviewed: true } : image,
                    ),
                  })
                }
              >
                Xác nhận ảnh thật đúng địa điểm {i + 1}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                update({ images: form.images!.filter((_, n) => n !== i) })
              }
            >
              Bỏ ảnh {i + 1}
            </button>
          </figure>
        ))}
      </div>
      <label>
        Đường dẫn ảnh HTTPS
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label>
        Tác giả / ghi công
        <input
          maxLength={1000}
          value={credit}
          onChange={(e) => setCredit(e.target.value)}
        />
      </label>
      <label>
        Nguồn hoặc bằng chứng quyền sử dụng
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>
      <label>
        Quyền sử dụng
        <select value={license} onChange={(e) => setLicense(e.target.value)}>
          <option value="owned">Ảnh của tôi / GoEase</option>
          <option value="permission">Có sự cho phép</option>
          <option value="CC0">CC0</option>
          <option value="CC-BY-4.0">CC BY 4.0</option>
          <option value="CC-BY-SA-4.0">CC BY-SA 4.0</option>
        </select>
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Tôi xác nhận ảnh thật đúng địa điểm, đã kiểm tra quyền sử dụng và ghi
        công
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={!confirmed || (form.images?.length ?? 0) >= 8}
        onClick={() => {
          const parsed = catalogImageSchema.safeParse({
            url,
            credit,
            sourceUrl,
            license,
            reviewed: true,
          });
          if (!parsed.success) {
            setError(
              'Điền link HTTPS, tác giả và bằng chứng quyền sử dụng hợp lệ.',
            );
            return;
          }
          update({ images: [...(form.images ?? []), parsed.data] });
          setUrl('');
          setCredit('');
          setSource('');
          setConfirmed(false);
          setError('');
        }}
      >
        Thêm vào bản chỉnh sửa
      </button>
    </details>
  );
}
