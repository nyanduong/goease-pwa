import { confirmAction } from '../confirmation';
import { useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Info,
  ArrowUpRight,
  X,
  Expand,
} from '../icons';
import {
  catalogImageCover,
  catalogCapabilities,
  needsPlaceDescription,
  type CatalogReviewDto,
  type ReviewDecision,
  type SourceSnapshot,
} from '@goease/contracts';
import { api } from '../api';
import { SourceCredit } from './source-credit';
import { AdminPlaceImage } from './admin-visuals';
import { catalogTime, reviewGroups } from './admin-review-utils';
export function ReviewDetail({
  review: r,
  onBack,
  onEdit,
  onInspectDuplicate,
  onDone,
  onReload,
}: {
  review: CatalogReviewDto;
  onBack: () => void;
  onEdit: () => void;
  onInspectDuplicate: (id: string) => void;
  onDone: (message: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cover = catalogImageCover(r.place.images ?? []);
  const capabilities = r.place.capabilities ?? catalogCapabilities(r.place);
  const checks = [
    { label: 'Đã có ảnh bìa', missing: 'Cần bổ sung ảnh bìa', ready: !!cover },
    {
      label: 'Đã có tên và địa chỉ',
      missing: 'Cần kiểm tra tên và địa chỉ',
      ready: !!r.place.name.trim() && !!r.place.locationQuery.trim(),
    },
    {
      label: 'Đã có giới thiệu',
      missing: 'Cần bổ sung giới thiệu',
      ready: !needsPlaceDescription(r.place.description),
    },
  ];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(1);
  const [confirmIgnore, setConfirmIgnore] = useState(false);
  const [note, setNote] = useState('');
  const key = useRef({ payload: '', value: '' });
  const fields: {
    name: string;
    current: string;
    incoming: string;
    sourceField: keyof SourceSnapshot;
  }[] = r.incoming
    ? [
        {
          name: 'Tên địa điểm',
          current: r.place.name,
          incoming: r.incoming.name,
          sourceField: 'name',
        },
        {
          name: 'Địa chỉ',
          current: r.place.locationQuery,
          incoming: r.incoming.address || 'Chưa có',
          sourceField: 'address',
        },
        {
          name: 'Nhóm địa điểm',
          current: {
            food: 'Ăn uống',
            culture: 'Văn hóa',
            nature: 'Thiên nhiên',
          }[r.place.category],
          incoming: {
            food: 'Ăn uống',
            culture: 'Văn hóa',
            nature: 'Thiên nhiên',
          }[r.incoming.category],
          sourceField: 'category',
        },
        {
          name: 'Giờ mở cửa',
          current: r.place.openingHoursNote || 'Chưa có',
          incoming: r.incoming.openingHoursNote || 'Chưa có',
          sourceField: 'openingHoursNote',
        },
        {
          name: 'Vị trí nguồn',
          current: r.currentLocation
            ? `${r.currentLocation.latitude}, ${r.currentLocation.longitude}`
            : 'Chưa có vị trí hiện tại',
          incoming: `${r.incoming.latitude}, ${r.incoming.longitude}`,
          sourceField: 'latitude',
        },
        {
          name: 'Dấu hiệu đóng cửa từ nguồn',
          current: r.previous?.closed
            ? 'Có dấu hiệu cần xác nhận'
            : 'Chưa có bằng chứng',
          incoming: r.incoming.closed
            ? 'Có dấu hiệu ngừng hoạt động; cần xác nhận'
            : 'Chưa có bằng chứng',
          sourceField: 'closed',
        },
      ]
    : [];
  async function decide(decision: ReviewDecision['decision'], publish = false) {
    if (busy) return;
    const body = {
      expectedRevision: r.revision,
      expectedPlaceRevision: r.place.revision,
      decision,
      note,
      publish,
      ...(decision === 'later'
        ? { revisitAt: new Date(Date.now() + days * 86400000).toISOString() }
        : {}),
    };
    // Retain the exact defer date and key after an uncertain response.
    const identity = JSON.stringify({
      id: r.id,
      rev: r.revision,
      place: r.place.revision,
      decision,
      days,
      note,
      publish,
    });
    if (key.current.value !== identity)
      key.current = {
        value: identity,
        payload: JSON.stringify({ key: crypto.randomUUID(), body }),
      };
    const pending = JSON.parse(key.current.payload) as {
      key: string;
      body: ReviewDecision;
    };
    setBusy(true);
    setError('');
    try {
      await api(`/admin/catalog/reviews/${r.id}/decision`, {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.key },
        body: JSON.stringify(pending.body),
      });
      await onDone(
        decision === 'later'
          ? `Đã hẹn xem lại lúc ${catalogTime(pending.body.revisitAt!)}.`
          : publish
            ? 'Đã chấp thuận và xuất bản địa điểm.'
            : decision === 'revise'
              ? 'Đã ghi yêu cầu chỉnh sửa. Việc vẫn được giữ để tiếp tục xử lý.'
              : decision === 'reject'
                ? 'Đã từ chối đề xuất. Nội dung địa điểm được giữ nguyên.'
                : decision === 'apply'
                  ? 'Đã lưu đề xuất thay đổi từ nguồn. Bản công khai được giữ nguyên cho tới khi xuất bản.'
                  : decision === 'ignore'
                    ? 'Đã bỏ qua việc. Nội dung và trạng thái địa điểm được giữ nguyên.'
                    : decision === 'distinct'
                      ? 'Đã xác nhận là hai địa điểm riêng. Có thể xem bản nháp và đăng.'
                      : 'Đã giữ thông tin hiện tại. Nguồn không đổi sẽ không nhắc lại.',
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa lưu được quyết định. Hãy thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="admin-review-detail admin-check-detail"
      aria-label="Chi tiết việc cần kiểm tra"
    >
      <button className="admin-check-back" disabled={busy} onClick={onBack}>
        ← Về danh sách
      </button>
      <header className="admin-check-detail-heading">
        <small>{reviewGroups[r.kind]}</small>
        <h2>{r.place.name}</h2>
        <button
          className="admin-check-edit-link"
          disabled={busy}
          onClick={onEdit}
        >
          Mở trang chỉnh sửa <ArrowUpRight size={15} />
        </button>
      </header>
      <button
        className="admin-check-hero"
        disabled={!cover}
        onClick={() => dialog.current?.showModal()}
        aria-label={`Xem ảnh: ${r.place.name}`}
      >
        <AdminPlaceImage place={r.place} large />
        {cover && (
          <span>
            <Expand size={16} />
            Xem ảnh đầy đủ
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        className="place-photo-viewer"
        aria-label="Xem ảnh địa điểm"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        {cover && (
          <img
            src={cover.url}
            alt={r.place.name}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <button
          type="button"
          className="place-photo-close"
          aria-label="Đóng xem ảnh"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
      </dialog>
      <section className="admin-check-checklist">
        <h3>
          {r.place.publicationStatus === 'published'
            ? 'Kiểm tra nội dung hiện tại'
            : 'Trước khi xuất bản'}
        </h3>
        <ul>
          {checks.map((c) => (
            <li key={c.label} className={c.ready ? 'is-ready' : 'is-missing'}>
              {c.ready ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
              <span>{c.ready ? c.label : c.missing}</span>
            </li>
          ))}
          <li className="is-neutral">
            <Info size={18} />
            <span>
              {[
                !capabilities.budgeting && 'Giá chưa xác minh',
                !r.place.openingHoursNote.trim() && 'Giờ mở cửa chưa xác minh',
              ]
                .filter(Boolean)
                .join(' · ') || 'Giá và giờ mở cửa: xem nội dung chi tiết'}
            </span>
          </li>
        </ul>
        <p className="admin-check-impact">
          {r.place.publicationStatus === 'published'
            ? 'Khách vẫn đang thấy bản công khai hiện tại.'
            : 'Bản nháp · Chưa hiển thị cho khách'}
        </p>
      </section>
      <div className="admin-check-source">
        <a href={r.place.sourceUrl} target="_blank" rel="noreferrer">
          {r.place.source ? 'Geoapify / OpenStreetMap' : 'Nguồn thông tin'}{' '}
          <ArrowUpRight size={14} />
        </a>
        <span>{catalogTime(r.fetchedAt ?? r.updatedAt)}</span>
      </div>
      {error && (
        <div role="alert" className="admin-alert">
          {error}
          <button
            disabled={busy}
            onClick={() => {
              void onReload().catch((e) =>
                setError(
                  e instanceof Error ? e.message : 'Chưa tải được bản mới.',
                ),
              );
            }}
          >
            Mở bản mới để đối chiếu
          </button>
        </div>
      )}
      {!!r.duplicates.length && (
        <p className="admin-soft-notice">
          Có thể trùng: {r.duplicates.join(', ')}. So sánh tên và vị trí trước
          khi xác nhận đây là hai địa điểm riêng.
        </p>
      )}
      {!!r.duplicatePlaces.length && (
        <section className="admin-work-group">
          <h3>Các địa điểm cần đối chiếu</h3>
          {r.duplicatePlaces.map((p) => (
            <article key={p.id} className="admin-work-row">
              <div>
                <h3>{p.name}</h3>
                <p>{p.locationQuery}</p>
                <p>
                  {p.publicationStatus === 'published'
                    ? 'Đang hiển thị cho khách'
                    : p.publicationStatus === 'draft'
                      ? 'Bản nháp khác'
                      : 'Đã ngừng hiển thị'}
                </p>
                <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                  Xem nguồn đối chiếu ↗
                </a>
              </div>
              <button disabled={busy} onClick={() => onInspectDuplicate(p.id)}>
                Mở địa điểm đối chiếu
              </button>
            </article>
          ))}
        </section>
      )}
      <div className="admin-review-detail-grid">
        <details className="admin-review-evidence" open={r.kind === 'source'}>
          <summary>
            {r.incoming
              ? 'Đối chiếu thông tin nguồn'
              : 'Xem nội dung & lý do kiểm tra'}
          </summary>
          <p className="admin-check-reason">{r.reason}</p>
          {r.incoming ? (
            <>
              <p>
                Lấy từ nguồn lúc {catalogTime(r.fetchedAt)}. Đây không phải ngày
                con người xác minh.{' '}
                <a href={r.incoming.sourceUrl} target="_blank" rel="noreferrer">
                  Mở nguồn đối chiếu ↗
                </a>
              </p>
              <div className="admin-comparison">
                <table>
                  <thead>
                    <tr>
                      <th>Thông tin</th>
                      <th>Nội dung hiện tại / nguồn trước</th>
                      <th>Nguồn mới</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => {
                      const changed = f.current !== f.incoming;
                      const proposed =
                        !r.previous ||
                        JSON.stringify(r.previous[f.sourceField]) !==
                          JSON.stringify(r.incoming![f.sourceField]) ||
                        (f.sourceField === 'latitude' &&
                          r.previous.longitude !== r.incoming!.longitude);
                      return (
                        <tr
                          key={f.name}
                          className={changed ? 'has-difference' : ''}
                        >
                          <th>
                            {f.name}
                            {changed && <small>Khác nhau</small>}
                          </th>
                          <td>{f.current}</td>
                          <td>
                            {f.incoming}
                            {r.kind === 'source' && changed && (
                              <small>
                                {proposed
                                  ? 'Đề nghị áp dụng'
                                  : 'Giữ phần đã biên tập'}
                              </small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <SourceCredit expanded />
            </>
          ) : (
            <div className="admin-preview">
              <h3>Thông tin hiện tại</h3>
              <p>{r.place.description}</p>
              <p>{r.place.locationQuery}</p>
              <a href={r.place.sourceUrl} target="_blank" rel="noreferrer">
                Mở nguồn thông tin ↗
              </a>
              {r.kind === 'price' && (
                <p>
                  Giá kiểm tra lần cuối ngày {r.place.referencePrice?.checkedAt}
                  ; đến hạn ngày {r.place.referencePrice?.reviewAfter}. Giá này
                  không dùng cho dự toán mới. Mở địa điểm để cập nhật hoặc bỏ
                  giá chưa rõ.
                </p>
              )}
            </div>
          )}
          {r.incoming?.closed && (
            <p className="admin-alert">
              Nguồn có dấu hiệu đóng cửa; cần xác nhận trước khi thay đổi hiển
              thị. Lưu đề xuất không đổi bản công khai.
            </p>
          )}
        </details>
        <aside className="admin-review-decisions">
          <h3>Ghi chú kiểm tra</h3>
          <label>
            <span className="sr-only">Ghi chú quyết định</span>
            <textarea
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi lại điều cần bổ sung hoặc lý do quyết định…"
            />
          </label>
          <div className="admin-actions">
            <button
              disabled={busy}
              className="journey-primary"
              onClick={onEdit}
            >
              {checks.every((c) => c.ready)
                ? r.place.publicationStatus === 'published'
                  ? 'Chỉnh sửa địa điểm'
                  : 'Xem bản nháp'
                : 'Bổ sung thông tin →'}
            </button>
            {r.kind === 'source' && (
              <button disabled={busy} onClick={() => void decide('apply')}>
                Lưu đề xuất từ nguồn
              </button>
            )}
            {['source', 'draft'].includes(r.kind) && capabilities.discovery && (
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirmAction(
                      'Chấp thuận nội dung và xuất bản cho khách? Server sẽ kiểm tra lại các điều kiện bắt buộc.',
                      {
                        title: 'Xuất bản địa điểm?',
                        confirmLabel: 'Chấp thuận và xuất bản',
                        tone: 'warning',
                      },
                    )
                  )
                    void decide(r.kind === 'source' ? 'apply' : 'keep', true);
                }}
              >
                Chấp thuận và xuất bản
              </button>
            )}
            <details className="admin-check-more-actions">
              <summary>Các cách xử lý khác</summary>
              <button
                disabled={busy || !note.trim()}
                onClick={() => void decide('revise')}
              >
                Yêu cầu chỉnh sửa
              </button>
              {r.kind === 'source' && (
                <button
                  disabled={busy || !note.trim()}
                  onClick={() => void decide('reject')}
                >
                  Từ chối đề xuất
                </button>
              )}
              {r.kind === 'duplicate' && (
                <button disabled={busy} onClick={() => void decide('distinct')}>
                  Đây là hai địa điểm riêng
                </button>
              )}
              {r.kind !== 'duplicate' && (
                <button disabled={busy} onClick={() => void decide('keep')}>
                  Giữ thông tin hiện tại
                </button>
              )}
              <button disabled={busy} onClick={() => setConfirmIgnore(true)}>
                Bỏ qua việc này
              </button>
            </details>
          </div>
          {confirmIgnore && (
            <div className="admin-preview">
              <p>
                Việc sẽ được đóng với lý do đã nhập. Địa điểm vẫn giữ nội dung
                và trạng thái hiển thị hiện tại.
              </p>
              <button disabled={busy} onClick={() => void decide('ignore')}>
                Xác nhận bỏ qua việc
              </button>
              <button disabled={busy} onClick={() => setConfirmIgnore(false)}>
                Quay lại
              </button>
            </div>
          )}
          <div className="admin-defer">
            <label>
              Xem lại sau
              <select
                disabled={busy}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={1}>1 ngày</option>
                <option value={7}>1 tuần</option>
                <option value={30}>30 ngày</option>
              </select>
            </label>
            <button disabled={busy} onClick={() => void decide('later')}>
              Để sau
            </button>
            <small>
              Hẹn vào{' '}
              {catalogTime(
                new Date(Date.now() + days * 86400000).toISOString(),
              )}{' '}
              (giờ Việt Nam)
            </small>
          </div>
        </aside>
      </div>
    </section>
  );
}
