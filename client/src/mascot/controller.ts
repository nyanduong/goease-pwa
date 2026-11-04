import { animations, randomActions, type MascotAction } from './manifest';

export type MascotSnapshot = Readonly<{
  action: MascotAction;
  revision: number;
  since: number;
  lookFrame: number;
}>;
export interface MascotClock {
  now: () => number;
  schedule: (callback: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
}
const browserClock: MascotClock = {
  now: () => Date.now(),
  schedule: (callback, ms) => setTimeout(callback, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** One transient animation plus persistent channels. No network calls. */
export class MascotController {
  private snapshot: MascotSnapshot;
  private listeners = new Set<() => void>();
  private channels = new Map<string, MascotAction>();
  private transient: MascotAction | null = null;
  private timer: unknown;
  private epoch = 0;
  private lastPlayed = new Map<MascotAction, number>();
  private lastRandom: MascotAction | null = null;

  constructor(private clock: MascotClock = browserClock) {
    this.snapshot = {
      action: 'idle',
      revision: 0,
      since: clock.now(),
      lookFrame: 0,
    };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish() {
    let action: MascotAction = this.transient ?? 'idle';
    for (const candidate of this.channels.values()) {
      if (animations[candidate].priority > animations[action].priority)
        action = candidate;
    }
    if (action === this.snapshot.action) return;
    this.snapshot = {
      action,
      lookFrame: this.snapshot.lookFrame,
      revision: this.snapshot.revision + 1,
      since: this.clock.now(),
    };
    this.listeners.forEach((listener) => listener());
  }
  private clearTransient() {
    this.epoch++;
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
    this.transient = null;
  }
  setChannel(channel: string, action: MascotAction | null) {
    if (action) this.channels.set(channel, action);
    else this.channels.delete(channel);
    // New AI work must never wait behind a decorative success response.
    if (
      action &&
      this.transient &&
      (animations[action].priority >= animations[this.transient].priority ||
        (['planning', 'thinking', 'waiting'].includes(action) &&
          animations[this.transient].priority < 70))
    ) {
      this.clearTransient();
    }
    this.publish();
  }
  followCursor(frame: number) {
    const lookFrame = Math.max(0, Math.min(3, Math.floor(frame)));
    this.setChannel('cursor', 'follow-cursor');
    if (lookFrame !== this.snapshot.lookFrame) {
      this.snapshot = {
        ...this.snapshot,
        lookFrame,
        revision: this.snapshot.revision + 1,
      };
      this.listeners.forEach((listener) => listener());
    }
  }
  canPlay(id: MascotAction) {
    const definition = animations[id];
    const last = this.lastPlayed.get(id);
    return (
      (last === undefined ||
        this.clock.now() - last >= definition.cooldownMs) &&
      definition.priority >= animations[this.snapshot.action].priority
    );
  }
  play(id: MascotAction, interaction = false) {
    if (!interaction && !this.canPlay(id)) return false;
    const current = animations[this.snapshot.action];
    if (
      animations[id].priority < current.priority ||
      (!current.interruptible && id !== 'error')
    )
      return false;
    this.clearTransient();
    this.transient = id;
    this.lastPlayed.set(id, this.clock.now());
    const epoch = this.epoch;
    this.timer = this.clock.schedule(() => {
      if (this.epoch !== epoch) return;
      this.clearTransient();
      this.publish();
    }, animations[id].durationMs);
    this.publish();
    return true;
  }
  random(random = Math.random) {
    if (this.snapshot.action !== 'idle') return null;
    const eligible = randomActions.filter(
      ({ id }) => id !== this.lastRandom && this.canPlay(id),
    );
    let pick = random() * eligible.reduce((sum, item) => sum + item.weight, 0);
    for (const item of eligible) {
      pick -= item.weight;
      if (pick < 0) {
        if (!this.play(item.id)) return null;
        this.lastRandom = item.id;
        return item.id;
      }
    }
    return null;
  }
  stop() {
    this.clearTransient();
    this.channels.clear();
    this.publish();
  }
}

export function behaviorDelay(
  random = Math.random,
  min = 15_000,
  max = 45_000,
) {
  return min + Math.floor(Math.max(0, Math.min(1, random())) * (max - min));
}
