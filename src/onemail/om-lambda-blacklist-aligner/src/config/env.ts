export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    blacklistDbTable:
      process.env.AWS_BLACKLIST_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_BLACKLIST_DB_TABLE'),
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
