import {
  plannerTiming,
  type GoeProposal,
  type GoeRequest,
  type TripDto,
} from '@goease/contracts';
import type { api } from '../api';

export interface TravelAssistantService {
  capabilities: { generalChat: boolean; streaming: boolean };
  proposeDay(request: {
    tripId: string;
    key: string;
    body: GoeRequest;
  }): Promise<GoeProposal>;
  applyDay(request: {
    tripId: string;
    key: string;
    runId: string;
    revision: number;
  }): Promise<{ trip: TripDto }>;
  // Optional future API; never surfaced as an available feature without a backend.
  chat?: (message: string, signal: AbortSignal) => Promise<{ text: string }>;
}

export function createTravelAssistant(
  request: typeof api,
): TravelAssistantService {
  return {
    capabilities: { generalChat: false, streaming: false },
    proposeDay: ({ tripId, key, body }) =>
      request<GoeProposal>(
        `/trips/${encodeURIComponent(tripId)}/goe-proposal`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(plannerTiming.clientTimeoutMs),
        },
      ),
    applyDay: ({ tripId, key, runId, revision }) =>
      request<{ trip: TripDto }>(
        `/trips/${encodeURIComponent(tripId)}/goe-apply`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: JSON.stringify({ runId, expectedRevision: revision }),
        },
      ),
  };
}
