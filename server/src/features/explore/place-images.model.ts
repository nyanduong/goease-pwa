import { Schema } from 'mongoose';
import { catalogImageSchema } from '@goease/contracts';
export const photoSchema = new Schema(
  {
    url: { type: String, required: true, maxlength: 2048 },
    credit: { type: String, required: true, maxlength: 1000 },
    license: {
      type: String,
      required: true,
      enum: catalogImageSchema.shape.license.options,
    },
    sourceUrl: { type: String, required: true, maxlength: 2048 },
    licenseUrl: { type: String, maxlength: 2048 },
    reviewed: { type: Boolean, default: false },
    selection: { type: String, enum: ['automatic', 'admin'] },
    kind: { type: String, enum: ['photo', 'ai_illustration'] },
    storage: { type: String, enum: ['cloudinary', 'source'] },
    originalUrl: { type: String, maxlength: 2048 },
  },
  { _id: false, strict: 'throw', versionKey: false },
);
export const imageSearchSchema = new Schema(
  {
    defaultCover: { type: photoSchema, default: null },
    storageVersion: { type: Number, default: 3 },
    state: {
      type: String,
      enum: ['pending', 'searching', 'ready', 'empty', 'failed'],
      default: 'pending',
    },
    candidates: {
      type: [
        new Schema(
          {
            id: String,
            title: { type: String, maxlength: 300 },
            match: { type: String, enum: ['name', 'nearby'] },
            image: photoSchema,
          },
          { _id: false, strict: 'throw', versionKey: false },
        ),
      ],
      default: [],
      validate: (v: unknown[]) => v.length <= 6,
    },
    attempts: { type: Number, default: 0 },
    priority: { type: Number, min: 0, max: 100, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseToken: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
    checkedAt: { type: Date, default: null },
    preferredCandidatesUntil: { type: Date, default: null },
    preferredCandidatesContext: { type: String, maxlength: 2000, default: '' },
    message: { type: String, default: '', maxlength: 300 },
  },
  { _id: false, strict: 'throw', versionKey: false },
);
