import { Schema } from 'mongoose';
const evidence = {
  sourceUrl: { type: String, required: true, maxlength: 2048 },
  observedAt: { type: String, required: true },
  reviewed: { type: Boolean, default: false },
};
const options = {
  _id: false,
  strict: 'throw' as const,
  versionKey: false as const,
};
export const visitInfoModel = new Schema(
  {
    hours: {
      type: new Schema(
        { ...evidence, text: { type: String, required: true, maxlength: 400 } },
        options,
      ),
      default: null,
    },
    price: {
      type: new Schema(
        {
          ...evidence,
          amount: { type: Number, required: true, min: 0, max: 1e9 },
          currency: { type: String, enum: ['VND'], required: true },
          unit: {
            type: String,
            enum: ['person', 'item', 'group', 'unspecified'],
            required: true,
          },
          conditions: { type: String, required: true, maxlength: 500 },
        },
        options,
      ),
      default: null,
    },
  },
  options,
);
export const visitSearchModel = new Schema(
  {
    providerVersion: { type: Number, default: 3 },
    state: {
      type: String,
      enum: ['pending', 'searching', 'ready', 'empty', 'failed'],
      default: 'pending',
    },
    result: { type: visitInfoModel, default: null },
    context: { type: String, maxlength: 3000, default: '' },
    message: { type: String, maxlength: 300, default: '' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseToken: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
    checkedAt: { type: Date, default: null },
  },
  options,
);
