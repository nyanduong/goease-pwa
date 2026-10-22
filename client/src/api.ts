export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1${path}`,
      {
        ...options,
        credentials: options.credentials ?? 'include',
        signal: options.signal ?? AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          'X-GoEase-Client': 'web',
          ...options.headers,
        },
      },
    );
  } catch {
    throw new Error(
      'Không kết nối được máy chủ. Dữ liệu bạn đang nhập vẫn được giữ; hãy thử lại.',
    );
  }
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  } | null;
  if (response.status === 401 && !path.startsWith('/auth/'))
    window.dispatchEvent(new Event('goease-auth-invalid'));
  if (response.status === 404 && /^\/trips\/[a-f0-9]{24}$/.test(path))
    window.dispatchEvent(
      new CustomEvent('goease-trip-missing', { detail: path.split('/')[2]! }),
    );
  if (!response.ok || !result?.ok)
    throw new ApiFailure(
      result?.error?.message ?? 'Không thể hoàn tất yêu cầu. Hãy thử lại.',
      response.status,
    );
  return result.data as T;
}
