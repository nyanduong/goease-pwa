import { useEffect, useRef, useState } from 'react';
import type { AdminPlaceDto } from '@goease/contracts';
import { api } from '../api';

export function AdminPlaceTools({
  saved,
  onRestore,
  busy,
}: {
  saved: AdminPlaceDto | null;
  onRestore: () => void;
  busy: boolean;
}) {
  const [versions, setVersions] = useState<
    {
      revision: number;
      recordedAt: string;
      name: string;
      status: string;
      state?: string;
      reason?: string;
    }[]
  >([]);
  const [comparison, setComparison] = useState<{
    revision: number;
    state: string;
    reason: string;
    changes: { field: string; current: unknown; historical: unknown }[];
  } | null>(null);
  const restoreKey = useRef({ identity: '', key: '' });
  const [error, setError] = useState(''),
    [restoring, setRestoring] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setComparison(null);
    setError('');
    if (!saved) return;
    let active = true;
    void api<{ items: typeof versions }>(`/admin/places/${saved.id}/versions`)
      .then((v) => {
        if (active) setVersions(v.items);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa tải được phiên bản.');
      });
    return () => {
      active = false;
    };
  }, [saved?.id, saved?.revision, retry]);
  async function compare(revision: number) {
    if (!saved) return;
    setRestoring(true);
    setError('');
    try {
      setComparison(
        await api<{
          revision: number;
          state: string;
          reason: string;
          changes: { field: string; current: unknown; historical: unknown }[];
        }>(`/admin/places/${saved.id}/versions/${revision}`),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa tải được nội dung so sánh.',
      );
    } finally {
      setRestoring(false);
    }
  }
  async function restore(revision: number) {
    if (
      !saved ||
      !confirm(
        'Chuẩn bị đề xuất phục hồi từ phiên bản này? Bản công khai được giữ nguyên cho tới khi bạn xuất bản đề xuất.',
      )
    )
      return;
    setRestoring(true);
    setError('');
    const identity = `${saved.id}:${saved.revision}:${revision}`;
    if (restoreKey.current.identity !== identity)
      restoreKey.current = { identity, key: crypto.randomUUID() };
    try {
      await api(`/admin/places/${saved.id}/restore`, {
        method: 'POST',
        headers: { 'Idempotency-Key': restoreKey.current.key },
        body: JSON.stringify({ revision, expectedRevision: saved.revision }),
      });
      onRestore();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa khôi phục được.');
    } finally {
      setRestoring(false);
    }
  }
  return (
    <div className="admin-editor-tools">
      {saved && (
        <section className="admin-panel">
          <h2>Phiên bản & khôi phục</h2>
          {error && (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => setRetry((v) => v + 1)}>
                Tải lại phiên bản
              </button>
            </p>
          )}
          {!versions.length && (
            <p>
              Chưa có bản lưu phiên bản. Bản hiện tại sẽ được ghi lại khi chỉnh
              sửa tiếp.
            </p>
          )}
          {comparison && (
            <div className="admin-version-comparison">
              <h3>So sánh phiên bản {comparison.revision}</h3>
              <p>
                Đối chiếu bản đang biên tập đã lưu với bản lịch sử. Thời điểm
                nhận không xác nhận bản nào đúng hơn. Phục hồi thay đề xuất đang
                lưu và giữ các trường đã khóa; bản công khai giữ nguyên.
              </p>
              {comparison.changes.length ? (
                <div className="admin-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Trường</th>
                        <th>Bản đang biên tập đã lưu</th>
                        <th>Phiên bản {comparison.revision}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.changes.map((c) => (
                        <tr key={c.field}>
                          <th>{c.field}</th>
                          <td>
                            <pre>
                              {typeof c.current === 'object'
                                ? JSON.stringify(c.current, null, 2)
                                : String(c.current ?? 'Chưa rõ')}
                            </pre>
                          </td>
                          <td>
                            <pre>
                              {typeof c.historical === 'object'
                                ? JSON.stringify(c.historical, null, 2)
                                : String(c.historical ?? 'Chưa rõ')}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Không có khác biệt trong các trường đối chiếu.</p>
              )}
              <button
                type="button"
                className="journey-primary"
                disabled={restoring || busy}
                onClick={() => void restore(comparison.revision)}
              >
                Chuẩn bị đề xuất phục hồi
              </button>
            </div>
          )}
          {versions.map((v) => (
            <div className="admin-version" key={v.revision}>
              <span>
                Bản {v.revision} ·{' '}
                {v.state === 'published'
                  ? 'Công khai'
                  : v.state === 'proposal'
                    ? 'Đề xuất'
                    : 'Lịch sử'}{' '}
                · {new Date(v.recordedAt).toLocaleString('vi-VN')}
              </span>
              <button
                type="button"
                disabled={restoring || busy || v.revision === saved.revision}
                onClick={() => void compare(v.revision)}
              >
                So sánh & chuẩn bị phục hồi
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
