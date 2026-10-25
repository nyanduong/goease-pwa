import { confirmAction } from '../confirmation';
import { useEffect, useRef, useState } from 'react';
import type { ShareLinkDto } from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { Sheet } from './journey-sheet';

export function TripSharing({
  tripId,
  unsaved,
}: {
  tripId: string;
  unsaved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShareLinkDto[]>([]);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [url, setUrl] = useState(''),
    [retry, setRetry] = useState(0);
  const pending = useRef<{ token: string; expiresInDays: number } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void api<{ items: ShareLinkDto[] }>(`/trips/${tripId}/shares`)
      .then((v) => {
        if (active) {
          setItems(v.items);
          setError('');
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được link.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, retry, tripId]);
  async function create() {
    if (busy) return;
    const value = pending.current ?? {
      token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
        v.toString(16).padStart(2, '0'),
      ).join(''),
      expiresInDays: days,
    };
    pending.current = value;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { share } = await api<{ share: ShareLinkDto }>(
        `/trips/${tripId}/shares`,
        { method: 'POST', body: JSON.stringify(value) },
      );
      setItems((v) => [share, ...v.filter((s) => s.id !== share.id)]);
      setUrl(`${location.origin}/share#${value.token}`);
      pending.current = null;
      setUncertain(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tạo được link.');
      if (
        e instanceof ApiFailure &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408
      ) {
        pending.current = null;
        setUncertain(false);
      } else setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (
      busy ||
      !(await confirmAction(
        'Thu hồi link này? Người nhận sẽ không mở được lịch trình nữa.',
        {
          title: 'Thu hồi link chia sẻ?',
          confirmLabel: 'Thu hồi link',
          tone: 'danger',
        },
      ))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/trips/${tripId}/shares/${id}`, { method: 'DELETE' });
      setItems((v) => v.filter((s) => s.id !== id));
      setUrl('');
      setNotice('Đã thu hồi link.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa thu hồi được link. Thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={unsaved} onClick={() => setOpen(true)}>
        Chia sẻ lịch trình
      </button>
      {open && (
        <Sheet
          title="Chia sẻ chỉ xem"
          onClose={() => {
            if (!busy) {
              setOpen(false);
              setUrl('');
            }
          }}
        >
          <div className="expense-form share-form">
            <p>
              Ai có link đều xem được lịch trình đã lưu mới nhất và bản đồ. Ghi
              chú riêng, ngân sách, các khoản đã chi và thông tin tài khoản được
              ẩn.
            </p>
            <p>
              Tên chuyến và tên hoạt động sẽ hiển thị. Link chỉ hiện để sao chép
              sau khi tạo; nếu mất link, hãy thu hồi rồi tạo link mới.
            </p>
            <label>
              Hết hạn sau
              <select
                value={days}
                disabled={busy || uncertain}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={1}>1 ngày</option>
                <option value={7}>7 ngày</option>
                <option value={30}>30 ngày</option>
              </select>
            </label>
            <button
              className="journey-primary"
              disabled={busy || loading}
              onClick={() => void create()}
            >
              {busy
                ? 'Đang xử lý…'
                : uncertain
                  ? 'Thử lại tạo link'
                  : 'Tạo link chỉ xem'}
            </button>
            {uncertain && (
              <p>
                Chưa rõ kết quả. Thử lại sẽ dùng cùng link, không tạo trùng.
              </p>
            )}
            {url && (
              <label>
                Link chia sẻ
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(url)
                      .then(() => setNotice('Đã sao chép link.'))
                      .catch(() =>
                        setNotice(
                          'Hãy chọn và sao chép link trong ô phía trên.',
                        ),
                      );
                  }}
                >
                  Sao chép link
                </button>
                <a href={url} target="_blank" rel="noreferrer">
                  Xem trước link ↗
                </a>
              </label>
            )}
            {notice && <p role="status">{notice}</p>}
            {error && (
              <p role="alert">
                {error}{' '}
                <button disabled={busy} onClick={() => setRetry((v) => v + 1)}>
                  Tải lại danh sách link
                </button>
              </p>
            )}
            <h3>Link đang hoạt động</h3>
            {loading ? (
              <p role="status">Đang tải link…</p>
            ) : items.length ? (
              <ul className="share-list">
                {items.map((s, i) => (
                  <li key={s.id}>
                    <strong>Link {i + 1}</strong>
                    <span>
                      Tạo {new Date(s.createdAt).toLocaleString('vi-VN')}
                    </span>
                    <span>
                      Hết hạn {new Date(s.expiresAt).toLocaleString('vi-VN')}
                    </span>
                    <button
                      disabled={busy || uncertain}
                      onClick={() => void revoke(s.id)}
                    >
                      Thu hồi link {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa có link đang hoạt động.</p>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
