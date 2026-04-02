import type { Context } from 'aws-lambda';

import { baseLogger } from 'om-common/logger';

export const getNamedLogger = (methodName: string) => {
  const logger = baseLogger.createChild();
  logger.appendKeys({ method: methodName });
  return logger;
};

export const getLogger = () => baseLogger;

export const addLambdaContextToLogger = (context: Context) => {
  baseLogger.addContext(context);
};
