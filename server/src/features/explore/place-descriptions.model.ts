import { Schema } from 'mongoose';
export const descriptionResultModel = new Schema(
  {
    text: { type: String, maxlength: 1000, default: '' },
    originalText: { type: String, required: true, maxlength: 6000 },
    title: { type: String, required: true, maxlength: 300 },
    sourceUrl: { type: String, required: true, maxlength: 2048 },
    language: { type: String, enum: ['vi', 'en'], required: true },
    translated: { type: Boolean, default: false },
    revisionId: { type: Number, required: true },
    license: { type: String, enum: ['CC-BY-SA-4.0'], required: true },
    match: {
      type: String,
      enum: ['linked', 'name_coordinates'],
      required: true,
    },
  },
  { _id: false, strict: 'throw', versionKey: false },
);
export const descriptionSearchModel = new Schema(
  {
    state: {
      type: String,
      enum: [
        'pending',
        'searching',
        'ready',
        'empty',
        'failed',
        'needs_translation',
      ],
      default: 'pending',
    },
    result: { type: descriptionResultModel, default: null },
    context: { type: String, maxlength: 1500, default: '' },
    message: { type: String, maxlength: 300, default: '' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseToken: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false, strict: 'throw', versionKey: false },
);
