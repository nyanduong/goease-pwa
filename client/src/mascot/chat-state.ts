import type { MascotController } from './controller';

export type ChatVisualState =
  'idle' | 'listening' | 'planning' | 'waiting' | 'success' | 'error';
/** Adapter consumes real UI/network lifecycle; it never calls an AI API. */
export function syncChatState(
  controller: MascotController,
  channel: string,
  state: ChatVisualState,
) {
  if (state === 'planning' || state === 'waiting' || state === 'listening') {
    controller.setChannel(channel, state);
  } else {
    controller.setChannel(channel, null);
    if (state === 'success' || state === 'error') controller.play(state, true);
  }
}
