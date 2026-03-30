import { baseLogger } from 'om-common/logger';

export const logger = baseLogger.createChild({
  serviceName: 'om-ecs-dispatcher',
});
