import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  expenseInputSchema,
  type ExpenseDto,
  type ExpenseInput,
  type ExpenseListDto,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { moneyText } from '../trip-draft';
import { Sheet } from './journey-sheet';
const categories = {
  transport: 'Di chuyển',
  lodging: 'Lưu trú',
  meal: 'Ăn uống',
  visit: 'Trải nghiệm',
  other: 'Khác',
} as const;
const empty = (): ExpenseInput => ({
  description: '',
  amountMinor: 0,
  category: 'meal',
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  spentOn: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
});
type Operation = {
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: string;
  key: string;
};
export function TripExpenses({
  tripId,
  tripRevision,
  unsaved,
  summaryOnly = false,
}: {
  tripId: string;
  tripRevision: number;
  unsaved: boolean;
  summaryOnly?: boolean;
}) {
  const [data, setData] = useState<ExpenseListDto | null>(null);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [editing, setEditing] = useState<ExpenseDto | null | undefined>(
    undefined,
  );
  const [form, setForm] = useState<ExpenseInput>(empty);
  const [amount, setAmount] = useState('');
  const initial = useRef('');
  const pending = useRef<Operation | null>(null);
  const base = `/trips/${tripId}/expenses`;
  const dirty =
    editing !== undefined &&
    JSON.stringify({ ...form, amount }) !== initial.current;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    void api<ExpenseListDto>(`${base}?offset=${offset}&limit=25`)
      .then((value) => {
        if (!active) return;
        if (offset > 0 && value.items.length === 0) {
          setOffset(Math.max(0, offset - 25));
          return;
        }
        setData(value);
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : 'Chưa tải được chi tiêu.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [base, offset, reload, tripRevision]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || uncertain || busy) e.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty, uncertain, busy]);
  function open(value: ExpenseDto | null) {
    const next = value
      ? {
          description: value.description,
          category: value.category,
          amountMinor: value.amountMinor,
          currency: value.currency,
          spentOn: value.spentOn,
          timezone: value.timezone,
        }
      : empty();
    const text = value ? String(value.amountMinor) : '';
    setEditing(value);
    setForm(next);
    setAmount(text);
    setError('');
    setNotice('');
    pending.current = null;
    initial.current = JSON.stringify({ ...next, amount: text });
  }
  function close() {
    if (busy) return;
    if (
      (dirty || uncertain) &&
      !confirm(
        uncertain
          ? 'Kết quả lưu chưa rõ. Đóng và tải lại danh sách để kiểm tra trước khi tạo khoản mới?'
          : 'Khoản chi chưa lưu. Bạn muốn bỏ nội dung đang nhập?',
      )
    )
      return;
    setEditing(undefined);
    setError('');
    setUncertain(false);
    pending.current = null;
    setReload((v) => v + 1);
  }
  async function execute(operation: Operation) {
    if (busy) return;
    pending.current = operation;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(operation.url, {
        method: operation.method,
        body: operation.body,
        headers: { 'Idempotency-Key': operation.key },
      });
      pending.current = null;
      setUncertain(false);
      setEditing(undefined);
      setNotice(
        operation.method === 'DELETE'
          ? 'Đã xóa khoản chi.'
          : 'Đã lưu khoản chi.',
      );
      setOffset(0);
      setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác.');
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
  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || uncertain) return;
    const checked = expenseInputSchema.safeParse({
      ...form,
      amountMinor: Number(amount),
    });
    if (!checked.success) {
      setError(
        'Nhập tên, ngày hợp lệ và số tiền nguyên từ 1 đến 1.000.000.000.000đ.',
      );
      return;
    }
    void execute({
      url: editing ? `${base}/${editing.id}` : base,
      method: editing ? 'PATCH' : 'POST',
      body: JSON.stringify({
        expense: checked.data,
        ...(editing ? { expectedRevision: editing.revision } : {}),
      }),
      key: crypto.randomUUID(),
    });
  }
  const locked = loading || Boolean(loadError) || busy || uncertain;
  const feedback = (
    <>
      {error && <p role="alert">{error}</p>}
      {uncertain && (
        <p role="alert">
          Chưa xác nhận được kết quả. Thử lại cùng thao tác để tránh lưu trùng.{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => pending.current && void execute(pending.current)}
          >
            Thử lại thao tác
          </button>
        </p>
      )}
    </>
  );
  return (
    <section className="trip-expenses" aria-label="Chi tiêu thực tế">
      <header>
        <span className="journey-eyebrow">CHI TIÊU CỦA CHUYẾN ĐI</span>
        <h1>Mình đã chi bao nhiêu?</h1>
        <p>Ghi tổng tiền đã chi cho cả nhóm bằng VND.</p>
      </header>
      {unsaved && (
        <p className="expense-warning">
          Có thay đổi lịch hoặc ngân sách chưa lưu. So sánh bên dưới dùng phiên
          bản chuyến đi đã lưu.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {editing === undefined && feedback}
      {loading && <p role="status">Đang tải chi tiêu…</p>}
      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button onClick={() => setReload((v) => v + 1)}>
            Tải lại chi tiêu
          </button>
        </p>
      )}
      {data && !loading && !loadError && (
        <>
          <div className="expense-total-card">
            <small>TỔNG CHI TIÊU ĐÃ GHI LẠI</small>
            <strong className="expense-total">
              {moneyText(data.actual.amountMinor)}
            </strong>
            <p>{moneyText(data.actual.perPersonMinor)} / người · bình quân</p>
            <b className="expense-remaining">
              {data.actual.remainingMinor === null
                ? 'Chưa đặt ngân sách'
                : data.actual.remainingMinor < 0
                  ? `Vượt ngân sách ${moneyText(-data.actual.remainingMinor)}`
                  : `Ngân sách còn lại ${moneyText(data.actual.remainingMinor)}`}
            </b>
          </div>
          <dl className="expense-comparison">
            <div>
              <dt>Ngân sách cả nhóm</dt>
              <dd>
                {data.budget.budgetMinor === null
                  ? 'Chưa đặt'
                  : moneyText(data.budget.budgetMinor)}
              </dd>
            </div>
            <div>
              <dt>Chi phí dự kiến đã biết</dt>
              <dd>{moneyText(data.budget.knownEstimatedMinor)}</dd>
            </div>
            <div>
              <dt>Đã chi − chi phí dự kiến đã biết</dt>
              <dd>
                {data.actual.differenceFromEstimateMinor > 0 ? '+' : ''}
                {moneyText(data.actual.differenceFromEstimateMinor)}
              </dd>
            </div>
          </dl>
          <p className="expense-caption">
            {data.budget.missingCostCount > 0
              ? `${data.budget.missingCostCount} điểm dừng chưa có giá dự kiến. `
              : ''}
            Chỉ gồm khoản chi bạn đã nhập; chênh lệch âm chưa có nghĩa chuyến đi
            tiết kiệm.
          </p>
          <div className="expense-categories" aria-label="Chi tiêu theo nhóm">
            {data.actual.categories.map((c) => (
              <div key={c.key}>
                <span>{categories[c.key]}</span>
                <b>{moneyText(c.amountMinor)}</b>
              </div>
            ))}
          </div>
          {!summaryOnly && (
            <>
              <div className="expense-list-heading">
                <h2>
                  Các khoản đã chi <small>({data.totalCount})</small>
                </h2>
                <button
                  className="button button-primary"
                  disabled={locked}
                  onClick={() => open(null)}
                >
                  + Thêm khoản chi
                </button>
              </div>
              {!data.items.length ? (
                <p className="expense-empty">
                  Chưa ghi nhận khoản chi nào. Thêm khoản đầu tiên khi bạn đã
                  chi tiền.
                </p>
              ) : (
                <ul className="expense-list">
                  {data.items.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.description}</strong>
                        <small>
                          {categories[item.category]} ·{' '}
                          {item.spentOn.split('-').reverse().join('/')}
                        </small>
                      </div>
                      <b>{moneyText(item.amountMinor)}</b>
                      <div className="expense-actions">
                        <button
                          disabled={locked}
                          aria-label={`Sửa ${item.description}`}
                          onClick={() => open(item)}
                        >
                          Sửa
                        </button>
                        <button
                          disabled={locked}
                          aria-label={`Xóa ${item.description}`}
                          onClick={() => {
                            if (confirm(`Xóa khoản chi “${item.description}”?`))
                              void execute({
                                url: `${base}/${item.id}`,
                                method: 'DELETE',
                                body: JSON.stringify({
                                  expectedRevision: item.revision,
                                }),
                                key: crypto.randomUUID(),
                              });
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="expense-pagination">
                <button
                  disabled={locked || offset === 0}
                  onClick={() => setOffset((v) => Math.max(0, v - 25))}
                >
                  Trang trước
                </button>
                <span>Trang {Math.floor(offset / 25) + 1}</span>
                <button
                  disabled={locked || !data.hasMore}
                  onClick={() => setOffset((v) => v + 25)}
                >
                  Trang sau
                </button>
              </div>
            </>
          )}
        </>
      )}
      {editing !== undefined && (
        <Sheet
          title={editing ? 'Sửa khoản chi' : 'Thêm khoản chi'}
          onClose={close}
        >
          <form onSubmit={submit} className="expense-form">
            <fieldset disabled={busy || uncertain}>
              <label>
                Tên khoản chi
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <label>
                Số tiền đã chi (VND)
                <input
                  required
                  inputMode="numeric"
                  type="number"
                  min="1"
                  max="1000000000000"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Nhóm chi phí
                <select
                  aria-label="Nhóm chi phí"
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as ExpenseInput['category'],
                    })
                  }
                >
                  {Object.entries(categories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày chi
                <input
                  required
                  type="date"
                  value={form.spentOn}
                  onInput={(e) =>
                    setForm({ ...form, spentOn: e.currentTarget.value })
                  }
                  onChange={(e) =>
                    setForm({ ...form, spentOn: e.target.value })
                  }
                />
              </label>
            </fieldset>
            <p className="expense-caption">
              Nhập tổng khoản chi, không nhân thêm số người. Có thể ghi khoản
              chi trước hoặc sau ngày đi.
            </p>
            {feedback}
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || uncertain}
            >
              {busy ? 'Đang lưu…' : 'Lưu khoản chi'}
            </button>
            {error && !uncertain && (
              <button type="button" onClick={() => setReload((v) => v + 1)}>
                Tải lại danh sách
              </button>
            )}
          </form>
        </Sheet>
      )}
    </section>
  );
}
