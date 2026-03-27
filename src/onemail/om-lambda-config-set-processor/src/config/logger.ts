import { Logger } from '@aws-lambda-powertools/logger';

// TODO: consider using a shared logger instance from a common package with dynamic service name based on env var or something else
export const logger = new Logger();

logger.appendPersistentKeys({
  serviceName: 'om-lambda-config-set-processor',
});

// TODO: check
logger.removeKeys(['function_memory_size']);
