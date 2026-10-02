import { getNamedLogger } from '#config/logger';
import {
  putBlacklistItems,
  scanAllBlacklistedAddresses,
} from '#repositories/blacklist.repository';
import { listAllSuppressedDestinations } from '#repositories/suppression.repository';
import {
  BlacklistAlignerMetricName,
  publishMetrics,
} from 'om-common/repositories';

const SUPPRESSION_LIST_TENANT_NAME = 'suppressionList';

export interface AlignmentSummary {
  suppressed: number;
  blacklisted: number;
  inserted: number;
}

export const alignBlacklist = async (): Promise<AlignmentSummary> => {
  const logger = getNamedLogger(alignBlacklist.name);
  logger.info('Start');

  // A failure here aborts the run before any blacklist writes are made.
  const suppressed = await listAllSuppressedDestinations();
  const blacklisted = await scanAllBlacklistedAddresses();
  const blacklistedAddresses = new Set(
    blacklisted.map((item) => item.emailAddress),
  );

  const missingItems = [...suppressed.values()]
    .filter(({ emailAddress }) => !blacklistedAddresses.has(emailAddress))
    .map(({ emailAddress }) => ({
      emailAddress,
      tenantName: SUPPRESSION_LIST_TENANT_NAME,
    }));

  const insertedLength = await putBlacklistItems(missingItems);

  publishMetrics([
    {
      name: BlacklistAlignerMetricName.BlacklistAlignedInserted,
      value: insertedLength,
    },
  ]);

  logger.info('End', {
    suppressed: suppressed.size,
    blacklisted: blacklisted.length,
    inserted: insertedLength,
  });

  return {
    suppressed: suppressed.size,
    blacklisted: blacklisted.length,
    inserted: insertedLength,
  };
};
