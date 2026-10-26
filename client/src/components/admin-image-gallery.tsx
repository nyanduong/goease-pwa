import { useState } from 'react';
import { catalogImageSchema, type AdminPlaceInput } from '@goease/contracts';
export function AdminImageGallery({
  form,
  update,
  hasRealCandidates = false,
}: {
  form: AdminPlaceInput;
  update: (p: Partial<AdminPlaceInput>) => void;
  hasRealCandidates?: boolean;
}) {
  const [url, setUrl] = useState(''),
    [credit, setCredit] = useState(''),
    [sourceUrl, setSource] = useState(''),
    [license, setLicense] = useState('owned'),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState('');
  const [kind, setKind] = useState<'photo' | 'ai_illustration'>('photo');
  const hasPhotos =
    hasRealCandidates ||
    !!form.images?.some((image) => image.kind !== 'ai_illustration');
  return (
    <details>
      <summary>
        Ảnh đã chọn ({form.images?.length ?? 0}/
        {form.images?.[0]?.kind === 'ai_illustration' ? 1 : 5})
      </summary>
      <p>
        Ảnh đầu tiên làm ảnh đại diện. Chỉ thêm ảnh bạn sở hữu, được cho phép
        hoặc có giấy phép phù hợp. Tối đa 5 ảnh thật; nếu chưa có ảnh thật, dùng
        1 ảnh minh họa AI làm bìa.
      </p>
      <p>
        Bìa được giữ trên Cloudinary; tối đa 4 ảnh bổ sung dùng link nguồn. Ảnh
        ngoài Wikimedia cần được tải lên Cloudinary trước khi chọn làm bìa.
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
              {im.kind === 'ai_illustration' && (
                <strong>Ảnh minh họa AI · </strong>
              )}
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
                {im.kind === 'ai_illustration'
                  ? 'Xác nhận quyền sử dụng ảnh minh họa AI'
                  : `Xác nhận ảnh thật đúng địa điểm ${i + 1}`}
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
        Loại ảnh
        <select
          aria-label="Loại ảnh thêm vào"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as 'photo' | 'ai_illustration');
            setConfirmed(false);
            setError('');
            if (e.target.value === 'ai_illustration') setLicense('owned');
          }}
        >
          <option value="photo">Ảnh thật</option>
          <option value="ai_illustration" disabled={hasPhotos}>
            Ảnh minh họa AI — khi chưa có ảnh thật
          </option>
        </select>
      </label>
      {kind === 'ai_illustration' && (
        <p>
          Chỉ thêm một ảnh minh họa AI. Loại và nguồn ảnh được giữ trong quản
          trị; ảnh không xác minh diện mạo thực tế của địa điểm.
        </p>
      )}
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
          {kind === 'photo' && (
            <>
              <option value="CC0">CC0</option>
              <option value="CC-BY-4.0">CC BY 4.0</option>
              <option value="CC-BY-SA-4.0">CC BY-SA 4.0</option>
            </>
          )}
        </select>
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {kind === 'ai_illustration'
          ? 'Tôi có quyền dùng ảnh AI này và đồng ý hiển thị nhãn ảnh minh họa'
          : 'Tôi xác nhận ảnh thật đúng địa điểm, đã kiểm tra quyền sử dụng và ghi công'}
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={
          !confirmed ||
          (kind === 'ai_illustration'
            ? hasPhotos || !!form.images?.length
            : (form.images?.filter((image) => image.kind !== 'ai_illustration')
                .length ?? 0) >= 5)
        }
        onClick={() => {
          if (
            kind === 'ai_illustration' &&
            !url.startsWith('https://res.cloudinary.com/')
          ) {
            setError(
              'Tải ảnh AI lên Cloudinary trước, rồi nhập URL ảnh đã lưu.',
            );
            return;
          }
          const parsed = catalogImageSchema.safeParse({
            url,
            credit,
            sourceUrl,
            license,
            reviewed: true,
            selection: 'admin',
            kind,
            storage: (() => {
              try {
                return new URL(url).hostname === 'res.cloudinary.com'
                  ? 'cloudinary'
                  : 'source';
              } catch {
                return 'source';
              }
            })(),
          });
          if (!parsed.success) {
            setError(
              'Điền link HTTPS, tác giả và bằng chứng quyền sử dụng hợp lệ.',
            );
            return;
          }
          update({
            images: [
              ...(kind === 'photo'
                ? (form.images ?? []).filter(
                    (image) => image.kind !== 'ai_illustration',
                  )
                : []),
              parsed.data,
            ],
          });
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
