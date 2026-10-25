import { Schema, type Connection } from 'mongoose';

export function enrichmentModels(connection: Connection) {
  const Job = connection.model(
    'CatalogEnrichmentJob',
    new Schema(
      {
        state: {
          type: String,
          enum: ['building', 'running', 'paused', 'completed'],
          required: true,
        },
        active: { type: Boolean, required: true },
        singleton: { type: String, enum: ['VN'], default: 'VN' },
        createdBy: { type: Schema.Types.ObjectId, required: true },
        requestKey: { type: String, required: true },
        revision: { type: Number, default: 1 },
        total: { type: Number, required: true },
        destinationIds: {
          type: [Schema.Types.ObjectId],
          required: true,
          validate: (v: unknown[]) => v.length <= 34,
        },
        cutoff: { type: Schema.Types.ObjectId, required: true },
        cursor: { type: Schema.Types.ObjectId, default: null },
        seeded: { type: Boolean, default: false },
        leaseToken: { type: String, default: null },
        leaseUntil: { type: Date, default: null },
      },
      {
        collection: 'catalog_enrichment_jobs',
        timestamps: true,
        strict: 'throw',
        versionKey: false,
      },
    ),
  );
  Job.schema.index(
    { singleton: 1 },
    { unique: true, partialFilterExpression: { active: true } },
  );
  Job.schema.index({ createdBy: 1, requestKey: 1 }, { unique: true });
  const Item = connection.model(
    'CatalogEnrichmentItem',
    new Schema(
      {
        jobId: { type: Schema.Types.ObjectId, required: true },
        placeId: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true, maxlength: 200 },
        destinationName: { type: String, required: true, maxlength: 120 },
        state: {
          type: String,
          enum: [
            'queued',
            'waiting',
            'review',
            'ready',
            'unresolved',
            'skipped',
          ],
          required: true,
        },
        missing: {
          type: [String],
          default: [],
          validate: (v: unknown[]) => v.length <= 5,
        },
        message: { type: String, default: '', maxlength: 300 },
        nextCheckAt: { type: Date, default: Date.now },
      },
      {
        collection: 'catalog_enrichment_items',
        timestamps: true,
        strict: 'throw',
        versionKey: false,
      },
    ),
  );
  Item.schema.index({ jobId: 1, placeId: 1 }, { unique: true });
  Item.schema.index({ jobId: 1, state: 1, nextCheckAt: 1, _id: 1 });
  return { Job, Item };
}
