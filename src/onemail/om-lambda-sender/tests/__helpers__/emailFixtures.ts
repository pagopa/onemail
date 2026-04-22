import type { SQSRecord } from 'aws-lambda';

import { makeSqsRecordBody } from '../../../testing/fixtures.js';

export { makeEmailStatusHistoryItem } from '../../../testing/fixtures.js';

export const makeSqsRecord = (body: unknown): SQSRecord =>
  makeSqsRecordBody(body) as SQSRecord;
