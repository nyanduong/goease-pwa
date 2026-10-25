import { HttpError } from '../../http-error.js';
export const sourceRateLimitMessage =
  'Nguồn dữ liệu đang giới hạn tốc độ. Hệ thống chờ rồi tự thử lại; nội dung đã lưu được giữ nguyên.';
export class SourceRateLimit extends HttpError {
  constructor(public retryAfterMs: number) {
    super(503, 'SOURCE_RATE_LIMITED', sourceRateLimitMessage);
  }
}
export function sourceRetryAfter(value: string | null, now = Date.now()) {
  const seconds = value && /^\d+$/.test(value) ? Number(value) * 1000 : NaN;
  const date = value ? Date.parse(value) - now : NaN;
  return Math.max(
    60000,
    Number.isFinite(seconds) ? seconds : Number.isFinite(date) ? date : 300000,
  );
}
