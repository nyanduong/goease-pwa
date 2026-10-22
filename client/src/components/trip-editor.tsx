import { useState } from 'react';
import type { DestinationDto, TripInput } from '@goease/contracts';
import { interests, moneyText, withDays } from '../trip-draft';
import { Field, Goe } from './ui';
export function TripEditor({
  draft,
  onChange,
  destinations,
}: {
  draft: TripInput;
  onChange: (v: TripInput) => void;
  destinations: DestinationDto[];
}) {
  const [selectedDay, setSelectedDay] = useState(0);
  const day = draft.days[Math.min(selectedDay, draft.days.length - 1)];
  const update = (value: Partial<TripInput>) => {
    const next = withDays({ ...draft, ...value });
    if (
      draft.days.some(
        (d) => d.activities.length && !next.days.some((n) => n.date === d.date),
      ) &&
      !confirm(
        'Đổi khoảng ngày sẽ bỏ hoạt động của ngày không còn trong chuyến. Tiếp tục?',
      )
    )
      return;
    onChange(next);
  };
  const changeActivities = (
    activities: (typeof draft.days)[number]['activities'],
  ) =>
    onChange({
      ...draft,
      days: draft.days.map((d) =>
        d.dayId === day?.dayId
          ? { ...d, activities: activities.map((a, i) => ({ ...a, order: i })) }
          : d,
      ),
    });
  const known = draft.days
    .flatMap((d) => d.activities)
    .reduce((sum, a) => sum + (a.estimatedCost.amountMinor ?? 0), 0);
  const missing = draft.days
    .flatMap((d) => d.activities)
    .filter((a) => a.estimatedCost.amountMinor === null).length;
  return (
    <div className="editor-layout">
      <aside className="panel trip-settings">
        <div className="panel-title">
          <span>01</span>
          <h2>Thông tin chuyến đi</h2>
        </div>
        <Field label="Tên chuyến đi">
          <input
            value={draft.title}
            maxLength={120}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="Ví dụ: Ba ngày thong thả ở Đà Nẵng"
          />
        </Field>
        <Field label="Điểm đến">
          <select
            value={draft.destinations[0]?.destinationId ?? ''}
            onChange={(e) =>
              update({
                destinations: e.target.value
                  ? [{ destinationId: e.target.value, order: 0 }]
                  : [],
              })
            }
          >
            <option value="">Chọn điểm đến</option>
            {destinations.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        {!destinations.length && (
          <p className="muted">Chưa tải được danh mục điểm đến từ server.</p>
        )}
        <div className="field-row">
          <Field label="Ngày đi">
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Ngày về">
            <input
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(e) => update({ endDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Số người">
            <input
              type="number"
              min={1}
              max={1000}
              value={draft.travelers.totalCount || ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  travelers: { totalCount: Number(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Ngân sách tổng nhóm (VND)">
            <input
              type="number"
              min={0}
              step={1000}
              value={draft.budget.amountMinor ?? ''}
              placeholder="Chưa xác định"
              onChange={(e) =>
                onChange({
                  ...draft,
                  budget: {
                    ...draft.budget,
                    amountMinor:
                      e.target.value === '' ? null : Number(e.target.value),
                  },
                })
              }
            />
          </Field>
        </div>
        <Field label="Nhịp điệu">
          <select
            value={draft.preferences.pace}
            onChange={(e) =>
              onChange({
                ...draft,
                preferences: {
                  ...draft.preferences,
                  pace: e.target.value as TripInput['preferences']['pace'],
                },
              })
            }
          >
            <option value="relaxed">Thong thả</option>
            <option value="balanced">Vừa phải</option>
            <option value="active">Năng động</option>
          </select>
        </Field>
        <div className="field">
          <span>Bạn thích điều gì?</span>
          <div className="chips">
            {Object.entries(interests).map(([key, label]) => {
              const code = key as keyof typeof interests;
              return (
                <button
                  className={
                    draft.preferences.interestCodes.includes(code)
                      ? 'chip selected'
                      : 'chip'
                  }
                  aria-pressed={draft.preferences.interestCodes.includes(code)}
                  key={key}
                  onClick={() =>
                    onChange({
                      ...draft,
                      preferences: {
                        ...draft.preferences,
                        interestCodes: draft.preferences.interestCodes.includes(
                          code,
                        )
                          ? draft.preferences.interestCodes.filter(
                              (v) => v !== code,
                            )
                          : [...draft.preferences.interestCodes, code],
                      },
                    })
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Ghi chú chuyến đi">
          <textarea
            rows={3}
            value={draft.notes}
            maxLength={2000}
            placeholder="Những điều nhỏ bạn muốn nhớ…"
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </Field>
      </aside>
      <div className="itinerary">
        <div className="panel-title">
          <span>02</span>
          <h2>Từng ngày, từng trải nghiệm</h2>
        </div>
        <p className="muted">Lịch trình thủ công · Giờ địa phương Việt Nam</p>
        {!draft.days.length ? (
          <div className="empty-state panel">
            <span>☀</span>
            <h3>Chọn một nơi, dành ra vài ngày.</h3>
            <p>
              Chọn điểm đến và khoảng ngày hợp lệ (tối đa 31 ngày) để bắt đầu
              thêm hoạt động.
            </p>
          </div>
        ) : (
          <>
            <div
              className="day-tabs"
              role="tablist"
              aria-label="Ngày trong chuyến"
            >
              {draft.days.map((d, i) => (
                <button
                  key={d.dayId}
                  role="tab"
                  aria-selected={d.dayId === day?.dayId}
                  className={
                    d.dayId === day?.dayId ? 'day-tab selected' : 'day-tab'
                  }
                  onClick={() => setSelectedDay(i)}
                >
                  Ngày {i + 1}
                  <small>
                    {d.date.slice(5).split('-').reverse().join('/')}
                  </small>
                </button>
              ))}
            </div>
            <div className="day-heading">
              <h3>
                Ngày {draft.days.indexOf(day!) + 1} <span>· {day?.date}</span>
              </h3>
              <span className="pill">
                {day?.activities.length ?? 0} hoạt động
              </span>
            </div>
            {day?.activities.map((a, i) => (
              <article className="activity-card" key={a.activityId}>
                <div className="activity-number">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="activity-fields">
                  <div className="activity-title-row">
                    <Field label="Tên hoạt động">
                      <input
                        value={a.title}
                        maxLength={120}
                        placeholder="Bạn muốn làm gì?"
                        onChange={(e) =>
                          changeActivities(
                            day.activities.map((v) =>
                              v.activityId === a.activityId
                                ? { ...v, title: e.target.value }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <button
                      className="remove-button"
                      aria-label={`Xóa hoạt động ${i + 1}`}
                      onClick={() =>
                        changeActivities(
                          day.activities.filter(
                            (v) => v.activityId !== a.activityId,
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                  <div className="activity-time-row">
                    <Field label="Bắt đầu">
                      <input
                        type="time"
                        value={a.startLocalTime ?? ''}
                        onChange={(e) =>
                          changeActivities(
                            day.activities.map((v) =>
                              v.activityId === a.activityId
                                ? {
                                    ...v,
                                    startLocalTime: e.target.value || undefined,
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Kết thúc">
                      <input
                        type="time"
                        value={a.endLocalTime ?? ''}
                        onChange={(e) =>
                          changeActivities(
                            day.activities.map((v) =>
                              v.activityId === a.activityId
                                ? {
                                    ...v,
                                    endLocalTime: e.target.value || undefined,
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Chi phí nhóm (VND)">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={a.estimatedCost.amountMinor ?? ''}
                        placeholder="Chưa rõ"
                        onChange={(e) =>
                          changeActivities(
                            day.activities.map((v) =>
                              v.activityId === a.activityId
                                ? {
                                    ...v,
                                    estimatedCost: {
                                      ...v.estimatedCost,
                                      amountMinor:
                                        e.target.value === ''
                                          ? null
                                          : Number(e.target.value),
                                    },
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Ghi chú hoạt động">
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={a.notes}
                      placeholder="Địa chỉ, điều muốn thử, điều cần nhớ…"
                      onChange={(e) =>
                        changeActivities(
                          day.activities.map((v) =>
                            v.activityId === a.activityId
                              ? { ...v, notes: e.target.value }
                              : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  {i > 0 &&
                    a.startLocalTime &&
                    day.activities[i - 1]?.endLocalTime &&
                    a.startLocalTime < day.activities[i - 1]!.endLocalTime! && (
                      <p className="warning-text">
                        Giờ hoạt động đang chồng lấp. Bạn nên kiểm tra lại lịch.
                      </p>
                    )}
                </div>
              </article>
            ))}
            <button
              className="add-activity"
              disabled={(day?.activities.length ?? 0) >= 50}
              onClick={() => {
                if (day)
                  changeActivities([
                    ...day.activities,
                    {
                      activityId: crypto.randomUUID(),
                      title: '',
                      kind: 'custom',
                      timezone: 'Asia/Ho_Chi_Minh',
                      order: day.activities.length,
                      notes: '',
                      estimatedCost: {
                        amountMinor: null,
                        currency: 'VND',
                        basis: 'group_total',
                        quantity: 1,
                        confidence: 'user_entered',
                      },
                      source: 'manual',
                    },
                  ]);
              }}
            >
              ＋ Thêm hoạt động
            </button>
          </>
        )}
      </div>
      <aside className="trip-context">
        <section className="cost-panel">
          <p className="eyebrow">DỰ TOÁN CẢ NHÓM</p>
          <h2>Vui trong ngân sách.</h2>
          <div className="budget-summary">
            <span>Chi phí hoạt động đã nhập</span>
            <strong>{moneyText(known)}</strong>
            <span>
              {draft.travelers.totalCount > 0
                ? `${moneyText(Math.round(known / draft.travelers.totalCount))} / người`
                : 'Nhập số người để tính bình quân'}
            </span>
            <p>
              {draft.budget.amountMinor === null
                ? 'Chưa đặt ngân sách nhóm'
                : `${draft.budget.amountMinor - known < 0 ? 'Vượt ngân sách' : 'Còn trong ngân sách'}: ${moneyText(Math.abs(draft.budget.amountMinor - known))}`}
            </p>
            <small>
              {missing
                ? `${missing} hoạt động chưa rõ chi phí. Tổng và số dư chưa đầy đủ.`
                : 'Chi phí do bạn nhập, chưa phải giá dịch vụ xác nhận.'}
            </small>
            <small>
              Khoản còn lại là dự phòng tạm tính; các khoản chưa nhập chưa được
              trừ.
            </small>
          </div>
        </section>
        <div className="goe-tip">
          <Goe />
          <div>
            <strong>Mỗi ngày, một khoảng thở.</strong>
            <p>Thêm giờ và ghi chú để lịch trình dễ theo dõi hơn.</p>
            <small>Hướng dẫn tĩnh từ GoEase</small>
          </div>
        </div>
      </aside>
    </div>
  );
}
