import { plannerTiming } from '@goease/contracts';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { PlannerProposal, TripInput } from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { canRecoverAi } from '../ai-errors';

export function AiPlanner({
  draft,
  tripId,
  revision,
  onApply,
  immediatePreview = false,
  onBusyChange,
}: {
  draft: TripInput;
  tripId?: string | undefined;
  revision?: number | undefined;
  onApply: (value: TripInput) => void;
  immediatePreview?: boolean;
  onBusyChange?: (value: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<PlannerProposal | null>(null);
  const [recoverable, setRecoverable] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const supported =
    draft.destinations[0]?.destinationId === '000000000000000000000004' &&
    draft.days.length > 0 &&
    draft.days.length <= 7;
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const snapshot = useRef('');
  const latest = useRef(draft);
  latest.current = draft;
  const currentPayload = JSON.stringify({
    trip: draft,
    tripId,
    expectedRevision: revision,
    consent: true,
  });
  async function generate(fresh = false) {
    if (busy || !supported) return;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setQuotaReached(false);
    setProposal(null);
    const base = JSON.stringify(draft);
    const payload = currentPayload;
    if (fresh || request.current?.payload !== payload)
      request.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await api<PlannerProposal>('/trips/ai-proposal', {
        method: 'POST',
        headers: { 'Idempotency-Key': request.current!.key },
        body: payload,
        signal: AbortSignal.timeout(plannerTiming.clientTimeoutMs),
      });
      if (!active.current) return;
      if (JSON.stringify(latest.current) !== base)
        throw new Error(
          'Bạn đã thay đổi thông tin khi Goe đang lập lịch. Hãy tạo đề xuất mới để dùng thông tin mới nhất.',
        );
      snapshot.current = base;
      if (immediatePreview) onApply(result.trip);
      else setProposal(result);
    } catch (e) {
      setQuotaReached(e instanceof ApiFailure && e.code === 'AI_QUOTA');
      setRecoverable(canRecoverAi(e));
      setError(e instanceof Error ? e.message : 'Chưa tạo được đề xuất.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section
      className={immediatePreview ? 'quick-generate' : 'ai-planner'}
      aria-label="Goe AI lập lịch"
    >
      {!immediatePreview && (
        <>
          <h2>
            <Sparkles size={19} /> Để Goe xếp lịch giúp bạn
          </h2>
          <p>
            Goe chọn điểm dừng và gợi ý giờ đi. Hiện hỗ trợ Hội An từ 1–7 ngày.
            Khi bấm tạo, ngày đi, số người, ngân sách và sở thích được gửi tới
            dịch vụ AI được cấu hình cho Goe. Tên, email và ghi chú riêng không
            được gửi.
          </p>
        </>
      )}
      <button
        type="button"
        className="journey-primary"
        disabled={busy || !supported}
        onClick={() => void generate(true)}
      >
        {busy
          ? 'Goe đang lên lịch…'
          : immediatePreview
            ? 'Lên lịch giúp mình'
            : 'Để Goe xếp lịch'}
      </button>
      {!supported && draft.destinations.length > 0 && (
        <p role="status">
          Chuyến này chưa được hỗ trợ tự động. Bạn có thể tự chọn điểm dừng bên
          dưới.
        </p>
      )}
      {busy && (
        <p role="status">
          Thường mất vài chục giây. Lịch trình hiện tại vẫn được giữ.
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {recoverable && request.current?.payload === currentPayload && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate()}
            >
              Kiểm tra kết quả đang chờ
            </button>
          )}
          <p>
            {quotaReached
              ? 'Hôm nay đã hết lượt tạo lịch. Bạn có thể tự chọn điểm dừng hoặc quay lại vào ngày mai.'
              : immediatePreview
                ? 'Thử lại bằng nút tạo lịch, hoặc chọn “Tự chọn điểm dừng” bên dưới.'
                : 'Bạn có thể tạo lại, hoặc quay về lịch trình để tự chỉnh.'}{' '}
            Thông tin bạn chọn vẫn được giữ.
          </p>
        </div>
      )}
      {proposal && (
        <div className="ai-proposal">
          <h3>Đề xuất của Goe · Chưa áp dụng</h3>
          {proposal.trip.days.map((d) => (
            <div key={d.dayId}>
              <h3>{d.date.split('-').reverse().join('/')}</h3>
              <ul>
                {d.activities.map((a) => (
                  <li key={a.activityId}>
                    <strong>
                      {a.startLocalTime}–{a.endLocalTime}
                    </strong>{' '}
                    · {a.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {proposal.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <button
            type="button"
            className="journey-primary"
            onClick={() => {
              if (JSON.stringify(draft) !== snapshot.current) {
                setError('Thông tin chuyến đi đã đổi. Hãy tạo đề xuất mới.');
                return;
              }
              onApply(proposal.trip);
              setProposal(null);
            }}
          >
            Dùng lịch này
          </button>
          <button type="button" onClick={() => setProposal(null)}>
            Giữ lịch hiện tại
          </button>
          <small>
            Áp dụng sẽ thay các điểm dừng trong bản nháp. Bấm Lưu chuyến đi sau
            khi xem và chỉnh sửa.
          </small>
        </div>
      )}
    </section>
  );
}
