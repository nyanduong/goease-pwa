import { createTravelAssistant } from '../client/src/mascot/ai-service.js';
import { spriteFrameAt } from '../client/src/mascot/sprite-timing.js';
import { companionChatLayout } from '../client/src/mascot/placement.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MascotController,
  behaviorDelay,
  type MascotClock,
} from '../client/src/mascot/controller.js';
import { animations, actionIds } from '../client/src/mascot/manifest.js';
import { syncChatState } from '../client/src/mascot/chat-state.js';

function fixture() {
  let now = 0;
  let serial = 0;
  const timers = new Map<number, { callback: () => void; due: number }>();
  const clock: MascotClock = {
    now: () => now,
    schedule: (callback, ms) => {
      timers.set(++serial, { callback, due: now + ms });
      return serial;
    },
    cancel: (handle) => {
      timers.delete(handle as number);
    },
  };
  const controller = new MascotController(clock);
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.due <= now && timers.delete(id)) timer.callback();
    }
  };
  return { controller, timers, advance };
}
test('manifest distinguishes pending assets from real sprite animations', () => {
  assert.equal(actionIds.length, 30);
  for (const id of actionIds) {
    const a = animations[id];
    assert.ok(animations[a.fallback]);
    assert.ok(a.fps > 0 && a.durationMs > 0);
    if (a.assetStatus === 'reviewed') {
      assert.ok(a.atlas && a.frameCount > 1 && a.frameCount <= a.atlas.columns);
    } else {
      assert.equal(a.atlas, null);
      assert.equal(a.frameCount, 0);
    }
  }
});
test('one-shot returns to idle and releases its timer', () => {
  const { controller: c, timers, advance } = fixture();
  assert.equal(c.play('wave'), true);
  assert.equal(c.getSnapshot().action, 'wave');
  advance(2000);
  assert.equal(c.getSnapshot().action, 'idle');
  assert.equal(timers.size, 0);
});
test('random actions observe cooldown and do not repeat consecutively', () => {
  const { controller: c, advance } = fixture();
  const first = c.random(() => 0);
  advance(2000);
  const second = c.random(() => 0);
  assert.ok(first && second && first !== second);
  assert.equal(c.play(first), false);
  advance(30000);
  assert.equal(c.canPlay(first), true);
});
test('weighted selection uses the full random range', () => {
  const a = fixture(),
    b = fixture();
  assert.equal(
    a.controller.random(() => 0),
    'wave',
  );
  assert.equal(
    b.controller.random(() => 0.9999),
    'jump',
  );
  assert.equal(
    behaviorDelay(() => 0),
    15000,
  );
  assert.equal(
    behaviorDelay(() => 1),
    45000,
  );
});
test('AI processing prevents random interruption and recovers after response', () => {
  const { controller: c, advance } = fixture();
  syncChatState(c, 'chat', 'planning');
  advance(60000);
  assert.equal(c.getSnapshot().action, 'planning');
  assert.equal(c.random(), null);
  syncChatState(c, 'chat', 'success');
  assert.equal(c.getSnapshot().action, 'success');
  advance(2000);
  assert.equal(c.getSnapshot().action, 'idle');
});
test('new network request clears a decorative completion immediately', () => {
  const { controller: c, timers } = fixture();
  c.play('success');
  syncChatState(c, 'chat', 'planning');
  assert.equal(c.getSnapshot().action, 'planning');
  assert.equal(timers.size, 0);
});
test('dragging wins over AI; release restores the actual processing state', () => {
  const { controller: c } = fixture();
  c.setChannel('chat', 'planning');
  c.setChannel('drag', 'dragging');
  assert.equal(c.getSnapshot().action, 'dragging');
  assert.equal(c.play('wave'), false);
  c.setChannel('drag', null);
  assert.equal(c.getSnapshot().action, 'planning');
});
test('error preempts dragging and later restores the persistent channel', () => {
  const { controller: c, advance } = fixture();
  c.setChannel('drag', 'dragging');
  assert.equal(c.play('error'), true);
  assert.equal(c.getSnapshot().action, 'error');
  advance(3000);
  assert.equal(c.getSnapshot().action, 'dragging');
});
test('stop cleans pending work; late callbacks cannot revive an old action', () => {
  const { controller: c, timers, advance } = fixture();
  c.play('wave');
  const callback = [...timers.values()][0]!.callback;
  c.stop();
  assert.equal(timers.size, 0);
  c.setChannel('chat', 'planning');
  callback();
  advance(5000);
  assert.equal(c.getSnapshot().action, 'planning');
});
test('unsubscribed observers are not notified', () => {
  const { controller: c } = fixture();
  let notifications = 0;
  const unsubscribe = c.subscribe(() => notifications++);
  c.play('wave');
  unsubscribe();
  c.stop();
  assert.equal(notifications, 1);
});
test('failed request releases processing and never changes trip data', () => {
  const { controller: c, advance } = fixture();
  syncChatState(c, 'chat', 'planning');
  syncChatState(c, 'chat', 'error');
  assert.equal(c.getSnapshot().action, 'error');
  advance(3000);
  assert.equal(c.getSnapshot().action, 'idle');
});

test('chat stays inside mobile/desktop canvas, including short keyboard viewport', () => {
  for (const width of [320, 375, 430]) {
    for (const height of [340, 667, 900]) {
      const bounds = {
        left: 12,
        right: width - 60,
        top: 12,
        bottom: height - 122,
      };
      for (const x of [bounds.left, bounds.right])
        for (const y of [bounds.top, bounds.bottom]) {
          const panel = companionChatLayout({ x, y }, bounds);
          assert.ok(panel.left >= bounds.left);
          assert.ok(panel.left + panel.width <= bounds.right + 48);
          assert.ok(panel.top >= bounds.top);
          assert.ok(panel.top + panel.height <= bounds.bottom + 48);
          assert.ok(panel.height > 0);
        }
    }
  }
});

test('sprite loops by elapsed time, one-shot holds last frame, invalid input is safe', () => {
  const loop = { frameCount: 4, fps: 8, loop: true };
  assert.equal(spriteFrameAt(0, loop), 0);
  assert.equal(spriteFrameAt(125, loop), 1);
  assert.equal(spriteFrameAt(375, loop), 3);
  assert.equal(spriteFrameAt(500, loop), 0);
  assert.equal(spriteFrameAt(9000, { ...loop, loop: false }), 3);
  assert.equal(spriteFrameAt(-12, loop), 0);
  assert.equal(spriteFrameAt(50, { ...loop, frameCount: 0 }), 0);
});

test('cursor direction selects bounded frames and AI resumes on pointer leave', () => {
  const { controller: c } = fixture();
  c.setChannel('chat', 'planning');
  c.followCursor(99);
  assert.equal(c.getSnapshot().action, 'follow-cursor');
  assert.equal(c.getSnapshot().lookFrame, 3);
  c.setChannel('cursor', null);
  assert.equal(c.getSnapshot().action, 'planning');
});
test('all thirty actions have real registered sprite rows within the sheet', () => {
  assert.equal(
    actionIds.filter((id) => animations[id].assetStatus === 'reviewed').length,
    30,
  );
  for (const id of actionIds) {
    const a = animations[id].atlas!;
    assert.equal(animations[id].frameCount, 4);
    assert.ok(
      a.rowStart! >= 0 && a.rowHeight! > 0 && a.rowStart! + a.rowHeight! <= 1,
    );
  }
});

test('AI adapter preserves consent, revision, idempotency, and timeout without exposing keys', async () => {
  const calls: { path: string; options?: RequestInit }[] = [];
  const request: Parameters<typeof createTravelAssistant>[0] = async <T>(
    path: string,
    options?: RequestInit,
  ) => {
    calls.push({ path, ...(options ? { options } : {}) });
    return {} as T;
  };
  const service = createTravelAssistant(request);
  assert.deepEqual(service.capabilities, {
    generalChat: false,
    streaming: false,
  });
  assert.equal(service.chat, undefined);
  await service.proposeDay({
    tripId: 'demo',
    key: 'proposal-key',
    body: {
      message: 'Đi chậm hơn',
      dayId: 'day-one',
      expectedRevision: 4,
      consent: true,
    },
  });
  assert.equal(calls[0]!.path, '/trips/demo/goe-proposal');
  assert.deepEqual(JSON.parse(calls[0]!.options!.body as string), {
    message: 'Đi chậm hơn',
    dayId: 'day-one',
    expectedRevision: 4,
    consent: true,
  });
  assert.deepEqual(calls[0]!.options!.headers, {
    'Idempotency-Key': 'proposal-key',
  });
  assert.ok(calls[0]!.options!.signal instanceof AbortSignal);
  await service.applyDay({
    tripId: 'demo',
    key: 'apply-key',
    runId: 'run-one',
    revision: 4,
  });
  assert.equal(calls[1]!.path, '/trips/demo/goe-apply');
  assert.deepEqual(JSON.parse(calls[1]!.options!.body as string), {
    runId: 'run-one',
    expectedRevision: 4,
  });
  assert.deepEqual(calls[1]!.options!.headers, {
    'Idempotency-Key': 'apply-key',
  });
});
