import { useEffect, useRef, useState } from 'react';
import { images } from '@goease/media';
import { Sheet } from './journey-sheet';
import { Camera } from 'lucide-react';

export function AvatarPicker({
  avatarUrl,
  file,
  disabled,
  onCrop,
  onReset,
  displayName,
  emailVerified,
}: {
  avatarUrl: string;
  file: Blob | null;
  disabled: boolean;
  onCrop: (file: Blob) => void;
  onReset: () => void;
  displayName: string;
  emailVerified: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [encoding, setEncoding] = useState(false);
  const reading = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    offset: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      reading.current++;
    },
    [],
  );
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!image || !context) return;
    const scale =
      Math.max(512 / image.naturalWidth, 512 / image.naturalHeight) * zoom;
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 512, 512);
    context.drawImage(
      image,
      (512 - width) / 2 + (offset.x * (width - 512)) / 2,
      (512 - height) / 2 + (offset.y * (height - 512)) / 2,
      width,
      height,
    );
  }, [image, zoom, offset]);

  async function select(file: File | undefined) {
    if (!file) return;
    const sequence = ++reading.current;
    setError('');
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const candidate = new Image();
      candidate.src = url;
      await candidate.decode();
      if (sequence !== reading.current) return;
      if (
        !candidate.naturalWidth ||
        !candidate.naturalHeight ||
        candidate.naturalWidth * candidate.naturalHeight > 16_000_000
      )
        throw new Error();
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImage(candidate);
    } catch {
      if (sequence === reading.current)
        setError(
          'Không đọc được ảnh. Chọn ảnh khác có tối đa 16 triệu điểm ảnh.',
        );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-picker-preview account-profile-head">
        <div className="avatar-picker-image">
          <img
            src={preview || avatarUrl || images.defaultAvatar}
            alt={`Ảnh đại diện của ${displayName}`}
            onError={(e) => {
              if (e.currentTarget.src !== images.defaultAvatar)
                e.currentTarget.src = images.defaultAvatar;
            }}
          />
          <button
            type="button"
            className="avatar-camera"
            aria-label="Chọn ảnh từ máy"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Camera size={18} />
          </button>
        </div>
        <div>
          <strong className="account-display-name">{displayName}</strong>
          <small className="account-identity-label">Tài khoản GoEase</small>
          <small>
            {emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh'}
          </small>
          <button
            type="button"
            className="button button-outline"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            Thay ảnh đại diện
          </button>
          <button type="button" disabled={disabled} onClick={onReset}>
            Dùng ảnh mặc định
          </button>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Chọn ảnh đại diện từ máy"
        hidden
        disabled={disabled}
        onChange={(e) => {
          void select(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <small>
        JPG, PNG hoặc WebP, tối đa 5 MB. Bạn có thể kéo và phóng to ảnh trước
        khi lưu. Ảnh đại diện được lưu công khai trên Cloudinary khi bấm Lưu hồ
        sơ.
      </small>
      {error && <p role="alert">{error}</p>}
      {file && <small>Ảnh mới chưa lưu. Bấm Lưu hồ sơ để cập nhật.</small>}
      {image && (
        <Sheet
          title="Căn chỉnh ảnh đại diện"
          onClose={() => {
            if (!encoding) setImage(null);
          }}
        >
          <p>
            Kéo ảnh để chọn vị trí. Phần trong vòng tròn sẽ là ảnh đại diện của
            bạn.
          </p>
          <div
            className="avatar-crop-stage"
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0 || encoding) return;
              drag.current = { x: event.clientX, y: event.clientY, offset };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const current = drag.current;
              if (!current) return;
              const scale =
                Math.max(512 / image.naturalWidth, 512 / image.naturalHeight) *
                zoom;
              const ratio =
                512 / event.currentTarget.getBoundingClientRect().width;
              const maxX = (image.naturalWidth * scale - 512) / 2;
              const maxY = (image.naturalHeight * scale - 512) / 2;
              setOffset({
                x: maxX
                  ? Math.max(
                      -1,
                      Math.min(
                        1,
                        current.offset.x +
                          ((event.clientX - current.x) * ratio) / maxX,
                      ),
                    )
                  : 0,
                y: maxY
                  ? Math.max(
                      -1,
                      Math.min(
                        1,
                        current.offset.y +
                          ((event.clientY - current.y) * ratio) / maxY,
                      ),
                    )
                  : 0,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            <canvas
              ref={canvas}
              width={512}
              height={512}
              aria-label="Khung cắt ảnh đại diện"
            />
            <span className="avatar-crop-mask" aria-hidden="true" />
          </div>
          <fieldset className="avatar-crop-controls" disabled={encoding}>
            <label>
              Phóng to{' '}
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <label>
              Căn ngang{' '}
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={offset.x}
                onChange={(e) =>
                  setOffset({ ...offset, x: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Căn dọc{' '}
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={offset.y}
                onChange={(e) =>
                  setOffset({ ...offset, y: Number(e.target.value) })
                }
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Đặt lại căn chỉnh
            </button>
          </fieldset>
          <button
            type="button"
            className="journey-primary"
            disabled={encoding}
            onClick={() => {
              if (!canvas.current) return;
              setEncoding(true);
              try {
                canvas.current.toBlob(
                  (blob) => {
                    setEncoding(false);
                    if (!blob) {
                      setError('Chưa xử lý được ảnh. Hãy chọn lại.');
                      return;
                    }
                    onCrop(blob);
                    setImage(null);
                  },
                  'image/jpeg',
                  0.9,
                );
              } catch {
                setEncoding(false);
                setError('Chưa xử lý được ảnh. Hãy chọn lại.');
              }
            }}
          >
            {encoding ? 'Đang xử lý…' : 'Dùng ảnh này'}
          </button>
        </Sheet>
      )}
    </div>
  );
}
