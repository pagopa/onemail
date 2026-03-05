import type { SQSRecord } from 'aws-lambda';

import { logger } from '#config/logger';

export const highPriorityHandler = async (record: SQSRecord): Promise<void> => {
  const payload = record.body;
  if (payload) {
    const item = JSON.parse(payload);
    logger.info('Processed item', { item });
  }
};
