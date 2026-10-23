import { useState } from 'react';
import type { DestinationDto, TripInput } from '@goease/contracts';
import { withDays } from '../trip-draft';
import { AiPlanner } from './ai-planner';

export function QuickTripSetup({
  draft,
  destinations,
  onChange,
  onPreview,
  onManual,
  onBusyChange,
}: {
  draft: TripInput;
  destinations: DestinationDto[];
  onChange: (value: TripInput) => void;
  onPreview: (value: TripInput) => void;
  onManual: () => void;
  onBusyChange: (value: boolean) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [customPeople, setCustomPeople] = useState(
    draft.travelers.totalCount > 2,
  );
  const [customDays, setCustomDays] = useState(false);
  const duration =
    Math.round(
      (Date.parse(draft.endDate) - Date.parse(draft.startDate)) / 86400000,
    ) + 1;
  const destination = destinations.find(
    (d) => d.id === draft.destinations[0]?.destinationId,
  );
  const supported =
    destination?.id === '000000000000000000000004' && duration <= 7;
  const valid =
    Number.isInteger(draft.travelers.totalCount) &&
    draft.travelers.totalCount >= 1 &&
    draft.travelers.totalCount <= 1000 &&
    Number.isInteger(duration) &&
    duration >= 1 &&
    duration <= 31 &&
    (draft.budget.amountMinor === null ||
      (Number.isSafeInteger(draft.budget.amountMinor) &&
        draft.budget.amountMinor >= 0 &&
        draft.budget.amountMinor <= 1e12));
  const updateDuration = (count: number) => {
    if (!Number.isInteger(count) || count < 1 || count > 31) return;
    onChange(
      withDays({
        ...draft,
        endDate: new Date(Date.parse(draft.startDate) + (count - 1) * 86400000)
          .toISOString()
          .slice(0, 10),
      }),
    );
  };
  return (
    <div className="quick-setup">
      <div className="quick-intro">
        <img src="/images/goe-mascot-cutout.png" alt="" />
        <h1>Bạn muốn đi đâu?</h1>
        <p>Chọn nơi đến, số ngày và số người. Goe xếp lịch giúp bạn.</p>
      </div>
      <fieldset className="quick-fields" disabled={generating}>
        <legend className="sr-only">Thông tin để lên lịch</legend>
        <div className="quick-destinations" role="group" aria-label="Điểm đến">
          {destinations.map((d) => (
            <button
              key={d.id}
              aria-pressed={destination?.id === d.id}
              onClick={() =>
                onChange(
                  withDays({
                    ...draft,
                    destinations: [{ destinationId: d.id, order: 0 }],
                    days: [],
                  }),
                )
              }
            >
              <strong>{d.name}</strong>
              <small>
                {d.id === '000000000000000000000004'
                  ? 'Goe tự lên lịch'
                  : 'Tự chọn điểm dừng'}
              </small>
            </button>
          ))}
        </div>
        {!destinations.length && (
          <p role="status">
            Chưa tải được điểm đến. Vui lòng thử tải lại trang.
          </p>
        )}
        <div className="quick-question">
          <h2>Đi bao lâu?</h2>
          <div className="quick-options" role="group" aria-label="Số ngày">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                aria-pressed={duration === n && !customDays}
                onClick={() => {
                  setCustomDays(false);
                  updateDuration(n);
                }}
              >
                {n} ngày
              </button>
            ))}
            <button
              aria-pressed={customDays}
              onClick={() => setCustomDays(true)}
            >
              Khác
            </button>
          </div>
          {customDays && (
            <label className="journey-field">
              Số ngày
              <select
                aria-label="Số ngày"
                value={duration}
                onChange={(e) => updateDuration(Number(e.target.value))}
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} ngày
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="quick-hint">
            Chưa cần chốt ngày đi. Bạn chọn ngày khi lưu lịch.
          </p>
        </div>
        <div className="quick-question">
          <h2>Đi mấy người?</h2>
          <div className="quick-options" role="group" aria-label="Đi cùng">
            {[1, 2].map((n) => (
              <button
                key={n}
                aria-pressed={!customPeople && draft.travelers.totalCount === n}
                onClick={() => {
                  setCustomPeople(false);
                  onChange({ ...draft, travelers: { totalCount: n } });
                }}
              >
                {n === 1 ? 'Một mình' : '2 người'}
              </button>
            ))}
            <button
              aria-pressed={customPeople}
              onClick={() => {
                setCustomPeople(true);
                onChange({
                  ...draft,
                  travelers: {
                    totalCount: Math.max(3, draft.travelers.totalCount),
                  },
                });
              }}
            >
              Nhóm / gia đình
            </button>
          </div>
          {customPeople && (
            <label className="journey-field">
              Số người
              <input
                type="number"
                inputMode="numeric"
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
            </label>
          )}
        </div>
        <details className="quick-preferences">
          <summary>
            Sở thích, nhịp đi & ngân sách <span>Tùy chọn</span>
          </summary>
          <div className="quick-options" role="group" aria-label="Sở thích">
            {(
              [
                ['food', 'Ẩm thực'],
                ['culture', 'Văn hóa'],
                ['nature', 'Thiên nhiên'],
                ['relaxation', 'Nghỉ dưỡng'],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                aria-pressed={draft.preferences.interestCodes.includes(code)}
                onClick={() =>
                  onChange({
                    ...draft,
                    preferences: {
                      ...draft.preferences,
                      interestCodes: draft.preferences.interestCodes.includes(
                        code,
                      )
                        ? draft.preferences.interestCodes.filter(
                            (c) => c !== code,
                          )
                        : [...draft.preferences.interestCodes, code],
                    },
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label className="journey-field">
            Nhịp đi
            <select
              aria-label="Nhịp đi"
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
              <option value="relaxed">Thư thả</option>
              <option value="balanced">Vừa phải</option>
              <option value="active">Khám phá nhiều</option>
            </select>
          </label>
          <label className="journey-field">
            Ngân sách cả nhóm (VND, không bắt buộc)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1e12}
              step={1}
              placeholder="Chưa quyết định cũng được"
              value={draft.budget.amountMinor ?? ''}
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
          </label>
        </details>
      </fieldset>
      {destination && !supported && (
        <p className="journey-notice">
          Goe hiện hỗ trợ Hội An khi có đủ địa điểm phù hợp. Với lựa chọn này,
          bạn có thể tự chọn điểm dừng hoặc đổi điểm đến.
        </p>
      )}
      {!valid && (
        <p role="alert" className="journey-error">
          Số người từ 1–1.000; ngân sách là số nguyên không âm, tối đa 1.000 tỷ
          đồng.
        </p>
      )}
      <fieldset className="quick-action" disabled={!valid}>
        <AiPlanner
          draft={withDays({
            ...draft,
            title:
              draft.title.trim() ||
              `${destination?.name ?? 'Chuyến đi'} ${duration} ngày`,
          })}
          immediatePreview
          onApply={onPreview}
          onBusyChange={(v) => {
            setGenerating(v);
            onBusyChange(v);
          }}
        />
      </fieldset>
      {destination && (
        <button
          className="quick-manual"
          disabled={generating || !valid}
          onClick={onManual}
        >
          Tự chọn điểm dừng
        </button>
      )}
    </div>
  );
}
