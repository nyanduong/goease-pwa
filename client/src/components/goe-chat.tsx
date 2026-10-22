import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Coins,
  Leaf,
  Send,
  X,
} from 'lucide-react';
import type { TripDto, GoeProposal, GoeRequest } from '@goease/contracts';
import { api } from '../api';
import { moneyText } from '../trip-draft';

type Line = { id: number; role: 'user' | 'goe'; text: string };
export function GoeChat({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean;
  onNavigate: (path: string) => void;
}) {
  const params = new URLSearchParams(location.search);
  const [tripId, setTripId] = useState(params.get('trip') ?? '');
  const [trip, setTrip] = useState<TripDto | null>(null),
    [choices, setChoices] = useState<TripDto[]>([]);
  const [dayIndex, setDayIndex] = useState(
    Math.max(0, Math.min(30, Math.floor(Number(params.get('day') ?? 0) || 0))),
  );
  const [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [input, setInput] = useState('');
  const [lines, setLines] = useState<Line[]>([]),
    [proposal, setProposal] = useState<GoeProposal | null>(null);
  const [preview, setPreview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const sequence = useRef(0),
    generationKey = useRef<{
      tripId: string;
      body: GoeRequest;
      key: string;
    } | null>(null),
    applyKey = useRef('');
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setLoading(true);
    setError('');
    setProposal(null);
    setTrip(null);
    setLines([]);
    generationKey.current = null;
    const load = tripId
      ? api<{ trip: TripDto }>(`/trips/${tripId}`).then((r) => {
          if (active) setTrip(r.trip);
        })
      : api<{ items: TripDto[] }>('/trips').then((r) => {
          if (active) setChoices(r.items);
        });
    void load
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Chưa mở được chuyến đi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tripId, signedIn, retry]);
  useEffect(() => {
    if (!preview) return;
    const element = dialog.current,
      prior = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      prior?.focus();
    };
  }, [preview]);
  const index = Math.min(dayIndex, Math.max(0, (trip?.days.length ?? 1) - 1)),
    day = trip?.days[index];
  const contextName = trip
    ? `${trip.destinationName} · Ngày ${index + 1}`
    : 'Chọn chuyến đi của bạn';
  function add(role: Line['role'], text: string) {
    setLines((old) => [
      ...old.slice(-19),
      { id: ++sequence.current, role, text },
    ]);
  }
  async function send(text: string, recover = false) {
    if (!trip || !day || busy || !text.trim()) return;
    const request = recover
      ? generationKey.current
      : {
          tripId: trip.id,
          key: crypto.randomUUID(),
          body: {
            message: text.trim(),
            dayId: day.dayId,
            expectedRevision: trip.revision,
            consent: true as const,
          },
        };
    if (!request) return;
    generationKey.current = request;
    setBusy(true);
    setError('');
    setProposal(null);
    if (!recover) add('user', request.body.message);
    try {
      const result = await api<GoeProposal>(
        `/trips/${request.tripId}/goe-proposal`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': request.key },
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(60000),
        },
      );
      setProposal(result);
      applyKey.current = crypto.randomUUID();
      setInput('');
      add(
        'goe',
        'Mình đã chuẩn bị đề xuất cho ngày bạn chọn. Bạn xem lịch trước và sau rồi quyết định nhé.',
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Goe chưa trả lời được. Lịch cũ vẫn được giữ.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!proposal || !trip || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ trip: TripDto }>(
        `/trips/${trip.id}/goe-apply`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': applyKey.current },
          body: JSON.stringify({
            runId: proposal.runId,
            expectedRevision: proposal.baseRevision,
          }),
        },
      );
      setTrip(result.trip);
      setPreview(false);
      setProposal(null);
      generationKey.current = null;
      add('goe', 'Đã lưu thay đổi vào chuyến đi. Ngân sách đã được tính lại.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Chưa lưu được thay đổi. Hãy thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  const after = proposal?.trip.days.find((d) => d.dayId === proposal.dayId);
  return (
    <section className="goe-chat-page">
      <header className="goe-chat-header">
        <button
          aria-label="Quay lại"
          disabled={busy}
          onClick={() => onNavigate(trip ? `/trips/${trip.id}` : '/')}
        >
          <ArrowLeft size={21} />
        </button>
        <img src="/images/goe-mascot-cutout.png" alt="Goe" />
        <div>
          <strong>Goe</strong>
          <small>Bạn đồng hành chuyến đi</small>
        </div>
      </header>
      <div className="goe-context-chip">
        <CalendarDays size={16} />
        Đang xem: {contextName}
      </div>
      <h1>
        Mình cùng
        <br />
        điều chỉnh nhé.<i aria-hidden="true">✦</i>
      </h1>
      {!signedIn ? (
        <p className="goe-context-notice">
          Đăng nhập để Goe đọc chuyến đi của bạn.{' '}
          <button onClick={() => onNavigate('/login')}>Đăng nhập</button>
        </p>
      ) : loading ? (
        <p role="status">Đang mở chuyến đi…</p>
      ) : !tripId ? (
        <div className="goe-context-panel">
          <h2>Chọn chuyến đi</h2>
          {choices.length ? (
            choices.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTripId(t.id);
                  setDayIndex(0);
                  history.replaceState({}, '', `/goe?trip=${t.id}&day=0`);
                }}
              >
                {t.title} →
              </button>
            ))
          ) : (
            <button onClick={() => onNavigate('/trips')}>
              Tạo chuyến đi trước khi hỏi Goe →
            </button>
          )}
        </div>
      ) : null}
      {trip && (
        <div className="goe-context-panel">
          <label>
            Ngày đang xem{' '}
            <select
              aria-label="Ngày đang xem"
              disabled={busy || preview}
              value={index}
              onChange={(e) => {
                setDayIndex(Number(e.target.value));
                setProposal(null);
                generationKey.current = null;
                setError('');
              }}
            >
              {trip.days.map((d, i) => (
                <option key={d.dayId} value={i}>
                  Ngày {i + 1} · {d.date}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() => onNavigate(`/trips/${trip.id}?view=cost`)}
          >
            Xem ngân sách chuyến đi
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setTripId('');
              history.replaceState({}, '', '/goe');
            }}
          >
            Chọn chuyến đi khác
          </button>
        </div>
      )}
      <p className="goe-demo-note">
        Goe dùng Gemini để đề xuất thay đổi. Khi gửi, nội dung tin nhắn, lịch
        theo mã địa điểm, ngày đi, số người, ngân sách và sở thích được gửi tới
        Google. Không gửi tên tài khoản hay ghi chú riêng. Đừng nhập thông tin
        nhạy cảm.
      </p>
      {error && !preview && (
        <div role="alert" className="goe-context-notice">
          <p>{error}</p>
          {generationKey.current && (
            <button
              disabled={busy}
              onClick={() =>
                void send(generationKey.current!.body.message, true)
              }
            >
              Lấy lại kết quả lượt vừa gửi
            </button>
          )}
          <button disabled={busy} onClick={() => setRetry((v) => v + 1)}>
            Tải lại chuyến đi
          </button>
        </div>
      )}
      <div
        className="goe-chat-messages"
        role="log"
        aria-label="Hội thoại với Goe"
        aria-live="polite"
      >
        <div className="goe-chat-line goe">
          <img src="/images/goe-mascot-cutout.png" alt="" />
          <div className="goe-chat-bubble">
            <p>
              Bạn muốn đi thư thả hơn, đổi điểm dừng hay thêm một món ăn? Mình
              sẽ đề xuất cho ngày đang xem; bạn xác nhận rồi mới lưu.
            </p>
          </div>
        </div>
        {lines.map((line) => (
          <div key={line.id} className={`goe-chat-line ${line.role}`}>
            {line.role === 'goe' && (
              <img src="/images/goe-mascot-cutout.png" alt="" />
            )}
            <div className="goe-chat-bubble">
              <p>{line.text}</p>
            </div>
          </div>
        ))}
        {busy && (
          <p role="status">Goe đang xử lý… Lịch hiện tại vẫn được giữ.</p>
        )}
        {proposal && (
          <div className="goe-proposal">
            <strong>Đề xuất chưa áp dụng</strong>
            <p>
              {proposal.before.activities.length} điểm dừng →{' '}
              {after?.activities.length} điểm dừng
            </p>
            <div className="goe-proposal-actions">
              <button disabled={busy} onClick={() => setPreview(true)}>
                Xem thay đổi
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setProposal(null);
                  add('goe', 'Đã giữ lịch cũ.');
                }}
              >
                Giữ lịch cũ
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="goe-consider">
        Chưa có thời tiết hoặc giá trực tiếp. Chi phí thiếu vẫn được ghi rõ.
      </p>
      <div className="goe-composer-area">
        <div className="goe-quick-prompts">
          <button
            disabled={!trip || busy}
            onClick={() =>
              void send(
                'Đề xuất giảm chi phí trong ngày này, không đoán giá khi chưa biết.',
              )
            }
          >
            <Coins size={16} />
            Giảm chi phí
          </button>
          <button
            disabled={!trip || busy}
            onClick={() =>
              void send('Mình muốn đi chậm hơn, bớt điểm dừng trong ngày này.')
            }
          >
            <Leaf size={16} />
            Đi chậm hơn
          </button>
        </div>
        <form
          className="goe-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            aria-label="Hỏi Goe về chuyến đi"
            placeholder="Hỏi Goe về chuyến đi…"
            maxLength={500}
            disabled={!trip || busy}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Gửi tin nhắn"
            disabled={!trip || busy || !input.trim()}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
      {preview && proposal && (
        <dialog
          ref={dialog}
          className="journey-sheet goe-preview-sheet"
          aria-label="Xem trước thay đổi"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setPreview(false);
          }}
        >
          <header>
            <h2>Xem trước thay đổi</h2>
            <button
              disabled={busy}
              aria-label="Đóng"
              onClick={() => setPreview(false)}
            >
              <X size={20} />
            </button>
          </header>
          <h3>{proposal.before.date}</h3>
          <div className="goe-preview-change">
            {[
              { title: 'Trước', value: proposal.before },
              { title: 'Sau', value: after },
            ].map(({ title, value }) => (
              <section key={title}>
                <h3>{title}</h3>
                <ul>
                  {value?.activities.map((a) => (
                    <li key={a.activityId}>
                      {a.startLocalTime ?? 'Chưa đặt giờ'} · {a.title}
                    </li>
                  ))}
                </ul>
                {!value?.activities.length && <p>Chưa có điểm dừng.</p>}
              </section>
            ))}
          </div>
          <p>
            Chi phí đã biết:{' '}
            {moneyText(trip?.budgetSummary?.knownEstimatedMinor ?? 0)} →{' '}
            {moneyText(proposal.budget.knownEstimatedMinor)}. Còn{' '}
            {proposal.budget.missingCostCount} điểm chưa rõ chi phí.
          </p>
          {proposal.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                disabled={busy}
                onClick={() => {
                  setPreview(false);
                  setRetry((v) => v + 1);
                }}
              >
                Tải lại chuyến đi
              </button>
            </div>
          )}
          <button
            className="journey-primary"
            disabled={busy}
            onClick={() => void apply()}
          >
            {busy ? 'Đang lưu…' : 'Xác nhận và lưu thay đổi'}{' '}
            <Check size={17} />
          </button>
          <button
            className="journey-outline"
            disabled={busy}
            onClick={() => setPreview(false)}
          >
            Giữ lịch cũ
          </button>
        </dialog>
      )}
    </section>
  );
}
