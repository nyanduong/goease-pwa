function testPort(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (!/^\d{4,5}$/.test(value) || Number(value) < 1024 || Number(value) > 65535)
    throw new Error('Invalid E2E localhost port');
  return Number(value);
}
export const e2eApiPort = testPort(process.env.E2E_API_PORT, 3000);
export const e2eWebPort = testPort(process.env.E2E_WEB_PORT, 5180);
if (
  e2eApiPort === e2eWebPort ||
  [27017, 27019, 27020, 27021].includes(e2eApiPort) ||
  [27017, 27019, 27020, 27021].includes(e2eWebPort)
)
  throw new Error('E2E ports must be distinct from MongoDB ports');
export const e2eApiOrigin = `http://localhost:${e2eApiPort}`;
export const e2eWebOrigin = `http://localhost:${e2eWebPort}`;
