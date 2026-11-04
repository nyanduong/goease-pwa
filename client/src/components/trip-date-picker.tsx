import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from '../customer-icons';
import { Sheet } from './journey-sheet';
export function TripDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(`${value}T12:00:00`));
  const year = month.getFullYear(),
    m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7;
  const count = new Date(year, m + 1, 0).getDate();
  const iso = (day: number) =>
    `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return (
    <>
      <button
        type="button"
        className="trip-date-trigger"
        aria-label="Chọn ngày khởi hành"
        aria-haspopup="dialog"
        onClick={() => {
          setMonth(new Date(`${value}T12:00:00`));
          setOpen(true);
        }}
      >
        <span>
          {new Intl.DateTimeFormat('vi-VN').format(
            new Date(`${value}T12:00:00`),
          )}
        </span>
        <CalendarDays size={18} />
      </button>
      {open && (
        <Sheet
          title="Ngày khởi hành"
          className="trip-date-sheet"
          onClose={() => setOpen(false)}
        >
          <div className="trip-calendar-head">
            <button
              type="button"
              aria-label="Tháng trước"
              onClick={() => setMonth(new Date(year, m - 1, 1))}
            >
              <ChevronLeft size={20} />
            </button>
            <strong aria-live="polite">
              {new Intl.DateTimeFormat('vi-VN', {
                month: 'long',
                year: 'numeric',
              }).format(month)}
            </strong>
            <button
              type="button"
              aria-label="Tháng sau"
              onClick={() => setMonth(new Date(year, m + 1, 1))}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="trip-calendar-grid">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((x) => (
              <small key={x}>{x}</small>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => i + 1).map((day) => (
              <button
                type="button"
                key={day}
                aria-label={new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'full',
                }).format(new Date(year, m, day))}
                aria-pressed={value === iso(day)}
                onClick={() => {
                  onChange(iso(day));
                  setOpen(false);
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
