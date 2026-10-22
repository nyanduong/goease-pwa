export function validateTestUri(
  uri: string | undefined,
  nodeEnv: string | undefined,
  applicationUri?: string,
) {
  if (nodeEnv === 'production' || !uri)
    throw new Error(
      'Smoke check requires a local test database outside production',
    );
  // Deliberately reject credentials, multiple hosts, SRV, alternative database names and auth options.
  if (
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):\d{1,5}\/goease_f0_test(?:\?replicaSet=[a-zA-Z0-9_-]+)?$/.test(
      uri,
    )
  ) {
    throw new Error(
      'Only loopback /goease_f0_test with an optional replicaSet is allowed',
    );
  }
  if (applicationUri) {
    let applicationDatabase: string;
    try {
      applicationDatabase = new URL(applicationUri).pathname;
    } catch {
      throw new Error('Application URI is invalid; refusing smoke check');
    }
    if (applicationDatabase === '/goease_f0_test') {
      throw new Error(
        'The smoke database must not be configured as the application database',
      );
    }
  }
  return uri;
}
