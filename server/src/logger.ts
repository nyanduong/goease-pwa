export function log(
  level: 'info' | 'error',
  event: string,
  fields: Record<string, string | number> = {},
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'goease-api',
      level,
      event,
      ...fields,
    }),
  );
}
