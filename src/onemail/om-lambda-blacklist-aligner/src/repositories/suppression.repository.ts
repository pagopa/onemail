import { getNamedLogger } from '#config/logger';
import { sesClient } from '#connectors/ses.connector';
import {
  ListSuppressedDestinationsCommand,
  type ListSuppressedDestinationsCommandOutput,
  TooManyRequestsException,
} from '@aws-sdk/client-sesv2';

export interface SuppressedDestination {
  emailAddress: string;
}

const PAGE_SIZE = 1000;
const MAX_RETRIES = 5;

const normalizeEmailAddress = (emailAddress: string): string =>
  emailAddress.trim().toLowerCase();

const listPage = async (
  nextToken: string | undefined,
): Promise<ListSuppressedDestinationsCommandOutput> => {
  const logger = getNamedLogger(listPage.name);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await sesClient.send(
        new ListSuppressedDestinationsCommand({
          NextToken: nextToken,
          PageSize: PAGE_SIZE,
        }),
      );
    } catch (error) {
      if (
        !(error instanceof TooManyRequestsException) ||
        attempt === MAX_RETRIES
      ) {
        throw error;
      }

      logger.warn('SES throttled the suppression list request, retrying', {
        attempt: attempt + 1,
      });
    }
  }
};

/**
 * Retrieves the whole account-level suppression list.
 * Any failure propagates: a partial listing must never drive a diff.
 */
export const listAllSuppressedDestinations = async (): Promise<
  Map<string, SuppressedDestination>
> => {
  const logger = getNamedLogger(listAllSuppressedDestinations.name);
  const destinations = new Map<string, SuppressedDestination>();

  let nextToken: string | undefined;
  let pages = 0;

  do {
    const page = await listPage(nextToken);
    pages += 1;

    for (const summary of page.SuppressedDestinationSummaries ?? []) {
      if (!summary.EmailAddress) {
        continue;
      }

      const emailAddress = normalizeEmailAddress(summary.EmailAddress);
      destinations.set(emailAddress, {
        emailAddress,
      });
    }

    nextToken = page.NextToken;
  } while (nextToken);

  logger.info('Suppression list retrieved', {
    pages,
    addresses: destinations.size,
  });

  return destinations;
};
