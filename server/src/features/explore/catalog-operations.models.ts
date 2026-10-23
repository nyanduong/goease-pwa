import { Schema, type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';

const options = {
  strict: 'throw' as const,
  versionKey: false,
  autoIndex: false,
  autoCreate: false,
  timestamps: true,
} as const;
export const sourceSnapshotModel = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    address: { type: String, default: '', maxlength: 200 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    category: {
      type: String,
      required: true,
      enum: ['food', 'culture', 'nature'],
    },
    venueType: { type: String, required: true, enum: ['restaurant', 'place'] },
    categories: { type: [String], validate: (v: string[]) => v.length <= 100 },
    openingHoursNote: { type: String, default: '', maxlength: 400 },
    closed: { type: Boolean, default: null },
    sourceUrl: { type: String, required: true, maxlength: 2048 },
  },
  { _id: false, strict: 'throw', versionKey: false },
);

export function catalogOperationsModels(connection: Connection) {
  const schedule = new Schema(
    {
      scope: { type: String, enum: ['hoi-an'], default: 'hoi-an' },
      revision: { type: Number, default: 0 },
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly'], default: 'weekly' },
      hour: { type: Number, min: 0, max: 23, default: 8 },
      minute: { type: Number, min: 0, max: 59, default: 0 },
      weekday: { type: Number, min: 0, max: 6, default: 1 },
      group: {
        type: String,
        enum: ['mixed', 'sights', 'restaurant', 'cafe'],
        default: 'mixed',
      },
      nextRunAt: { type: Date, default: null },
      quotaHour: { type: Number, default: 0 },
      searches: { type: Number, default: 0 },
      actorSearches: {
        type: [{ _id: false, actor: String, count: Number }],
        default: [],
      },
      slots: {
        type: [{ _id: false, token: String, until: Date }],
        default: [],
      },
    },
    { ...options, collection: 'catalog_schedules' },
  );
  schedule.index({ scope: 1 }, { unique: true });
  const run = new Schema(
    {
      operationId: { type: String, default: randomUUID, required: true },
      scope: { type: String, default: 'hoi-an', enum: ['hoi-an'] },
      active: { type: Boolean, default: true },
      state: {
        type: String,
        enum: ['queued', 'running', 'retry', 'succeeded', 'failed'],
        default: 'queued',
      },
      actorId: { type: Schema.Types.ObjectId, default: null },
      group: {
        type: String,
        required: true,
        enum: ['mixed', 'sights', 'restaurant', 'cafe'],
      },
      attempts: { type: Number, default: 0 },
      nextAttemptAt: { type: Date, default: Date.now },
      leaseToken: { type: String, default: null },
      leaseUntil: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      message: { type: String, default: '', maxlength: 400 },
      counts: {
        created: { type: Number, default: 0 },
        unchanged: { type: Number, default: 0 },
        review: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
        errors: { type: Number, default: 0 },
      },
    },
    { ...options, collection: 'catalog_runs' },
  );
  run.index(
    { scope: 1, active: 1 },
    { unique: true, partialFilterExpression: { active: true } },
  );
  run.index({ active: 1, nextAttemptAt: 1, leaseUntil: 1 });
  run.index({ createdAt: -1 });
  const review = new Schema(
    {
      placeId: { type: Schema.Types.ObjectId, required: true },
      kind: {
        type: String,
        enum: ['draft', 'duplicate', 'source', 'price'],
        required: true,
      },
      signature: { type: String, required: true },
      revision: { type: Number, default: 1 },
      state: {
        type: String,
        enum: ['open', 'resolved', 'snoozed'],
        default: 'open',
      },
      decision: {
        type: String,
        enum: ['keep', 'apply', 'ignore', 'later', 'distinct'],
        default: null,
      },
      revisitAt: { type: Date, default: null },
      incoming: { type: sourceSnapshotModel, default: null },
      previous: { type: sourceSnapshotModel, default: null },
      fetchedAt: { type: Date, default: null },
      duplicates: {
        type: [String],
        default: [],
        validate: (v: string[]) => v.length <= 20,
      },
    },
    { ...options, collection: 'catalog_reviews' },
  );
  review.index({ placeId: 1, kind: 1 }, { unique: true });
  review.index({ state: 1, revisitAt: 1, updatedAt: -1 });
  return {
    Schedule: connection.model('CatalogSchedule', schedule),
    Run: connection.model('CatalogRun', run),
    Review: connection.model('CatalogReview', review),
  };
}
