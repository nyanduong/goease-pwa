import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const messageSchema = z.object({
  id: z.uuid(),
  to: z.email(),
  url: z.url(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export function developmentMailbox(database: string, enabled: boolean) {
  if (!/^[a-zA-Z0-9_-]+$/.test(database))
    throw new Error('Invalid mailbox namespace');
  const folder = resolve(
    fileURLToPath(new URL('../../../../.local/mailbox/', import.meta.url)),
    database,
  );
  async function list() {
    if (!enabled) throw new Error('Development mailbox is unavailable');
    await mkdir(folder, { recursive: true });
    const messages: z.infer<typeof messageSchema>[] = [];
    for (const name of (await readdir(folder))
      .filter((v) => /^[a-f0-9-]{36}\.json$/.test(v))
      .sort()
      .slice(0, 200)) {
      const path = resolve(folder, name);
      const value = messageSchema.safeParse(
        JSON.parse(await readFile(path, 'utf8')),
      );
      if (!value.success) continue;
      if (Date.parse(value.data.expiresAt) <= Date.now()) await unlink(path);
      else messages.push(value.data);
    }
    return messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return {
    list,
    async deliver(to: string, url: string, expiresAt: Date) {
      const existing = await list();
      if (existing.length >= 100)
        throw new Error('Development mailbox is full');
      const id = randomUUID();
      await writeFile(
        resolve(folder, `${id}.json`),
        JSON.stringify({
          id,
          to,
          url,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        }),
        { flag: 'wx', mode: 0o600 },
      );
    },
  };
}
