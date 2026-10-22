import mongoose, {
  Schema,
  Types,
  type Connection,
  type ClientSession,
} from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  expenseInputSchema,
  type ExpenseInput,
  type ExpenseDto,
  type ExpenseListDto,
  type BudgetCategory,
} from '@goease/contracts';
import type { tripService } from '../trips/trip.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { requestId } from '../auth/auth.service.js';
import { tokenHash } from '../auth/security.js';
import { HttpError } from '../../http-error.js';

export function expenseService(
  connection: Connection,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
) {
  const schema = new Schema(
    {
      tripId: { type: Schema.Types.ObjectId, required: true },
      recordedBy: { type: Schema.Types.ObjectId, required: true },
      description: { type: String, required: true, maxlength: 160 },
      category: {
        type: String,
        required: true,
        enum: ['transport', 'lodging', 'meal', 'visit', 'other'],
      },
      amountMinor: {
        type: Number,
        required: true,
        min: 1,
        max: 1e12,
        validate: Number.isSafeInteger,
      },
      currency: { type: String, required: true, enum: ['VND'] },
      spentOn: {
        type: String,
        required: true,
        validate: (v: string) =>
          expenseInputSchema.shape.spentOn.safeParse(v).success,
      },
      timezone: { type: String, required: true, enum: ['Asia/Ho_Chi_Minh'] },
      revision: { type: Number, required: true, default: 1 },
      schemaVersion: { type: Number, default: 1 },
      updatedBy: { type: Schema.Types.ObjectId, required: true },
      deletedAt: { type: Date, default: null },
      deletedBy: { type: Schema.Types.ObjectId, default: null },
    },
    {
      collection: 'trip_expenses',
      timestamps: true,
      versionKey: false,
      strict: 'throw',
      autoCreate: false,
      autoIndex: false,
    },
  );
  schema.index({ tripId: 1, deletedAt: 1, spentOn: -1, _id: -1 });
  const Expense = connection.model('TripExpense', schema);
  const { Trip, Key } = trips.models;
  const missing = () =>
    new HttpError(
      404,
      'EXPENSE_NOT_FOUND',
      'Không tìm thấy khoản chi trong chuyến đi của bạn.',
    );
  const conflict = () =>
    new HttpError(
      409,
      'EXPENSE_CONFLICT',
      'Khoản chi đã thay đổi ở nơi khác. Bản đang nhập vẫn được giữ; tải lại danh sách trước khi sửa.',
    );
  async function owned(
    tripId: string,
    owner: Types.ObjectId,
    session: ClientSession,
  ) {
    if (!/^[a-f0-9]{24}$/.test(tripId)) throw missing();
    const trip = await Trip.findOne({
      _id: tripId,
      ownerId: owner,
      deletedAt: null,
    }).session(session);
    if (!trip) throw missing();
    return trip;
  }
  async function totals(tripId: Types.ObjectId, session: ClientSession) {
    const grouped = await Expense.aggregate<{
      _id: BudgetCategory;
      amount: number;
      count: number;
    }>([
      { $match: { tripId, deletedAt: null } },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amountMinor' },
          count: { $sum: 1 },
        },
      },
    ]).session(session);
    const amount = grouped.reduce((n, g) => n + g.amount, 0);
    if (!Number.isSafeInteger(amount))
      throw new HttpError(
        400,
        'EXPENSE_TOTAL_LIMIT',
        'Tổng chi vượt giới hạn số tiền được hỗ trợ.',
      );
    return {
      amount,
      count: grouped.reduce((n, g) => n + g.count, 0),
      categories: (
        ['transport', 'lodging', 'meal', 'visit', 'other'] as const
      ).map((key) => ({
        key,
        amountMinor: grouped.find((g) => g._id === key)?.amount ?? 0,
      })),
    };
  }
  type ExpenseDocument = NonNullable<
    Awaited<ReturnType<typeof Expense.findOne>>
  >;
  const dto = (d: ExpenseDocument): ExpenseDto => ({
    description: d.description,
    category: d.category as ExpenseInput['category'],
    amountMinor: d.amountMinor,
    currency: 'VND',
    spentOn: d.spentOn,
    timezone: 'Asia/Ho_Chi_Minh',
    id: String(d._id),
    revision: d.revision,
    updatedAt: d.updatedAt.toISOString(),
  });
  return {
    models: { Expense },
    async list(
      owner: Types.ObjectId,
      tripId: string,
      query: { offset: number; limit: number },
    ): Promise<ExpenseListDto> {
      return connection.transaction(
        async (session) => {
          const trip = await owned(tripId, owner, session);
          const budget = trips.dto(trip).budgetSummary!;
          const sum = await totals(trip._id, session);
          const items = await Expense.find({
            tripId: trip._id,
            deletedAt: null,
          })
            .sort({ spentOn: -1, _id: -1 })
            .skip(query.offset)
            .limit(query.limit)
            .session(session);
          return {
            items: items.map(dto),
            totalCount: sum.count,
            hasMore: query.offset + items.length < sum.count,
            offset: query.offset,
            tripRevision: trip.revision,
            budget,
            actual: {
              amountMinor: sum.amount,
              remainingMinor:
                budget.budgetMinor === null
                  ? null
                  : budget.budgetMinor - sum.amount,
              perPersonMinor: Math.round(
                sum.amount / trip.travelers!.totalCount!,
              ),
              differenceFromEstimateMinor:
                sum.amount - budget.knownEstimatedMinor,
              categories: sum.categories,
            },
          };
        },
        { readConcern: { level: 'snapshot' } },
      );
    },
    async write(
      owner: Types.ObjectId,
      tripId: string,
      action: 'created' | 'updated' | 'deleted',
      key: string,
      value?: ExpenseInput,
      id?: string,
      expectedRevision?: number,
    ) {
      if (id && !/^[a-f0-9]{24}$/.test(id)) throw missing();
      const operation = `expense.${action}`;
      const requestHash = tokenHash(
        JSON.stringify({ tripId, action, id, value, expectedRevision }),
      );
      const operationId = randomUUID(),
        reqId = requestId();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await connection.transaction(async (session) => {
            await owned(tripId, owner, session);
            const cached = await Key.findOne({
              actorId: owner,
              operation,
              key,
            }).session(session);
            if (cached) {
              if (cached.requestHash !== requestHash)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Nội dung thao tác đã thay đổi. Hãy thử lại bằng thao tác mới.',
                );
              return { completed: true };
            }
            // Serialize expense writes with each other and itinerary ownership changes.
            // This does not change the itinerary revision or overwrite its snapshot.
            await Trip.updateOne(
              { _id: tripId, ownerId: owner, deletedAt: null },
              { $inc: { expenseRevision: 1 } },
              { session, timestamps: false },
            );
            let result: ExpenseDocument;
            if (action === 'created') {
              result = await new Expense({
                ...value,
                tripId,
                recordedBy: owner,
                updatedBy: owner,
              }).save({ session });
            } else {
              const current = await Expense.findOne({
                _id: id,
                tripId,
                deletedAt: null,
              }).session(session);
              if (!current) throw missing();
              if (current.revision !== expectedRevision) throw conflict();
              const changed = await Expense.findOneAndUpdate(
                {
                  _id: id,
                  tripId,
                  deletedAt: null,
                  revision: expectedRevision,
                },
                {
                  $set:
                    action === 'deleted'
                      ? {
                          deletedAt: new Date(),
                          deletedBy: owner,
                          updatedBy: owner,
                        }
                      : { ...value, updatedBy: owner },
                  $inc: { revision: 1 },
                },
                { session, returnDocument: 'after', runValidators: true },
              );
              if (!changed) throw conflict();
              result = changed;
            }
            await totals(new Types.ObjectId(tripId), session);
            await audit.append(
              {
                action: `expense.${action}`,
                actorUserId: String(owner),
                entityId: String(result._id),
                entityRevision: result.revision,
                requestId: reqId,
                operationId,
              },
              session,
            );
            await new Key({
              actorId: owner,
              operation,
              key,
              requestHash,
              status: 'completed',
              resourceType: 'trip_expense',
              resourceId: String(result._id),
              responseStatus: action === 'created' ? 201 : 200,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return { completed: true };
          });
        } catch (e) {
          const race =
            e instanceof mongoose.mongo.MongoServerError &&
            e.code === 11000 &&
            JSON.stringify(e.keyPattern) ===
              JSON.stringify({ actorId: 1, operation: 1, key: 1 });
          if (!race || attempt === 2) throw e;
        }
      }
      throw new Error('Expense retry limit');
    },
  };
}
