import type { Context, Handler } from 'aws-lambda';

import { addLambdaContextToLogger, getLogger } from '#config/logger';
import { alignBlacklist, type AlignmentSummary } from '#services/align.service';
import middy from '@middy/core';
import {
  BlacklistAlignerMetricName,
  flushMetrics,
  publishMetrics,
} from 'om-common/repositories';

const logger = getLogger();

const lambdaHandler: Handler<unknown, AlignmentSummary> = async (
  _event: unknown,
  context: Context,
) => {
  addLambdaContextToLogger(context);

  try {
    return await alignBlacklist();
  } catch (error) {
    publishMetrics([
      { name: BlacklistAlignerMetricName.BlacklistAlignmentFailed },
    ]);
    logger.error('Blacklist alignment failed', { error });
    throw error;
  }
};

export const handler = middy(lambdaHandler).use(flushMetrics);
