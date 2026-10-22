import {
  apiErrorSchema,
  databaseHealthSchema,
  healthSchema,
} from '@goease/contracts';

export type Status = {
  state: 'loading' | 'success' | 'error';
  message: string;
};
export async function checkHealth(
  database: boolean,
  signal: AbortSignal,
): Promise<Status> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/health${database ? '/db' : ''}`,
      { signal, cache: 'no-store' },
    );
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = apiErrorSchema.safeParse(body);
      return {
        state: 'error',
        message:
          error.success && error.data.error.code === 'DATABASE_UNAVAILABLE'
            ? 'MongoDB chưa sẵn sàng. Hãy kiểm tra dịch vụ database.'
            : 'Không kết nối được dịch vụ. Hãy thử lại.',
      };
    }
    (database ? databaseHealthSchema : healthSchema).parse(body);
    return {
      state: 'success',
      message: database
        ? 'MongoDB phản hồi kiểm tra kết nối thật.'
        : 'API đang hoạt động và phản hồi.',
    };
  } catch {
    return {
      state: 'error',
      message: signal.aborted
        ? 'Kiểm tra đã hết thời gian. Hãy thử lại.'
        : 'Không nhận được phản hồi hợp lệ. Hãy thử lại.',
    };
  }
}
