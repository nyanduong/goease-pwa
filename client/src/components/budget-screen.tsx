import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  Car,
  MapPin,
  SlidersHorizontal,
  Ticket,
  Utensils,
  Wallet,
  Shapes,
} from 'lucide-react';
import type {
  ActivityInput,
  TripInput,
  BudgetSummary,
} from '@goease/contracts';
import { api } from '../api';
import { moneyText } from '../trip-draft';
import { priceFitsGroup } from '@goease/contracts';

const categories = [
  { key: 'transport', label: 'Di chuyển', color: '#1d6152', Icon: Car },
  { key: 'lodging', label: 'Lưu trú', color: '#abc5a9', Icon: BedDouble },
  { key: 'meal', label: 'Ăn uống', color: '#efb64f', Icon: Utensils },
  { key: 'visit', label: 'Trải nghiệm', color: '#d48059', Icon: Ticket },
  { key: 'other', label: 'Khác', color: '#95a7ab', Icon: Shapes },
] as const;
type BudgetProps = {
  summary?: BudgetSummary;
  destinationName: string;
  days: number;
  travelers: number;
  budget: number | null;
  activities: Pick<ActivityInput, 'kind' | 'estimatedCost'>[];
  onAdjust: () => void;
  onReview?: () => void;
  demo?: boolean;
};

export function BudgetScreen({
  destinationName,
  days,
  travelers,
  budget,
  activities,
  onAdjust,
  onReview,
  demo = false,
  summary,
}: BudgetProps) {
  const rows = categories.map((category) => {
    const serverRow = summary?.categories.find(
      (row) => row.key === category.key,
    );
    if (serverRow)
      return {
        ...category,
        amount: serverRow.amountMinor,
        missing: serverRow.missingCostCount,
      };
    const entries = activities.filter((a) =>
      category.key === 'other'
        ? !['transport', 'lodging', 'meal', 'visit'].includes(a.kind)
        : a.kind === category.key,
    );
    return {
      ...category,
      amount: entries.reduce(
        (n, a) =>
          n +
          (priceFitsGroup(a.estimatedCost, travelers)
            ? (a.estimatedCost.amountMinor ?? 0) *
              (a.estimatedCost.basis === 'per_person' ? travelers : 1)
            : 0),
        0,
      ),
      missing: entries.filter(
        (a) =>
          a.estimatedCost.amountMinor === null ||
          !priceFitsGroup(a.estimatedCost, travelers),
      ).length,
    };
  });
  const known =
    summary?.knownEstimatedMinor ?? rows.reduce((n, r) => n + r.amount, 0);
  const missing =
    summary?.missingCostCount ??
    activities.filter(
      (a) =>
        a.estimatedCost.amountMinor === null ||
        !priceFitsGroup(a.estimatedCost, travelers),
    ).length;
  const hasPrices = activities.some(
    (a) =>
      a.estimatedCost.amountMinor !== null &&
      priceFitsGroup(a.estimatedCost, travelers),
  );
  const incomplete = missing > 0 || !hasPrices;
  const percent = summary
    ? summary.usedPercent
    : budget !== null && budget > 0
      ? Math.round((known / budget) * 100)
      : null;
  const remaining = summary
    ? summary.remainingMinor
    : budget === null
      ? null
      : budget - known;
  let angle = 0;
  const gradient = known
    ? rows
        .map((r) => {
          const start = angle;
          angle += (r.amount / known) * 360;
          return `${r.color} ${start}deg ${angle}deg`;
        })
        .join(',')
    : '#e4e8dd 0deg 360deg';
  return (
    <section className="budget-screen" aria-label="Dự toán chi phí chuyến đi">
      <div className="budget-landscape">
        <img
          src={
            /hội an/i.test(destinationName)
              ? '/images/explore-hoian.png'
              : '/images/welcome-halong-bay.png'
          }
          alt="Ảnh phong cảnh minh họa AI"
        />
        <span className="budget-context">
          <MapPin size={15} />
          {destinationName} · {days} ngày · {travelers} người
        </span>
        <h1>
          Dự toán
          <br />
          chuyến đi.<i aria-hidden="true">✦</i>
        </h1>
      </div>
      {demo && (
        <p className="mvp-demo-label">BẢN XEM TRƯỚC · SỐ LIỆU MINH HỌA</p>
      )}
      {incomplete && (
        <div className="budget-incomplete" role="status">
          <strong>Chưa đủ dữ liệu để tính tổng chuyến đi</strong>
          <p>
            {missing
              ? `${missing} điểm dừng chưa có giá. `
              : 'Bạn chưa nhập chi phí. '}
            {budget === null
              ? 'Bạn vẫn có thể dùng lịch này mà không cần nhập ngân sách.'
              : remaining !== null && remaining < 0
                ? 'Các khoản đã nhập đã vượt ngân sách; vẫn còn chi phí cần bổ sung.'
                : 'Chưa thể biết ngân sách có đủ hay không.'}
          </p>
          {onReview && (
            <button className="journey-outline" onClick={onReview}>
              {budget === null
                ? 'Tự thêm chi phí (tùy chọn)'
                : 'Bổ sung chi phí trong lịch'}
            </button>
          )}
        </div>
      )}
      <div className="budget-green-card">
        <span className="budget-eyebrow">DỰ TOÁN NHÓM ĐÃ BIẾT</span>
        <strong
          className={`budget-total ${!hasPrices ? 'budget-no-price' : ''}`}
        >
          {hasPrices ? moneyText(known) : 'Chưa có dự toán'}
        </strong>
        <p className="budget-per-person">
          {!hasPrices
            ? 'Chi phí sẽ hiển thị khi có giá đủ căn cứ.'
            : travelers > 0
              ? `${moneyText(summary?.perPersonMinor ?? Math.round(known / travelers))} / người`
              : 'Chưa xác định số người'}
        </p>
        <img
          className="budget-goe"
          src="/images/goe-mascot-cutout.png"
          alt="Goe"
        />
        {!incomplete && (
          <div className="budget-meter-row">
            <div
              className="budget-meter"
              role="meter"
              aria-label="Ngân sách đã dùng theo chi phí đã nhập"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, percent ?? 0)}
              aria-valuetext={
                percent === null
                  ? 'Chưa có mức ngân sách để so sánh'
                  : `${percent}% ngân sách`
              }
            >
              <span style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
            </div>
            <span>{percent === null ? '—' : `${percent}%`}</span>
          </div>
        )}
        <span
          className={`budget-reserve ${remaining !== null && remaining < 0 ? 'over-budget' : ''}`}
        >
          <Wallet size={17} />
          {remaining !== null && remaining < 0
            ? `Đã vượt ngân sách ${moneyText(-remaining)}${missing ? ' (còn khoản chưa có giá)' : ''}`
            : incomplete
              ? budget === null
                ? 'Ngân sách không bắt buộc'
                : `Ngân sách bạn đặt: ${moneyText(budget)}`
              : remaining === null
                ? 'Ngân sách không bắt buộc'
                : `Chênh lệch với khoản đã nhập: ${moneyText(remaining)}`}
        </span>
      </div>
      {!demo && (
        <div className="budget-scope-note">
          <strong>Dự toán tham khảo cho cả nhóm</strong>
          <p>
            App tự dùng giá đã biên tập và nhân số người khi tính theo người.
            Đây chưa phải giá đặt dịch vụ.
          </p>
          <p>
            {!activities.some((a) => a.kind === 'lodging') &&
              'Chưa bao gồm chỗ ở. '}
            {!activities.some((a) => a.kind === 'transport') &&
              'Chưa bao gồm di chuyển. '}
            Các khoản chưa thêm vào lịch chưa nằm trong tổng.
          </p>
        </div>
      )}
      {activities.some((a) => a.estimatedCost.reference) && (
        <details className="budget-price-sources">
          <summary>Giá nào đang được dùng?</summary>
          {activities
            .filter((a) => a.estimatedCost.reference)
            .map((a, i) => {
              const p = a.estimatedCost.reference!;
              return (
                <div key={i}>
                  <strong>
                    {p.label} · {moneyText(p.amountMinor)} /{' '}
                    {p.basis === 'per_person' ? 'người' : 'nhóm'}
                  </strong>
                  <p>{p.conditions}</p>
                  <small>
                    Đối chiếu {p.checkedAt} · Nhóm tối đa {p.maxTravelers} người
                  </small>
                  {!priceFitsGroup(a.estimatedCost, travelers) && (
                    <p>
                      Không áp dụng cho số người hiện tại — chưa tính khoản này.
                    </p>
                  )}
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                    Xem nguồn giá ↗
                  </a>
                </div>
              );
            })}
        </details>
      )}
      <section className="budget-breakdown" aria-label="Chi phí theo nhóm">
        <div
          className="budget-donut"
          style={{ background: `conic-gradient(${gradient})` }}
          role="img"
          aria-label={
            known
              ? `Tổng chi phí đã nhập ${moneyText(known)}. Chi tiết ở danh sách bên cạnh.`
              : 'Chưa có chi phí đã nhập'
          }
        >
          <span>
            <strong>{travelers}</strong>
            <small>người</small>
          </span>
        </div>
        <ul>
          {rows
            .filter((r) => r.key !== 'other' || r.amount > 0 || r.missing > 0)
            .map(
              ({ key, label, amount, color, Icon, missing: unknownCount }) => (
                <li key={key}>
                  <span
                    className="budget-color"
                    style={{ background: color }}
                  />
                  <Icon size={16} />
                  <span>{label}</span>
                  <b>
                    {!activities.some((a) =>
                      key === 'other'
                        ? !['transport', 'lodging', 'meal', 'visit'].includes(
                            a.kind,
                          )
                        : a.kind === key,
                    )
                      ? 'Chưa thêm'
                      : unknownCount
                        ? amount > 0
                          ? `${moneyText(amount)} + ?`
                          : 'Chưa rõ'
                        : moneyText(amount)}
                  </b>
                </li>
              ),
            )}
        </ul>
      </section>
      <p className="budget-disclaimer">
        {missing
          ? `${missing} điểm dừng chưa rõ chi phí. Tổng và dự phòng chưa đầy đủ.`
          : activities.length
            ? 'Các điểm đã nhập đủ giá ước tính; chưa có nghĩa đã bao gồm mọi chi phí chuyến đi.'
            : 'Chưa có chi phí hoạt động. Thêm điểm dừng và khoản dự kiến để xem dự toán.'}
      </p>
      {!demo && (
        <p className="budget-source-note">
          Nhớ bổ sung tiền đến và rời điểm đến, chỗ ở, ăn uống và đi lại. Chỉ
          các khoản đã nhập mới được cộng; “Chưa thêm” không có nghĩa là miễn
          phí.
        </p>
      )}
      <button className="budget-adjust" onClick={onAdjust}>
        <SlidersHorizontal size={17} />
        Điều chỉnh ngân sách
      </button>
    </section>
  );
}

export function TripBudget({
  draft,
  destinationName,
  onAdjust,
  onReview,
}: {
  draft: TripInput;
  destinationName: string;
  onAdjust: () => void;
  onReview?: () => void;
}) {
  const [result, setResult] = useState<{
    payload: string;
    budget: BudgetSummary;
  } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const payload = JSON.stringify({
    trip: {
      ...draft,
      title: draft.title.trim() || `Chuyến đi ${destinationName}`,
    },
  });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setError('');
      void api<{ budget: BudgetSummary }>('/trips/budget-preview', {
        method: 'POST',
        body: payload,
      })
        .then((r) => {
          if (active) setResult({ payload, budget: r.budget });
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : 'Chưa tính được chi phí.',
            );
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [payload, retry]);
  if (error)
    return (
      <section className="journey-empty" role="alert">
        <h2>Chưa tính được ngân sách</h2>
        <p>{error}</p>
        <button
          className="journey-outline"
          onClick={() => {
            setError('');
            setRetry((v) => v + 1);
          }}
        >
          Thử lại
        </button>
      </section>
    );
  if (result?.payload !== payload)
    return (
      <p role="status" className="journey-notice">
        Đang tính ngân sách từ server…
      </p>
    );
  return (
    <BudgetScreen
      summary={result.budget}
      destinationName={destinationName}
      days={draft.days.length}
      travelers={draft.travelers.totalCount}
      budget={draft.budget.amountMinor}
      activities={draft.days.flatMap((d) => d.activities)}
      onAdjust={onAdjust}
      {...(onReview ? { onReview } : {})}
    />
  );
}

export function BudgetPreview({ onBack }: { onBack: () => void }) {
  const [budget, setBudget] = useState<number | null>(10000000);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('10000000');
  const activities = (
    [
      { kind: 'transport', amount: 2000000 },
      { kind: 'lodging', amount: 3200000 },
      { kind: 'meal', amount: 2000000 },
      { kind: 'visit', amount: 1000000 },
    ] as const
  ).map(({ kind, amount }) => ({
    kind,
    estimatedCost: {
      amountMinor: amount,
      currency: 'VND' as const,
      basis: 'group_total' as const,
      quantity: 1 as const,
      confidence: 'user_entered' as const,
    },
  }));
  return (
    <div className="budget-preview">
      <header className="mvp-page-header">
        <button aria-label="Quay lại" onClick={onBack}>
          <ArrowLeft size={21} />
        </button>
        <h2>Chi phí chuyến đi</h2>
      </header>
      <BudgetScreen
        destinationName="Hội An"
        days={3}
        travelers={4}
        budget={budget}
        activities={activities}
        demo
        onAdjust={() => {
          setInput(budget === null ? '' : String(budget));
          setEditing(true);
        }}
      />
      {editing && (
        <form
          className="budget-preview-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBudget(input === '' ? null : Number(input));
            setEditing(false);
          }}
        >
          <label className="journey-field">
            Ngân sách minh họa (VND)
            <input
              type="number"
              min={0}
              max={1e12}
              step={1}
              aria-label="Ngân sách minh họa (VND)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <button className="journey-primary" type="submit">
            Cập nhật bản xem trước
          </button>
          <button
            type="button"
            className="journey-outline"
            onClick={() => setEditing(false)}
          >
            Hủy
          </button>
        </form>
      )}
    </div>
  );
}
