import { randomUUID } from 'node:crypto';
import { Schema, type Connection } from 'mongoose';
import type { TripInput } from '@goease/contracts';
import { mutableFields } from '../auth/auth.models.js';
import { calculateBudget } from './budget.js';
import { referencePriceFields } from '../explore/reference-price.js';

export function tripModels(connection: Connection) {
  const noId = {
    _id: false,
    strict: 'throw' as const,
    versionKey: false as const,
  };
  const destination = new Schema(
    {
      destinationId: { type: Schema.Types.ObjectId, required: true },
      nameSnapshot: String,
      timezone: String,
      order: Number,
    },
    noId,
  );
  const cost = new Schema(
    {
      amountMinor: { type: Number, default: null },
      currency: { type: String, enum: ['VND'], required: true },
      basis: {
        type: String,
        enum: ['group_total', 'per_person'],
        required: true,
      },
      quantity: { type: Number, enum: [1], required: true },
      confidence: {
        type: String,
        enum: ['user_entered', 'catalog_reference'],
        required: true,
      },
      reference: {
        type: new Schema(
          {
            ...referencePriceFields,
            placeRevision: { type: Number, required: true },
          },
          noId,
        ),
        required: false,
      },
    },
    noId,
  );
  const activity = new Schema(
    {
      activityId: { type: String, required: true },
      placeId: Schema.Types.ObjectId,
      kind: {
        type: String,
        enum: ['visit', 'meal', 'transport', 'lodging', 'free_time', 'custom'],
        required: true,
      },
      title: { type: String, maxlength: 120, required: true },
      startLocalTime: String,
      endLocalTime: String,
      timezone: String,
      order: Number,
      notes: { type: String, maxlength: 2000 },
      estimatedCost: { type: cost, required: true },
      source: { type: String, enum: ['manual', 'ai'], required: true },
      addedAt: Date,
      updatedAt: Date,
    },
    noId,
  );
  const day = new Schema(
    {
      dayId: { type: String, required: true },
      date: { type: String, required: true },
      destinationId: { type: Schema.Types.ObjectId, required: true },
      activities: { type: [activity], default: [] },
    },
    noId,
  );
  const budget = new Schema(
    {
      amountMinor: { type: Number, default: null },
      currency: { type: String, enum: ['VND'], required: true },
      scope: { type: String, enum: ['group_total'], required: true },
      includedCategories: [String],
    },
    noId,
  );
  const preferences = new Schema(
    {
      interestCodes: [String],
      pace: {
        type: String,
        enum: ['relaxed', 'balanced', 'active'],
        required: true,
      },
      transportModes: [String],
    },
    noId,
  );
  const inputFields = {
    title: { type: String, required: true, maxlength: 120 },
    destinations: { type: [destination], required: true },
    startDate: String,
    endDate: String,
    timezone: String,
    travelers: { totalCount: Number },
    budget: { type: budget, required: true },
    preferences: { type: preferences, required: true },
    generationMode: { type: String, enum: ['manual', 'ai'], required: true },
    aiRunId: String,
    days: { type: [day], required: true },
    notes: { type: String, maxlength: 2000, default: '' },
  };
  const schema = new Schema(
    {
      ...mutableFields,
      ...inputFields,
      ownerId: { type: Schema.Types.ObjectId, required: true },
      clonedFromTripId: { type: Schema.Types.ObjectId, default: null },
      expenseRevision: { type: Number, default: 0 },
      status: { type: String, enum: ['draft'], default: 'draft' },
      visibility: { type: String, enum: ['private'], default: 'private' },
      deletedAt: { type: Date, default: null },
      deletedBy: { type: Schema.Types.ObjectId, default: null },
      deletionReasonCode: { type: String, default: null },
      firstSavedAt: { type: Date, required: true },
      completedAt: { type: Date, default: null },
      summaryTotals: {
        knownEstimatedMinor: Number,
        missingCostCount: Number,
        currency: { type: String, enum: ['VND'] },
      },
    },
    {
      collection: 'trips',
      timestamps: true,
      versionKey: false,
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  schema.index({ ownerId: 1, deletedAt: 1, updatedAt: -1, _id: -1 });
  schema.index({ ownerId: 1, status: 1, deletedAt: 1 });
  const snapshot = new Schema(inputFields, noId);
  const revisions = new Schema(
    {
      eventId: { type: String, default: randomUUID },
      schemaVersion: { type: Number, default: 1 },
      tripId: { type: Schema.Types.ObjectId, required: true },
      ownerIdAtWrite: { type: Schema.Types.ObjectId, required: true },
      revision: { type: Number, required: true },
      previousRevision: { type: Number, default: null },
      tripSchemaVersion: { type: Number, default: 1 },
      action: {
        type: String,
        enum: ['created', 'saved', 'deleted', 'restored'],
        required: true,
      },
      snapshot: { type: snapshot, required: true },
      changedFieldPaths: {
        type: [String],
        enum: ['tripDetails'],
        default: ['tripDetails'],
      },
      actorId: { type: Schema.Types.ObjectId, required: true },
      actorType: { type: String, enum: ['user'], default: 'user' },
      requestId: { type: String, required: true },
      operationId: { type: String, required: true },
    },
    {
      collection: 'trip_revisions',
      timestamps: { createdAt: true, updatedAt: false },
      versionKey: false,
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  revisions.index({ eventId: 1 }, { unique: true });
  revisions.index({ tripId: 1, revision: 1 }, { unique: true });
  revisions.index({ tripId: 1, createdAt: -1 });
  const keys = new Schema(
    {
      schemaVersion: { type: Number, default: 1 },
      actorId: { type: Schema.Types.ObjectId, required: true },
      operation: { type: String, required: true },
      key: { type: String, required: true },
      requestHash: { type: String, required: true },
      status: { type: String, enum: ['completed'], required: true },
      leaseUntil: { type: Date, default: null },
      resourceType: {
        type: String,
        enum: [
          'trip',
          'trip_expense',
          'place',
          'place_import',
          'catalog_operation',
        ],
        default: 'trip',
      },
      resourceId: { type: String, required: true },
      resultIds: {
        type: [String],
        default: undefined,
        validate: (v: string[] | undefined) =>
          v === undefined ||
          (v.length <= 50 && v.every((id) => /^[a-f0-9]{24}$/.test(id))),
      },
      responseStatus: Number,
      catalogResults: {
        type: [
          new Schema(
            {
              id: { type: String, required: true },
              name: { type: String, required: true, maxlength: 120 },
              eligible: { type: Boolean, required: true },
              reason: { type: String, required: true, maxlength: 400 },
              applied: Boolean,
            },
            { _id: false, strict: 'throw', versionKey: false },
          ),
        ],
        default: undefined,
        validate: (v: unknown[] | undefined) => !v || v.length <= 50,
      },
      expiresAt: { type: Date, required: true },
    },
    {
      collection: 'idempotency_keys',
      timestamps: true,
      versionKey: false,
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  keys.index({ actorId: 1, operation: 1, key: 1 }, { unique: true });
  keys.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const rights = new Schema(
    {
      policyRef: String,
      cacheAllowed: Boolean,
      persistentSnapshotAllowed: Boolean,
      attributionRequired: Boolean,
    },
    noId,
  );
  const source = new Schema(
    {
      provider: String,
      fetchedAt: Date,
      rights: { type: rights, required: true },
    },
    noId,
  );
  const destinations = new Schema(
    {
      ...mutableFields,
      slug: { type: String, required: true },
      name: { type: String, required: true },
      countryCode: { type: String, default: 'VN' },
      summary: String,
      timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
      publicationStatus: {
        type: String,
        enum: ['published', 'draft', 'archived'],
        required: true,
      },
      source: { type: source, required: true },
      deletedAt: { type: Date, default: null },
      deletedBy: { type: Schema.Types.ObjectId, default: null },
      deletionReasonCode: { type: String, default: null },
    },
    {
      collection: 'destinations',
      timestamps: true,
      versionKey: false,
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  destinations.index(
    { slug: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } },
  );
  destinations.index({ publicationStatus: 1, deletedAt: 1 });
  return {
    Trip: connection.model('Trip', schema),
    Revision: connection.model('TripRevision', revisions),
    Key: connection.model('IdempotencyKey', keys),
    Destination: connection.model('Destination', destinations),
  };
}
export function summaryTotals(input: TripInput) {
  const summary = calculateBudget(input);
  return {
    knownEstimatedMinor: summary.knownEstimatedMinor,
    missingCostCount: summary.missingCostCount,
    currency: 'VND' as const,
  };
}
