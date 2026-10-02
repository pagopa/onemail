import { alignBlacklist } from '#services/align.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAllSuppressedDestinations = vi.hoisted(() => vi.fn());
const scanAllBlacklistedAddresses = vi.hoisted(() => vi.fn());
const putBlacklistItems = vi.hoisted(() => vi.fn());
const publishMetrics = vi.hoisted(() => vi.fn());

vi.mock('#repositories/suppression.repository', () => ({
  listAllSuppressedDestinations,
}));
vi.mock('#repositories/blacklist.repository', () => ({
  scanAllBlacklistedAddresses,
  putBlacklistItems,
}));
vi.mock('#config/env', () => ({
  default: {
    aws: { blacklistDbTable: 'blacklist-table' },
  },
}));
vi.mock('om-common/repositories', () => ({
  BlacklistAlignerMetricName: {
    BlacklistAlignedInserted: 'BlacklistAlignedInserted',
  },
  publishMetrics,
}));

const suppressionOf = (...addresses: string[]) =>
  new Map(
    addresses.map((emailAddress) => [
      emailAddress,
      { emailAddress, reason: 'BOUNCE' },
    ]),
  );

const blacklistOf = (...addresses: string[]) =>
  addresses.map((emailAddress) => ({ emailAddress }));

beforeEach(() => {
  vi.clearAllMocks();
  putBlacklistItems.mockImplementation(
    async (items: unknown[]) => items.length,
  );
});

describe('alignBlacklist', () => {
  it('inserts addresses present in SES but missing in DynamoDB', async () => {
    listAllSuppressedDestinations.mockResolvedValue(
      suppressionOf('known@example.it', 'missing@example.it'),
    );
    scanAllBlacklistedAddresses.mockResolvedValue(
      blacklistOf('known@example.it'),
    );

    const summary = await alignBlacklist();

    expect(putBlacklistItems).toHaveBeenCalledWith([
      {
        emailAddress: 'missing@example.it',
        tenantName: 'suppressionList',
      },
    ]);
    expect(summary.inserted).toBe(1);
  });

  it('does not remove addresses absent from this region SES list', async () => {
    listAllSuppressedDestinations.mockResolvedValue(
      suppressionOf('kept@example.it'),
    );
    scanAllBlacklistedAddresses.mockResolvedValue(
      blacklistOf(
        'kept@example.it',
        'stale@example.it',
        'other@example.it',
        'more@example.it',
      ),
    );

    const summary = await alignBlacklist();

    expect(putBlacklistItems).toHaveBeenCalledWith([]);
    expect(summary).toEqual({ suppressed: 1, blacklisted: 4, inserted: 0 });
  });

  it('publishes the alignment metrics', async () => {
    listAllSuppressedDestinations.mockResolvedValue(
      suppressionOf('missing@example.it'),
    );
    scanAllBlacklistedAddresses.mockResolvedValue([]);

    await alignBlacklist();

    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'BlacklistAlignedInserted', value: 1 },
    ]);
  });

  it('propagates a suppression listing failure without touching DynamoDB', async () => {
    listAllSuppressedDestinations.mockRejectedValue(new Error('AccessDenied'));

    await expect(alignBlacklist()).rejects.toThrow('AccessDenied');

    expect(scanAllBlacklistedAddresses).not.toHaveBeenCalled();
    expect(putBlacklistItems).not.toHaveBeenCalled();
  });
});
