import { z } from 'zod';

export const interestCodes = [
  'nature',
  'food',
  'culture',
  'relaxation',
  'adventure',
] as const;
export const manualLimits = {
  days: 31,
  activitiesPerDay: 50,
  activities: 300,
  travelers: 1000,
} as const;
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const objectId = z.string().regex(/^[a-f0-9]{24}$/);
const money = z.number().int().min(0).max(1_000_000_000_000);
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const activityInputSchema = z
  .strictObject({
    activityId: z.uuid(),
    kind: z.enum([
      'visit',
      'meal',
      'transport',
      'lodging',
      'free_time',
      'custom',
    ]),
    title: z.string().trim().min(1).max(120),
    startLocalTime: clock.optional(),
    endLocalTime: clock.optional(),
    timezone: z.literal('Asia/Ho_Chi_Minh'),
    order: z.number().int().min(0).max(299),
    notes: z.string().max(2000).default(''),
    estimatedCost: z.strictObject({
      amountMinor: money.nullable(),
      currency: z.literal('VND'),
      basis: z.literal('group_total'),
      quantity: z.literal(1),
      confidence: z.literal('user_entered'),
    }),
    source: z.literal('manual'),
  })
  .refine(
    (v) =>
      Boolean(v.startLocalTime) === Boolean(v.endLocalTime) &&
      (!v.startLocalTime || v.endLocalTime! > v.startLocalTime),
    { message: 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.' },
  );
export const tripInputSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    destinations: z
      .array(z.strictObject({ destinationId: objectId, order: z.literal(0) }))
      .length(1),
    startDate: localDate,
    endDate: localDate,
    timezone: z.literal('Asia/Ho_Chi_Minh'),
    travelers: z.strictObject({
      totalCount: z.number().int().min(1).max(manualLimits.travelers),
    }),
    budget: z.strictObject({
      amountMinor: money.nullable(),
      currency: z.literal('VND'),
      scope: z.literal('group_total'),
      includedCategories: z
        .array(
          z.enum(['accommodation', 'food', 'transport', 'activity', 'other']),
        )
        .max(5),
    }),
    preferences: z.strictObject({
      interestCodes: z.array(z.enum(interestCodes)).max(5),
      pace: z.enum(['relaxed', 'balanced', 'active']),
      transportModes: z
        .array(z.enum(['walking', 'car', 'motorbike', 'public_transport']))
        .max(4),
    }),
    generationMode: z.literal('manual'),
    days: z
      .array(
        z.strictObject({
          dayId: z.uuid(),
          date: localDate,
          destinationId: objectId,
          activities: z
            .array(activityInputSchema)
            .max(manualLimits.activitiesPerDay),
        }),
      )
      .min(1)
      .max(manualLimits.days),
    notes: z.string().max(2000).default(''),
  })
  .superRefine((v, ctx) => {
    const count =
      (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 + 1;
    const expected = Array.from(
      { length: Math.max(0, Math.min(32, count)) },
      (_, i) =>
        new Date(Date.parse(v.startDate) + i * 86400000)
          .toISOString()
          .slice(0, 10),
    );
    const activityIds = v.days.flatMap((d) =>
      d.activities.map((a) => a.activityId),
    );
    if (
      count < 1 ||
      count > manualLimits.days ||
      JSON.stringify(expected) !== JSON.stringify(v.days.map((d) => d.date)) ||
      new Set(v.days.map((d) => d.dayId)).size !== v.days.length ||
      new Set(activityIds).size !== activityIds.length ||
      activityIds.length > manualLimits.activities ||
      v.days.some((d) => d.activities.some((a, i) => a.order !== i)) ||
      new Set(v.preferences.interestCodes).size !==
        v.preferences.interestCodes.length ||
      v.days.some((d) => d.destinationId !== v.destinations[0]?.destinationId)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Ngày, điểm đến hoặc ID hoạt động không hợp lệ; tối đa 31 ngày và 300 hoạt động.',
      });
  });
export type TripInput = z.infer<typeof tripInputSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type DestinationDto = {
  id: string;
  name: string;
  timezone: string;
  summary: string;
};
export type UserDto = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
};
export type TripDto = TripInput & {
  id: string;
  revision: number;
  destinationName: string;
  updatedAt: string;
  summaryTotals: {
    knownEstimatedMinor: number;
    missingCostCount: number;
    currency: 'VND';
  };
};
export const registerSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(12).max(128),
});
export const loginSchema = registerSchema.omit({ displayName: true });
