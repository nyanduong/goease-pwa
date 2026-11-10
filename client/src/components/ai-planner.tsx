import { createPortal } from 'react-dom';
import { MascotRenderer } from '../mascot/renderer';
import { useMascot } from '../mascot/context';
import { AppInfo } from './app-info';
import { plannerTiming } from '@goease/contracts';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from '../icons';
import type { PlannerProposal, TripInput } from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { canRecoverAi } from '../ai-errors';

const previewFillMs = 3800;

function PlannerLoadingDialog({ ready }: { ready: boolean }) {
  const [elapsedPercent, setElapsedPercent] = useState(0);
  const percent = ready ? 100 : elapsedPercent;
  const dialog = useRef<HTMLDialogElement>(null);
  const { preferences, motionAllowed } = useMascot();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    if (ready || !motionAllowed) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const value = Math.min(
        99,
        Math.floor(((performance.now() - start) * 100) / previewFillMs),
      );
      setElapsedPercent(value);
      if (value === 99) window.clearInterval(timer);
    }, 40);
    return () => window.clearInterval(timer);
  }, [ready, motionAllowed]);
  return createPortal(
    <dialog
      ref={dialog}
      className="planner-loading-dialog"
      aria-labelledby="planner-loading-title"
      onCancel={(event) => event.preventDefault()}
      data-motion={motionAllowed}
    >
      {!preferences.hidden && (
        <div className="planner-dancing-goe">
          <MascotRenderer />
        </div>
      )}
      <strong id="planner-loading-title">Goe đang lên lịch…</strong>
      <div
        className="planner-loading-meter"
        role="progressbar"
        aria-label="Chuẩn bị hiển thị lịch"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="planner-loading-track">
          <span style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
        <span className="planner-loading-percent">{percent}%</span>
      </div>
    </dialog>,
    document.body,
  );
}

export function AiPlanner({
  draft,
  tripId,
  revision,
  onApply,
  immediatePreview = false,
  localCatalog = false,
  onBusyChange,
}: {
  draft: TripInput;
  tripId?: string | undefined;
  revision?: number | undefined;
  onApply: (value: TripInput) => void;
  immediatePreview?: boolean;
  localCatalog?: boolean;
  onBusyChange?: (value: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [proposal, setProposal] = useState<PlannerProposal | null>(null);
  const [recoverable, setRecoverable] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const { motionAllowed } = useMascot();
  const animatePreview = localCatalog && immediatePreview;
  const supported =
    Boolean(draft.destinations[0]?.destinationId) &&
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
    setPreviewReady(false);
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setQuotaReached(false);
    setCatalogUnavailable(false);
    setProposal(null);
    const base = JSON.stringify(draft);
    const payload = currentPayload;
    if (fresh || request.current?.payload !== payload)
      request.current = { payload, key: crypto.randomUUID() };
    const previewAt =
      performance.now() + (animatePreview && motionAllowed ? previewFillMs : 0);
    try {
      const result = await api<PlannerProposal>('/trips/ai-proposal', {
        method: 'POST',
        headers: { 'Idempotency-Key': request.current!.key },
        body: payload,
        signal: AbortSignal.timeout(plannerTiming.clientTimeoutMs),
      });
      const remaining = previewAt - performance.now();
      if (active.current && remaining > 0)
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, remaining),
        );
      if (!active.current) return;
      if (JSON.stringify(latest.current) !== base)
        throw new Error(
          'Bạn đã thay đổi thông tin khi Goe đang lập lịch. Hãy tạo đề xuất mới để dùng thông tin mới nhất.',
        );
      if (animatePreview && motionAllowed) {
        setPreviewReady(true);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
        if (!active.current) return;
      }
      snapshot.current = base;
      if (immediatePreview) onApply(result.trip);
      else setProposal(result);
    } catch (e) {
      setQuotaReached(e instanceof ApiFailure && e.code === 'AI_QUOTA');
      setCatalogUnavailable(
        e instanceof ApiFailure &&
          [
            'AI_CATALOG_EMPTY',
            'AI_CATALOG_COVERAGE',
            'AI_DAY_COVERAGE',
          ].includes(e.code ?? ''),
      );
      setRecoverable(canRecoverAi(e));
      setError(e instanceof Error ? e.message : 'Chưa tạo được đề xuất.');
    } finally {
      if (active.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  return (
    <section
      className={immediatePreview ? 'quick-generate' : 'ai-planner'}
      aria-label={
        localCatalog ? 'Goe xếp lịch theo danh mục' : 'Goe AI lập lịch'
      }
    >
      {localCatalog && (
        <small>
          Goe xếp lịch theo sở thích và giờ hoạt động trong danh mục Đà Nẵng.
        </small>
      )}
      {!immediatePreview && (
        <>
          <h2>
            <Sparkles size={19} /> Để Goe xếp lịch giúp bạn
          </h2>
          {!localCatalog && (
            <AppInfo title="Cách Goe tạo lịch">
              {' '}
              <p>
                Goe chọn điểm dừng và giờ đi từ những nơi có đủ giá và giờ hoạt
                động. Khả năng xếp lịch phụ thuộc dữ liệu tại điểm đến. Khi bấm
                tạo, ngày đi, số người, ngân sách và sở thích được gửi tới dịch
                vụ AI được cấu hình cho Goe. Tên, email và ghi chú riêng không
                được gửi.
              </p>
            </AppInfo>
          )}
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
      {busy && animatePreview && <PlannerLoadingDialog ready={previewReady} />}
      {busy && !animatePreview && (
        <p role="status">
          {localCatalog
            ? 'Đang kiểm tra điểm dừng và giờ hoạt động…'
            : 'Thường mất vài chục giây. Lịch trình hiện tại vẫn được giữ.'}
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
          <AppInfo title="Vì sao chưa tạo được lịch?">
            {' '}
            <p>
              {quotaReached
                ? 'Hôm nay đã hết lượt tạo lịch. Bạn có thể tự chọn điểm dừng hoặc quay lại vào ngày mai.'
                : catalogUnavailable
                  ? 'GoEase cần bổ sung địa điểm phù hợp cho chuyến này. Bấm tạo lại với cùng thông tin sẽ chưa giải quyết được. Bạn có thể giữ thông tin hoặc tự chọn điểm dừng.'
                  : immediatePreview
                    ? 'Thử lại bằng nút tạo lịch, hoặc chọn “Tự chọn điểm dừng” bên dưới.'
                    : 'Bạn có thể tạo lại, hoặc quay về lịch trình để tự chỉnh.'}{' '}
              Thông tin bạn chọn vẫn được giữ.
            </p>
          </AppInfo>
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
