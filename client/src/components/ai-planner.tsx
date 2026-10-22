import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { PlannerProposal, TripInput } from '@goease/contracts';
import { api } from '../api';

export function AiPlanner({
  draft,
  tripId,
  revision,
  onApply,
}: {
  draft: TripInput;
  tripId?: string | undefined;
  revision?: number | undefined;
  onApply: (value: TripInput) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<PlannerProposal | null>(null);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const snapshot = useRef('');
  const latest = useRef(draft);
  latest.current = draft;
  async function generate(fresh = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    setProposal(null);
    const base = JSON.stringify(draft);
    const payload = JSON.stringify({
      trip: draft,
      tripId,
      expectedRevision: revision,
      consent: true,
    });
    if (fresh || request.current?.payload !== payload)
      request.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await api<PlannerProposal>('/trips/ai-proposal', {
        method: 'POST',
        headers: { 'Idempotency-Key': request.current!.key },
        body: payload,
        signal: AbortSignal.timeout(60000),
      });
      if (JSON.stringify(latest.current) !== base)
        throw new Error(
          'Bạn đã thay đổi thông tin khi Goe đang lập lịch. Hãy tạo đề xuất mới để dùng thông tin mới nhất.',
        );
      snapshot.current = base;
      setProposal(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tạo được đề xuất.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ai-planner" aria-label="Goe AI lập lịch">
      <h2>
        <Sparkles size={19} /> Nhờ Goe xếp lịch
      </h2>
      <p>
        Hội An · 1–7 ngày. Khi bấm tạo, ngày đi, số người, ngân sách và sở thích
        được gửi tới Google Gemini. Tên, email và ghi chú riêng không được gửi.
      </p>
      <button
        type="button"
        className="journey-primary"
        disabled={busy}
        onClick={() => void generate(true)}
      >
        {busy ? 'Goe đang lên lịch…' : 'Tạo đề xuất bằng Gemini'}
      </button>
      {busy && (
        <p role="status">
          Thường mất vài chục giây. Lịch trình hiện tại vẫn được giữ.
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" disabled={busy} onClick={() => void generate()}>
            Lấy lại kết quả lượt vừa gửi
          </button>
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
            Dùng đề xuất này trong bản nháp
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
