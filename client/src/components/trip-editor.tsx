import { useState, useRef, type KeyboardEvent } from 'react';
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
  const [settingsOpen, setSettingsOpen] = useState(true);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const dayIndex = Math.min(selectedDay, Math.max(0, draft.days.length - 1));
  const day = draft.days[dayIndex];

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

  const handleTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % draft.days.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + draft.days.length) % draft.days.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = draft.days.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setSelectedDay(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="editor-layout">
      {/* Left panel: Trip Settings with clean logical grouping */}
      <aside className="trip-settings-sidebar">
        <div className="panel trip-settings">
          <div className="panel-title-bar">
            <div className="panel-title">
              <span className="step-num">01</span>
              <h2>Thông tin chuyến đi</h2>
            </div>
            <button
              type="button"
              className="settings-toggle-btn"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              aria-label={settingsOpen ? 'Thu gọn cài đặt' : 'Mở rộng cài đặt'}
            >
              {settingsOpen ? 'Thu gọn' : 'Chỉnh sửa'}
            </button>
          </div>

          <div
            className={`settings-content ${settingsOpen ? 'open' : 'collapsed'}`}
          >
            <div className="settings-group">
              <Field label="Tên chuyến đi">
                <input
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) =>
                    onChange({ ...draft, title: e.target.value })
                  }
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
                <p className="muted small">
                  Chưa tải được danh mục điểm đến từ server.
                </p>
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
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="settings-group">
              <Field label="Nhịp điệu">
                <select
                  value={draft.preferences.pace}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      preferences: {
                        ...draft.preferences,
                        pace: e.target
                          .value as TripInput['preferences']['pace'],
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
                <span className="field-label-text">Bạn thích điều gì?</span>
                <div className="chips">
                  {Object.entries(interests).map(([key, label]) => {
                    const code = key as keyof typeof interests;
                    const isSelected =
                      draft.preferences.interestCodes.includes(code);
                    return (
                      <button
                        type="button"
                        className={isSelected ? 'chip selected' : 'chip'}
                        aria-pressed={isSelected}
                        key={key}
                        onClick={() =>
                          onChange({
                            ...draft,
                            preferences: {
                              ...draft.preferences,
                              interestCodes: isSelected
                                ? draft.preferences.interestCodes.filter(
                                    (v) => v !== code,
                                  )
                                : [...draft.preferences.interestCodes, code],
                            },
                          })
                        }
                      >
                        {isSelected && (
                          <span className="chip-check" aria-hidden="true">
                            ✓
                          </span>
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="settings-group">
              <Field label="Ghi chú chuyến đi">
                <textarea
                  rows={3}
                  value={draft.notes}
                  maxLength={2000}
                  placeholder="Những điều nhỏ bạn muốn nhớ…"
                  onChange={(e) =>
                    onChange({ ...draft, notes: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        </div>
      </aside>

      {/* Center: Itinerary Timeline */}
      <section className="itinerary" aria-label="Lịch trình chi tiết">
        <div className="itinerary-header">
          <div className="panel-title">
            <span className="step-num">02</span>
            <h2>Từng ngày, từng trải nghiệm</h2>
          </div>
          <p className="itinerary-sub muted">
            Lịch trình thủ công · Giờ địa phương Việt Nam
          </p>
        </div>

        {!draft.days.length ? (
          <div className="empty-state panel">
            <span className="empty-icon" aria-hidden="true">
              ☀
            </span>
            <h3>Chọn một nơi, dành ra vài ngày.</h3>
            <p>
              Chọn điểm đến và khoảng ngày hợp lệ (tối đa 31 ngày) để bắt đầu
              thêm hoạt động.
            </p>
          </div>
        ) : (
          <>
            {/* Day tabs with keyboard navigation */}
            <div
              className="day-tabs"
              role="tablist"
              aria-label="Ngày trong chuyến"
            >
              {draft.days.map((d, i) => {
                const isSelected = d.dayId === day?.dayId;
                return (
                  <button
                    key={d.dayId}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`day-tab-${i}`}
                    aria-controls={`day-panel-${i}`}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className={isSelected ? 'day-tab selected' : 'day-tab'}
                    onClick={() => setSelectedDay(i)}
                    onKeyDown={(e) => handleTabKeyDown(e, i)}
                  >
                    <span className="day-tab-title">Ngày {i + 1}</span>
                    <small className="day-tab-date">
                      {d.date.slice(5).split('-').reverse().join('/')}
                    </small>
                  </button>
                );
              })}
            </div>

            {/* Current day overview */}
            <div
              className="day-heading"
              id={`day-panel-${dayIndex}`}
              role="tabpanel"
              aria-labelledby={`day-tab-${dayIndex}`}
            >
              <h3>
                Ngày {dayIndex + 1} <span>· {day?.date}</span>
              </h3>
              <span className="pill">
                {day?.activities.length ?? 0} hoạt động
              </span>
            </div>

            {/* Activities timeline */}
            <div className="activity-timeline">
              {day?.activities.map((a, i) => (
                <article className="activity-card" key={a.activityId}>
                  <div className="activity-rail">
                    <span className="activity-node" aria-hidden="true"></span>
                    <div className="activity-number">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>

                  <div className="activity-fields">
                    <div className="activity-title-row">
                      <Field
                        label="Tên hoạt động"
                        className="activity-title-field"
                      >
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
                        type="button"
                        className="remove-button"
                        aria-label={`Xóa hoạt động ${i + 1}`}
                        title={`Xóa hoạt động ${i + 1}`}
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
                                      startLocalTime:
                                        e.target.value || undefined,
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

                      <Field
                        label="Chi phí nhóm (VND)"
                        className="activity-cost-field"
                      >
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
                                        confidence: 'user_entered',
                                        reference: undefined,
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
                      a.startLocalTime <
                        day.activities[i - 1]!.endLocalTime! && (
                        <p className="warning-text">
                          Giờ hoạt động đang chồng lấp. Bạn nên kiểm tra lại
                          lịch.
                        </p>
                      )}
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
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
      </section>

      {/* Right panel: Budget Summary & Goe Companion */}
      <aside className="trip-context">
        <section className="cost-panel" aria-label="Dự toán ngân sách">
          <p className="eyebrow">
            <span></span>DỰ TOÁN CẢ NHÓM
          </p>
          <h2>Vui trong ngân sách.</h2>

          <div className="budget-summary">
            <span className="budget-label">Chi phí hoạt động đã nhập</span>
            <strong className="budget-amount">{moneyText(known)}</strong>
            <span className="budget-per-person">
              {draft.travelers.totalCount > 0
                ? `${moneyText(Math.round(known / draft.travelers.totalCount))} / người`
                : 'Nhập số người để tính bình quân'}
            </span>

            <p className="budget-balance-pill">
              {draft.budget.amountMinor === null
                ? 'Chưa đặt ngân sách nhóm'
                : `${draft.budget.amountMinor - known < 0 ? 'Vượt ngân sách' : 'Còn trong ngân sách'}: ${moneyText(Math.abs(draft.budget.amountMinor - known))}`}
            </p>

            <small className="budget-note">
              {missing
                ? `${missing} hoạt động chưa rõ chi phí. Tổng và số dư chưa đầy đủ.`
                : 'Chi phí do bạn nhập, chưa phải giá dịch vụ xác nhận.'}
            </small>

            <small className="budget-footnote">
              Khoản còn lại là dự phòng tạm tính; các khoản chưa nhập chưa được
              trừ.
            </small>
          </div>
        </section>

        <div className="goe-tip">
          <Goe size="small" />
          <div className="goe-tip-body">
            <strong>Mỗi ngày, một khoảng thở.</strong>
            <p>Thêm giờ và ghi chú để lịch trình dễ theo dõi hơn.</p>
            <small>Hướng dẫn tĩnh từ GoEase</small>
          </div>
        </div>
      </aside>
    </div>
  );
}
