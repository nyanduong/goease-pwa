import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  Check,
  Coins,
  Info,
  Landmark,
  Leaf,
  MoreHorizontal,
  Send,
  Sun,
  X,
} from 'lucide-react';
import type { TripDto } from '@goease/contracts';
import { api } from '../api';

type Topic = 'rain' | 'budget' | 'slow';
type ChatLine = {
  id: number;
  role: 'user' | 'goe';
  text: string;
  topic?: Topic;
};
const responses: Record<
  Topic,
  { text: string; before: string; after: string }
> = {
  rain: {
    text: 'Mình gợi ý đổi điểm ngoài trời sang một nơi trong nhà.',
    before: '15:00 · Hoạt động ngoài trời',
    after: '15:00 · Ghé bảo tàng',
  },
  budget: {
    text: 'Mình gợi ý thay một trải nghiệm có phí bằng thời gian tự dạo phố.',
    before: '15:00 · Trải nghiệm có phí',
    after: '15:00 · Tự dạo phố',
  },
  slow: {
    text: 'Mình gợi ý dành thêm một khoảng nghỉ, để bạn tận hưởng thong thả hơn.',
    before: '15:00 · Điểm dừng tiếp theo',
    after: '15:00 · Nghỉ chân, uống trà',
  },
};
const initialLines: ChatLine[] = [
  { id: 1, role: 'goe', text: 'Bạn muốn chuyến đi thư thả hơn một chút?' },
  { id: 2, role: 'user', text: 'Nếu chiều mưa thì đi đâu?' },
  { id: 3, role: 'goe', text: responses.rain.text, topic: 'rain' },
];

export function GoeChat({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean;
  onNavigate: (path: string) => void;
}) {
  const params = new URLSearchParams(location.search);
  const tripId = params.get('trip');
  const [trip, setTrip] = useState<TripDto | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    tripId ? 'loading' : 'ready',
  );
  const [retry, setRetry] = useState(0);
  const [dayIndex, setDayIndex] = useState(
    Math.min(30, Math.max(0, Math.floor(Number(params.get('day') ?? 1) || 0))),
  );
  const [lines, setLines] = useState(initialLines);
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<Topic | null>(null);
  const [resolution, setResolution] = useState<Record<number, string>>({});
  const [selectedMessage, setSelectedMessage] = useState(3);
  const [menu, setMenu] = useState(false);
  const [context, setContext] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  const counter = useRef(4);
  useEffect(() => {
    if (!tripId || !signedIn) return;
    let active = true;
    void api<{ trip: TripDto }>(`/trips/${tripId}`)
      .then((r) => {
        if (active) {
          setTrip(r.trip);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [tripId, signedIn, retry]);
  useEffect(() => {
    if (lines.length > 3)
      latest.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines]);
  useEffect(() => {
    if (!preview) return;
    const element = dialog.current;
    const prior = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      prior?.focus();
    };
  }, [preview]);
  const day = trip?.days[Math.min(dayIndex, Math.max(0, trip.days.length - 1))];
  const contextName = trip
    ? `${trip.destinationName} · Ngày ${Math.min(dayIndex + 1, trip.days.length)}`
    : 'Hội An · Ngày 2 (minh họa)';
  function send(text: string, topic?: Topic) {
    const clean = text.trim();
    if (!clean) return;
    const selected =
      topic ??
      (/mưa|trời/i.test(clean)
        ? 'rain'
        : /tiền|phí|rẻ|ngân sách/i.test(clean)
          ? 'budget'
          : /chậm|nghỉ|thư thả/i.test(clean)
            ? 'slow'
            : undefined);
    const userId = counter.current++;
    const replyId = counter.current++;
    setLines((old) => [
      ...old.slice(-10),
      { id: userId, role: 'user' as const, text: clean },
      {
        id: replyId,
        role: 'goe' as const,
        text: selected
          ? responses[selected].text
          : 'Mình đang ở chế độ minh họa. Bạn thử “Nếu chiều mưa”, “Giảm chi phí” hoặc “Đi chậm hơn” để xem cách Goe đề xuất thay đổi nhé.',
        ...(selected ? { topic: selected } : {}),
      },
    ]);
    setInput('');
  }
  return (
    <section className="goe-chat-page">
      <header className="goe-chat-header">
        <button
          aria-label="Quay lại"
          onClick={() => onNavigate(trip ? `/trips/${trip.id}` : '/')}
        >
          <ArrowLeft size={21} />
        </button>
        <img src="/images/goe-mascot-cutout.png" alt="Goe" />
        <div>
          <strong>Goe</strong>
          <small>Bạn đồng hành chuyến đi</small>
        </div>
        <button
          aria-label="Tùy chọn hội thoại"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <MoreHorizontal size={22} />
        </button>
      </header>
      {menu && (
        <div className="goe-chat-menu">
          <button
            onClick={() => {
              setLines(initialLines);
              setResolution({});
              setInput('');
              setMenu(false);
            }}
          >
            Bắt đầu lại bản minh họa
          </button>
          <button
            onClick={() =>
              onNavigate(trip ? `/trips/${trip.id}?view=cost` : '/trips')
            }
          >
            {trip
              ? 'Xem ngân sách chuyến đi'
              : 'Chọn chuyến đi để xem ngân sách'}
          </button>
        </div>
      )}
      <button
        className="goe-context-chip"
        onClick={() => setContext(!context)}
        aria-expanded={context}
      >
        <CalendarDays size={16} />
        Đang xem: {contextName}
      </button>
      {context && (
        <div className="goe-context-panel">
          {trip ? (
            <label>
              Chọn ngày
              <select
                aria-label="Ngày đang xem"
                value={Math.min(dayIndex, trip.days.length - 1)}
                onChange={(e) => setDayIndex(Number(e.target.value))}
              >
                {trip.days.map((d, i) => (
                  <option key={d.dayId} value={i}>
                    Ngày {i + 1} · {d.date}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              Đây là hành trình minh họa. Mở Goe từ một chuyến đi để xem ngữ
              cảnh của bạn.
            </p>
          )}
          <button onClick={() => onNavigate('/trips')}>
            Chọn chuyến đi khác →
          </button>
        </div>
      )}
      {tripId &&
        (!signedIn ? (
          <p className="goe-context-notice">
            Đăng nhập để mở ngữ cảnh chuyến đi.{' '}
            <button onClick={() => onNavigate('/login')}>Đăng nhập</button>
          </p>
        ) : status === 'loading' ? (
          <p role="status" className="goe-context-notice">
            Đang mở chuyến đi…
          </p>
        ) : status === 'error' ? (
          <p role="alert" className="goe-context-notice">
            Chưa mở được chuyến đi.{' '}
            <button
              onClick={() => {
                setStatus('loading');
                setRetry((v) => v + 1);
              }}
            >
              Thử lại
            </button>
          </p>
        ) : null)}
      <h1>
        Mình cùng
        <br />
        điều chỉnh nhé.<i aria-hidden="true">✦</i>
      </h1>
      <p className="goe-demo-note">Hội thoại minh họa · Chưa kết nối AI</p>
      <div
        className="goe-chat-messages"
        role="log"
        aria-label="Hội thoại với Goe"
        aria-live="polite"
      >
        {lines.map((line) => (
          <div key={line.id} className={`goe-chat-line ${line.role}`}>
            {line.role === 'goe' && (
              <img src="/images/goe-mascot-cutout.png" alt="" />
            )}
            <div
              className={`goe-chat-bubble ${line.topic ? 'has-suggestion' : ''}`}
            >
              <p>{line.text}</p>
              {line.topic && (
                <>
                  <div className="goe-proposal">
                    <strong>Gợi ý thay đổi</strong>
                    <span className="goe-before">
                      <Sun size={18} />
                      <s>{responses[line.topic].before}</s>
                    </span>
                    <ArrowDown size={17} />
                    <span className="goe-after">
                      <Landmark size={20} />
                      {responses[line.topic].after}
                    </span>
                  </div>
                  <p className="goe-keep-note">
                    <Info size={15} />
                    Giữ nguyên các điểm còn lại.
                  </p>
                  {resolution[line.id] ? (
                    <p className="goe-resolution" role="status">
                      <Check size={16} />
                      {resolution[line.id]}
                    </p>
                  ) : (
                    <div className="goe-proposal-actions">
                      <button
                        onClick={() => {
                          setSelectedMessage(line.id);
                          setPreview(line.topic!);
                        }}
                      >
                        Xem thay đổi
                      </button>
                      <button
                        onClick={() =>
                          setResolution((r) => ({
                            ...r,
                            [line.id]: 'Đã giữ lịch cũ trong bản xem trước.',
                          }))
                        }
                      >
                        Giữ lịch cũ
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={latest} />
      </div>
      <p className="goe-consider">Gợi ý để bạn cân nhắc.</p>
      <div className="goe-composer-area">
        <div className="goe-quick-prompts">
          <button
            onClick={() => send('Giảm chi phí cho chuyến đi nhé.', 'budget')}
          >
            <Coins size={16} />
            Giảm chi phí
          </button>
          <button onClick={() => send('Mình muốn đi chậm hơn.', 'slow')}>
            <Leaf size={16} />
            Đi chậm hơn
          </button>
        </div>
        <form
          className="goe-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            aria-label="Hỏi Goe về chuyến đi"
            placeholder="Hỏi Goe về chuyến đi…"
            maxLength={500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Gửi tin nhắn"
            disabled={!input.trim()}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
      {preview && (
        <dialog
          ref={dialog}
          className="journey-sheet goe-preview-sheet"
          aria-label="Xem trước thay đổi"
          onCancel={(e) => {
            e.preventDefault();
            setPreview(null);
          }}
        >
          <header>
            <h2>Xem trước thay đổi</h2>
            <button aria-label="Đóng" onClick={() => setPreview(null)}>
              <X size={20} />
            </button>
          </header>
          <p className="goe-preview-label">
            MINH HỌA · KHÔNG SỬA CHUYẾN ĐI ĐÃ LƯU
          </p>
          <h3>{contextName}</h3>
          {day && (
            <p className="goe-actual-context">
              Ngày này có {day.activities.length} điểm dừng trong lịch đã lưu.
              Đề xuất bên dưới là ví dụ giao diện.
            </p>
          )}
          <div className="goe-preview-change">
            <span>
              <Sun size={20} />
              {responses[preview].before}
            </span>
            <ArrowDown size={21} />
            <strong>
              <Landmark size={22} />
              {responses[preview].after}
            </strong>
          </div>
          <p className="goe-preview-help">
            Khi tính năng được kết nối, bạn sẽ xem thay đổi ở đây trước khi xác
            nhận cập nhật lịch trình.
          </p>
          <button
            className="journey-primary"
            onClick={() => {
              setResolution((r) => ({
                ...r,
                [selectedMessage]: 'Đã áp dụng vào bản minh họa.',
              }));
              setPreview(null);
            }}
          >
            Áp dụng vào bản minh họa <Check size={17} />
          </button>
          <button className="journey-outline" onClick={() => setPreview(null)}>
            Quay lại hội thoại
          </button>
        </dialog>
      )}
    </section>
  );
}
