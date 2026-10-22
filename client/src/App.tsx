import { useEffect, useState } from 'react';
import { checkHealth, type Status } from './health';

const loading: Status = { state: 'loading', message: 'Đang kiểm tra kết nối…' };
const labels = {
  loading: 'Đang kiểm tra',
  success: 'Hoạt động',
  error: 'Chưa sẵn sàng',
};

function StatusCard({
  title,
  status,
  number,
}: {
  title: string;
  status: Status;
  number: string;
}) {
  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-6"
      aria-label={title}
    >
      <div className="mb-8 flex items-center justify-between">
        <span className="font-mono text-sm text-stone-400">{number}</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${status.state === 'success' ? 'bg-emerald-50 text-emerald-800' : status.state === 'error' ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-600'}`}
        >
          {labels[status.state]}
        </span>
      </div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <p className="text-sm leading-6 text-stone-600">{status.message}</p>
    </section>
  );
}

export function App() {
  const [attempt, setAttempt] = useState(0);
  const [api, setApi] = useState<Status>(loading);
  const [database, setDatabase] = useState<Status>(loading);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let active = true;
    setApi(loading);
    setDatabase(loading);
    void checkHealth(false, controller.signal).then((status) => {
      if (active) setApi(status);
    });
    void checkHealth(true, controller.signal).then((status) => {
      if (active) setDatabase(status);
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  const pending = api.state === 'loading' || database.state === 'loading';
  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#102b26]">
      <header className="border-b border-stone-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="text-2xl font-bold tracking-tight">
            GoEase<span className="text-emerald-600">.</span>
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
            F0 / Foundation
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Môi trường phát triển
        </p>
        <h1 className="mb-5 text-3xl font-semibold tracking-tight sm:text-5xl">
          Nền tảng cho GoEase.
        </h1>
        <p className="mb-12 max-w-xl leading-7 text-stone-600">
          Màn hình kỹ thuật kiểm tra web, API và MongoDB local. Trạng thái được
          lấy từ hệ thống khi mở trang hoặc kiểm tra lại.
        </p>
        <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
          <StatusCard
            number="01"
            title="Frontend"
            status={{
              state: 'success',
              message: 'Ứng dụng React đã khởi động trên trình duyệt.',
            }}
          />
          <StatusCard number="02" title="Backend API" status={api} />
          <StatusCard number="03" title="Database" status={database} />
        </div>
        <button
          className="mt-8 rounded-xl bg-[#102b26] px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-50"
          disabled={pending}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {pending ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
        </button>
        <p className="mt-14 border-t border-stone-200 pt-6 text-xs leading-5 text-stone-500">
          Project foundation · Chưa triển khai các chức năng du lịch trong F0.
        </p>
      </main>
    </div>
  );
}
