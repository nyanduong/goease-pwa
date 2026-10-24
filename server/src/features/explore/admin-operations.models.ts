import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from 'mongoose';

export function adminOperationsModels(connection: Connection) {
  const version = new Schema(
    {
      placeId: { type: Schema.Types.ObjectId, required: true },
      revision: { type: Number, required: true },
      snapshot: { type: Schema.Types.Mixed, required: true },
      state: {
        type: String,
        enum: ['historical', 'proposal', 'published'],
        default: 'historical',
      },
      basePublicRevision: { type: Number, default: null },
      actorId: { type: Schema.Types.ObjectId, default: null },
      reason: {
        type: String,
        enum: ['save', 'restore', 'source', 'backfill', 'publish', 'legacy'],
        default: 'legacy',
      },
      restoredFromRevision: { type: Number, default: null },
      ruleRevision: { type: Number, default: null },
      runId: { type: Schema.Types.ObjectId, default: null },
      recordedAt: { type: Date, default: Date.now },
    },
    {
      collection: 'catalog_versions',
      versionKey: false,
      strict: 'throw',
      autoCreate: false,
      autoIndex: false,
    },
  );
  version.index({ placeId: 1, revision: -1 }, { unique: true });
  const settings = new Schema(
    {
      scope: {
        type: String,
        default: 'global',
        enum: ['global'],
        required: true,
      },
      revision: { type: Number, default: 0 },
      defaultDestinationId: { type: String, default: null },
      freshnessDays: { type: Number, min: 7, max: 365, default: 90 },
      showQualityAlerts: { type: Boolean, default: true },
      autoApplyDraftHours: { type: Boolean, default: false },
      regions: {
        type: [
          {
            _id: false,
            destinationId: String,
            latitude: Number,
            longitude: Number,
            radiusMeters: Number,
            enabled: Boolean,
          },
        ],
        default: [],
        validate: (v: unknown[]) => v.length <= 100,
      },
    },
    {
      collection: 'catalog_settings',
      timestamps: true,
      versionKey: false,
      strict: 'throw',
      autoCreate: false,
      autoIndex: false,
    },
  );
  settings.index({ scope: 1 }, { unique: true });
  const decision = new Schema(
    {
      operationId: { type: String, required: true },
      reviewId: { type: Schema.Types.ObjectId, required: true },
      placeId: { type: Schema.Types.ObjectId, required: true },
      actorId: { type: Schema.Types.ObjectId, required: true },
      decision: {
        type: String,
        enum: [
          'keep',
          'apply',
          'ignore',
          'later',
          'distinct',
          'reject',
          'revise',
        ],
        required: true,
      },
      note: { type: String, maxlength: 500, default: '' },
      placeRevision: { type: Number, required: true },
      published: { type: Boolean, default: false },
      occurredAt: { type: Date, default: Date.now },
    },
    {
      collection: 'catalog_decisions',
      strict: 'throw',
      versionKey: false,
      autoCreate: false,
      autoIndex: false,
    },
  );
  decision.index({ operationId: 1 }, { unique: true });
  decision.index({ placeId: 1, occurredAt: -1 });
  type VersionRecord = InferSchemaType<typeof version>;
  type SettingsRecord = InferSchemaType<typeof settings>;
  const Version: Model<VersionRecord> =
    (connection.models.CatalogVersion as Model<VersionRecord> | undefined) ??
    connection.model<VersionRecord>('CatalogVersion', version);
  const Settings: Model<SettingsRecord> =
    (connection.models.CatalogSettings as Model<SettingsRecord> | undefined) ??
    connection.model<SettingsRecord>('CatalogSettings', settings);
  type DecisionRecord = InferSchemaType<typeof decision>;
  const Decision: Model<DecisionRecord> =
    (connection.models.CatalogDecision as Model<DecisionRecord> | undefined) ??
    connection.model<DecisionRecord>('CatalogDecision', decision);
  return { Version, Settings, Decision };
}
