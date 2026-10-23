import { Schema } from 'mongoose';

export const referencePriceFields = {
  label: { type: String, required: true, maxlength: 120 },
  amountMinor: { type: Number, required: true, min: 0, max: 1e12 },
  basis: { type: String, required: true, enum: ['per_person', 'group_total'] },
  maxTravelers: { type: Number, required: true, min: 1, max: 1000 },
  conditions: { type: String, required: true, maxlength: 500 },
  sourceUrl: { type: String, required: true, maxlength: 2048 },
  checkedAt: { type: String, required: true },
  reviewAfter: { type: String, required: true },
};
export const referencePriceModelSchema = new Schema(referencePriceFields, {
  _id: false,
  versionKey: false,
  strict: 'throw',
});
