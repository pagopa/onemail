import { baseLogger } from 'om-common/logger';

export const logger = baseLogger;

export const getLogger = (methodName?: string) => {
  const logger = baseLogger.createChild();
  if (methodName) {
    logger.appendKeys({ method: methodName });
  }
  return logger;
};
