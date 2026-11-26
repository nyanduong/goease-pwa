import { apiErrorSchema } from '@goease/contracts';
import { apiBasePath } from '../../config/api';

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

export async function getApi<T>(
  path: `/${string}`,
  parse: (body: unknown) => T,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`${apiBasePath}${path}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body: unknown = await response.json().catch(() => null);
  signal.throwIfAborted();

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      error.success ? error.data.error.code : 'HTTP_ERROR',
      response.status,
    );
  }

  try {
    return parse(body);
  } catch {
    throw new ApiRequestError('INVALID_RESPONSE', response.status);
  }
}
