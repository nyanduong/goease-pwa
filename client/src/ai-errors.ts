import { ApiFailure } from './api';

// Only unfinished/uncertain requests can benefit from retrieving the same run.
export function canRecoverAi(error: unknown): boolean {
  return (
    !(error instanceof ApiFailure) ||
    ['AI_RUN_PENDING', 'AI_OUTCOME_UNKNOWN'].includes(error.code ?? '')
  );
}
