import { z } from 'zod';

const portSchema = z
  .string()
  .regex(/^[0-9]{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535))
  .default(3000);

export function readConfig(env: NodeJS.ProcessEnv) {
  const port = portSchema.safeParse(env.GOEASE_API_PORT);
  if (!port.success) {
    throw new Error('GOEASE_API_PORT must be an integer between 1 and 65535.');
  }
  return { host: 'localhost', port: port.data };
}
