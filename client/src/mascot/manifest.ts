import { atlasRegistration } from './atlas-registration.js';
export const actionIds = [
  'idle',
  'blink',
  'yawn',
  'sleep',
  'stretch',
  'look-around',
  'look-up',
  'look-down',
  'walk-left',
  'walk-right',
  'jump',
  'sit',
  'inspect-map',
  'wave',
  'happy',
  'excited',
  'surprised',
  'follow-cursor',
  'touch',
  'dragging',
  'point',
  'goodbye',
  'listening',
  'thinking',
  'planning',
  'speaking',
  'waiting',
  'success',
  'confused',
  'error',
] as const;
export type MascotAction = (typeof actionIds)[number];
export type FallbackMotion =
  'breathe' | 'nod' | 'sway' | 'hop' | 'tilt' | 'pulse' | 'none';
export type SpriteAtlas = {
  url: string;
  columns: number;
  rows: number;
  row: number;
  rowStart?: number;
  rowHeight?: number;
};
export type AnimationDefinition = {
  id: MascotAction;
  name: string;
  atlas: SpriteAtlas | null;
  frameCount: number;
  fps: number;
  loop: boolean;
  priority: number;
  cooldownMs: number;
  durationMs: number;
  transitionMs: number;
  anchor: readonly [number, number];
  interruptible: boolean;
  fallback: MascotAction;
  fallbackMotion: FallbackMotion;
  assetStatus: 'pending' | 'reviewed';
};
const names = [
  'Đứng nghỉ',
  'Chớp mắt',
  'Ngáp',
  'Ngủ',
  'Duỗi cánh',
  'Nhìn quanh',
  'Nhìn lên',
  'Nhìn xuống',
  'Đi trái',
  'Đi phải',
  'Nhảy',
  'Ngồi',
  'Xem bản đồ',
  'Chào',
  'Vui',
  'Hào hứng',
  'Ngạc nhiên',
  'Nhìn theo',
  'Được chạm',
  'Đang kéo',
  'Chỉ đường',
  'Tạm biệt',
  'Lắng nghe',
  'Suy nghĩ',
  'Lập lịch',
  'Trả lời',
  'Chờ',
  'Hoàn thành',
  'Bối rối',
  'Có lỗi',
];
const priorities: Partial<Record<MascotAction, number>> = {
  idle: 0,
  dragging: 80,
  touch: 75,
  'follow-cursor': 70,
  listening: 55,
  planning: 60,
  thinking: 60,
  waiting: 60,
  speaking: 50,
  success: 65,
  confused: 65,
  error: 100,
};
const motions: Partial<Record<MascotAction, FallbackMotion>> = {
  idle: 'breathe',
  wave: 'sway',
  happy: 'hop',
  jump: 'hop',
  'look-around': 'tilt',
  touch: 'hop',
  dragging: 'tilt',
  listening: 'nod',
  thinking: 'sway',
  planning: 'pulse',
  speaking: 'nod',
  success: 'hop',
  waiting: 'breathe',
  error: 'tilt',
};
// Each active action is mapped to four separately drawn sprite frames.
// Only sheet-reviewed assets with alpha/registration checks are activated. Runtime QA is tracked separately.
export const animations = Object.fromEntries(
  actionIds.map((id, index) => [
    id,
    {
      id,
      name: names[index]!,
      atlas: null,
      frameCount: 0,
      fps: 8,
      loop: [
        'idle',
        'planning',
        'thinking',
        'waiting',
        'listening',
        'dragging',
      ].includes(id),
      priority: priorities[id] ?? 20,
      cooldownMs: id === 'idle' ? 0 : 30_000,
      durationMs: id === 'error' ? 2600 : 1600,
      transitionMs: 160,
      anchor: [0.5, 0.9] as const,
      interruptible: id !== 'dragging',
      fallback: 'idle',
      fallbackMotion: motions[id] ?? 'none',
      assetStatus: 'pending',
    } satisfies AnimationDefinition,
  ]),
) as Record<MascotAction, AnimationDefinition>;

export const randomActions: readonly { id: MascotAction; weight: number }[] = [
  { id: 'wave', weight: 1 },
  { id: 'happy', weight: 1 },
  { id: 'blink', weight: 6 },
  { id: 'stretch', weight: 1 },
  { id: 'yawn', weight: 1 },
  { id: 'inspect-map', weight: 1 },
  { id: 'look-around', weight: 4 },
  { id: 'jump', weight: 1 },
];
export function isMascotAction(value: unknown): value is MascotAction {
  return typeof value === 'string' && Object.hasOwn(animations, value);
}

function register(
  url: string,
  group: keyof typeof atlasRegistration,
  ids: readonly MascotAction[],
) {
  const metadata = atlasRegistration[group];
  ids.forEach((id, row) => {
    Object.assign(animations[id], {
      atlas: {
        url,
        columns: 4,
        rows: 8,
        row,
        rowStart: metadata.starts[row],
        rowHeight: metadata.height,
      },
      frameCount: 4,
      assetStatus: 'reviewed',
      fps: ['idle', 'listening', 'sleep', 'waiting'].includes(id) ? 2 : 6,
    });
  });
}
register(
  new URL('../assets/mascot/mvp-atlas.png', import.meta.url).href,
  'mvp',
  [
    'idle',
    'blink',
    'wave',
    'listening',
    'thinking',
    'speaking',
    'success',
    'error',
  ],
);
register(
  new URL('../assets/mascot/natural-atlas.png', import.meta.url).href,
  'natural',
  [
    'yawn',
    'sleep',
    'stretch',
    'look-around',
    'look-up',
    'look-down',
    'walk-left',
    'walk-right',
  ],
);
register(
  new URL('../assets/mascot/interaction-atlas.png', import.meta.url).href,
  'interaction',
  [
    'jump',
    'sit',
    'inspect-map',
    'happy',
    'excited',
    'surprised',
    'follow-cursor',
    'dragging',
  ],
);
register(
  new URL('../assets/mascot/utility-atlas.png', import.meta.url).href,
  'utility',
  ['point', 'goodbye', 'waiting', 'confused', 'planning', 'touch'],
);
animations.sleep.durationMs = 6000;
animations.sit.durationMs = 3200;
animations['walk-left'].loop = true;
animations['walk-right'].loop = true;
