import { Schema } from 'mongoose';

export const referencePriceFields = {
  label: { type: String, required: true, maxlength: 120 },
  amountMinor: { type: Number, required: true, min: 0, max: 1e12 },
  basis: { type: String, required: true, enum: ['per_person', 'group_total'] },
  maxTravelers: { type: Number, required: true, min: 1, max: 1000 },
  minTravelers: { type: Number, min: 1, max: 1000 },
  conditions: { type: String, required: true, maxlength: 500 },
  inclusions: { type: String, maxlength: 500 },
  exclusions: { type: String, maxlength: 500 },
  bundle: {
    type: new Schema(
      {
        code: { type: String, required: true, match: /^[a-z0-9-]{3,80}$/ },
        validDays: { type: Number, required: true, min: 1, max: 31 },
        maxEntries: { type: Number, required: true, min: 1, max: 300 },
      },
      { _id: false, strict: 'throw' },
    ),
    default: undefined,
  },
  sourceUrl: { type: String, required: true, maxlength: 2048 },
  checkedAt: { type: String, required: true },
  reviewAfter: { type: String, required: true },
};
export const referencePriceModelSchema = new Schema(referencePriceFields, {
  _id: false,
  versionKey: false,
  strict: 'throw',
});
