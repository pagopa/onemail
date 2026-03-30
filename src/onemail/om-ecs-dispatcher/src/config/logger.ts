import { baseLogger } from 'om-common/logger';

const logger = baseLogger.createChild({
  serviceName: 'om-ecs-dispatcher',
});

export const getLogger = () => logger;

export const getNamedLogger = (methodName: string) => {
  const namedLogger = logger.createChild();
  namedLogger.appendKeys({ method: methodName });
  return namedLogger;
};
