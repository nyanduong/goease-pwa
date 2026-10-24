import { Schema, type Connection } from 'mongoose';
const options = {
  strict: 'throw',
  timestamps: true,
  versionKey: false,
  autoIndex: false,
  autoCreate: false,
} as const;
export const policySnapshotSchema = new Schema(
  {
    policyId: { type: Schema.Types.ObjectId, default: null },
    version: { type: Number, default: 0 },
    autoApplyDraftHours: { type: Boolean, default: false },
    autoPublish: {
      type: Boolean,
      default: false,
      validate: (v: boolean) => !v,
    },
  },
  { _id: false, strict: 'throw', versionKey: false },
);
export const scopeSnapshotSchema = new Schema(
  {
    destinationId: { type: String, required: true },
    destinationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radiusMeters: { type: Number, required: true },
  },
  { _id: false, strict: 'throw', versionKey: false },
);
function createModels(connection: Connection) {
  const policy = new Schema(
    {
      name: { type: String, required: true, maxlength: 100 },
      version: { type: Number, required: true },
      autoApplyDraftHours: { type: Boolean, default: false },
      createdBy: { type: Schema.Types.ObjectId, required: true },
      requestKey: { type: String, required: true },
      requestHash: { type: String, required: true },
    },
    { ...options, collection: 'catalog_policies' },
  );
  policy.index({ version: 1 }, { unique: true });
  policy.index({ createdBy: 1, requestKey: 1 }, { unique: true });
  const campaign = new Schema(
    {
      actorId: { type: Schema.Types.ObjectId, required: true },
      requestKey: { type: String, required: true },
      requestHash: { type: String, required: true },
      source: { type: String, default: 'geoapify', enum: ['geoapify'] },
      policy: { type: policySnapshotSchema, required: true },
      state: { type: String, default: 'active', enum: ['active', 'paused'] },
    },
    { ...options, collection: 'catalog_campaigns' },
  );
  campaign.index({ actorId: 1, requestKey: 1 }, { unique: true });
  const bulk = new Schema(
    {
      actorId: { type: Schema.Types.ObjectId, required: true },
      requestKey: { type: String, required: true },
      requestHash: { type: String, required: true },
      action: {
        type: String,
        enum: ['publish', 'archive', 'archive_destination'],
        required: true,
      },
      state: {
        type: String,
        enum: ['preparing', 'preview', 'running', 'completed', 'partial'],
        default: 'preparing',
      },
      selection: { type: Schema.Types.Mixed, required: true },
      destinationId: { type: Schema.Types.ObjectId, default: null },
      destinationName: { type: String, maxlength: 100, default: null },
      destinationRevision: { type: Number, default: null },
      snapshotAt: { type: Date, default: Date.now },
      total: { type: Number, default: 0 },
    },
    { ...options, collection: 'catalog_bulk_jobs' },
  );
  bulk.index({ actorId: 1, requestKey: 1 }, { unique: true });
  bulk.index({ destinationId: 1, action: 1, state: 1 });
  const item = new Schema(
    {
      jobId: { type: Schema.Types.ObjectId, required: true },
      placeId: { type: Schema.Types.ObjectId, required: true },
      expectedRevision: { type: Number, required: true },
      name: { type: String, required: true },
      state: {
        type: String,
        enum: ['pending', 'succeeded', 'blocked', 'failed'],
        default: 'pending',
      },
      eligible: { type: Boolean, required: true },
      reason: { type: String, default: '', maxlength: 500 },
      operationKey: { type: String, required: true },
    },
    { ...options, collection: 'catalog_bulk_items' },
  );
  item.index({ jobId: 1, placeId: 1 }, { unique: true });
  item.index({ jobId: 1, state: 1, _id: 1 });
  const usage = new Schema(
    {
      runId: { type: Schema.Types.ObjectId, default: null },
      provider: { type: String, default: 'geoapify' },
      group: { type: String, required: true },
      requestedLimit: { type: Number, required: true },
      state: {
        type: String,
        enum: ['requested', 'fetched', 'failed'],
        default: 'requested',
      },
      received: { type: Number, default: null },
      errorCode: { type: String, default: null },
      internalRequests: { type: Number, default: 1 },
      providerCredits: { type: Number, default: null },
    },
    { ...options, collection: 'catalog_source_usage' },
  );
  usage.index({ createdAt: -1 });
  usage.index({ runId: 1 });
  return {
    Policy: connection.model('CatalogPolicy', policy),
    Campaign: connection.model('CatalogCampaign', campaign),
    Bulk: connection.model('CatalogBulkJob', bulk),
    Item: connection.model('CatalogBulkItem', item),
    Usage: connection.model('CatalogSourceUsage', usage),
  };
}

const cache = new WeakMap<Connection, ReturnType<typeof createModels>>();
export function adminV3Models(connection: Connection) {
  let models = cache.get(connection);
  if (!models) {
    models = createModels(connection);
    cache.set(connection, models);
  }
  return models;
}
