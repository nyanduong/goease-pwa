import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { parseConfig } from '../src/config.js';
import { authModels } from '../src/features/auth/auth.models.js';
import { businessAudit } from '../src/features/audit/business-audit.js';

// Local operator command only; never exposed as a signup option or HTTP endpoint.
const connection = mongoose.createConnection();
try {
  const config = parseConfig(process.env);
  const [action, email] = process.argv.slice(2);
  if (
    config.NODE_ENV !== 'development' ||
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/goease\?replicaSet=rs0$/.test(
      config.MONGODB_URI,
    ) ||
    !['grant', 'revoke'].includes(action ?? '') ||
    !email ||
    process.argv.slice(2).length !== 2
  )
    throw new Error('Invalid local admin command');
  await connection.openUri(config.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 3000,
  });
  const { User } = authModels(connection);
  const audit = businessAudit(connection, 'development');
  await audit.initialize();
  const operationId = randomUUID();
  await connection.transaction(async (session) => {
    const user = await User.findOne({
      emailNormalized: email.trim().toLowerCase(),
      status: 'active',
      deletedAt: null,
    }).session(session);
    if (!user) throw new Error('Account not found');
    if (user.roles.includes('admin') === (action === 'grant')) return;
    user.roles = action === 'grant' ? ['traveler', 'admin'] : ['traveler'];
    // Require a fresh login after a privilege change.
    user.securityVersion += 1;
    user.revision += 1;
    user.updatedBy = null;
    user.updatedByType = 'system';
    await user.save({ session });
    await audit.append(
      {
        action: action === 'grant' ? 'admin.granted' : 'admin.revoked',
        entityId: String(user._id),
        operationId,
        requestId: operationId,
      },
      session,
    );
  });
  console.info('Admin access updated. Sign in again.');
} catch {
  console.error(
    'Admin access failed. Use grant|revoke and an existing active account email; only local development goease on 27017/rs0 is allowed.',
  );
  process.exitCode = 1;
} finally {
  await connection.close();
}
