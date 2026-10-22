import { z } from 'zod';
import type { BudgetSummary } from './budget.js';

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
    placeId: objectId.optional(),
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
      basis: z.enum(['group_total', 'per_person']),
      quantity: z.literal(1),
      confidence: z.literal('user_entered'),
    }),
    source: z.enum(['manual', 'ai']),
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
    generationMode: z.enum(['manual', 'ai']),
    aiRunId: z.uuid().optional(),
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
  avatarUrl?: string | null;
};
export type TripDto = TripInput & {
  budgetSummary?: BudgetSummary;
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

export const tripLifecycle = (
  trip: { startDate: string; endDate: string },
  today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date()),
): 'upcoming' | 'ongoing' | 'completed' =>
  today < trip.startDate
    ? 'upcoming'
    : today > trip.endDate
      ? 'completed'
      : 'ongoing';
export const tripListQuerySchema = z.strictObject({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  phase: z.enum(['all', 'upcoming', 'ongoing', 'completed']).default('all'),
});
export const tripActionSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export const tripDuplicateSchema = tripActionSchema.extend({
  startDate: localDate,
});
export function shiftTripDays(
  value: TripInput,
  startDate: string,
  endDate: string,
  makeId: () => string,
): TripInput {
  const count = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
  if (
    !localDate.safeParse(startDate).success ||
    !localDate.safeParse(endDate).success ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 31
  )
    throw new Error('Chọn khoảng thời gian hợp lệ, từ 1 đến 31 ngày.');
  if (value.days.slice(count).some((d) => d.activities.length))
    throw new Error(
      'Ngày bị rút bớt vẫn có hoạt động. Giữ số ngày hoặc chuyển các điểm dừng trước khi rút ngắn.',
    );
  return {
    ...value,
    startDate,
    endDate,
    days: Array.from({ length: count }, (_, i) => ({
      dayId: value.days[i]?.dayId ?? makeId(),
      date: new Date(Date.parse(startDate) + i * 86400000)
        .toISOString()
        .slice(0, 10),
      destinationId: value.destinations[0]!.destinationId,
      activities: value.days[i]?.activities ?? [],
    })),
  };
}

export const profileUpdateSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(100),
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      try {
        const u = new URL(value);
        return u.protocol === 'https:' && !u.username && !u.password;
      } catch {
        return false;
      }
    })
    .nullable(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export const passwordChangeSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  });
export type AccountDto = {
  user: UserDto;
  revision: number;
  canChangePassword: boolean;
};

export const shareCreateSchema = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]),
});
export type ShareLinkDto = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
export type SharedActivity = Pick<
  ActivityInput,
  | 'activityId'
  | 'placeId'
  | 'kind'
  | 'title'
  | 'startLocalTime'
  | 'endLocalTime'
  | 'timezone'
  | 'order'
>;
export type SharedTripDto = {
  title: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  expiresAt: string;
  days: {
    dayId: string;
    date: string;
    destinationId: string;
    activities: SharedActivity[];
  }[];
};

export const forgotPasswordSchema = loginSchema.pick({ email: true });
export const resetPasswordSchema = z.strictObject({
  token: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  newPassword: z.string().min(12).max(128),
});
export const resetRequestMessage =
  'Đã tiếp nhận yêu cầu. Nếu email có tài khoản mật khẩu đủ điều kiện, hệ thống sẽ thử gửi link đặt lại. Kiểm tra cả thư rác; nếu chưa nhận, thử lại sau ít nhất một phút.';
