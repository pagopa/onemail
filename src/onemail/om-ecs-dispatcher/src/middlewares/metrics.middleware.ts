import { getLogger } from '#config/logger';
import { NextFunction, Request, Response } from 'express';
import { forceFlushMetrics } from 'om-common/repositories';
import onFinished from 'on-finished';

const logger = getLogger();

export const metricsFlush = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  onFinished(res, () => {
    try {
      forceFlushMetrics();
    } catch (error) {
      logger.error('Error flushing metrics:', { error });
    }
  });

  next();
};
