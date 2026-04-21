import {
  mapEmailLowPriorityToDbItem,
  mapEmailTransactionalToDbItem,
} from '#utils/dbMapper';
import { SES_SIMULATOR } from 'om-common/utils';
import { describe, expect, it, vi } from 'vitest';

import {
  makeHighPriorityEmailDto,
  makeLowPriorityEmailDto,
  makeTenantConfiguration,
} from '../__helpers__/dtoFactories.js';

const randomUUID = vi.hoisted(() => vi.fn());

vi.mock('node:crypto', () => ({ randomUUID }));

describe('dbMapper', () => {
  it('maps transactional email content using the direct email body payload', () => {
    randomUUID.mockReturnValue('mapped-email-id');

    const result = mapEmailTransactionalToDbItem(
      makeHighPriorityEmailDto(),
      'request-id',
      makeTenantConfiguration(),
      false,
    );

    expect(result).toMatchObject({
      emailId: 'mapped-email-id',
      requestId: 'request-id',
      clientId: 'client-id-a',
      configSetName: 'config-set-a',
      tenantName: 'tenant-a',
      dryRun: false,
      content: {
        subject: 'Test subject',
        to: { email: 'user@example.com', name: 'OneMail Recipient' },
        body: {
          html: '<p>Hello from OneMail test content</p>',
        },
      },
    });
  });

  it('maps low priority emails to SES simulator recipients during dry run', () => {
    randomUUID.mockReturnValueOnce('low-1').mockReturnValueOnce('low-2');

    const result = mapEmailLowPriorityToDbItem(
      makeLowPriorityEmailDto({
        sendingInfo: [
          {
            to: { email: 'first@example.com' },
            templateAttributes: { user: 'first' },
          },
          {
            to: { email: 'second@example.com' },
          },
        ],
      }),
      'request-id-low',
      makeTenantConfiguration(),
      true,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      emailId: 'low-1',
      content: {
        to: { email: SES_SIMULATOR.SUCCESS },
        template: {
          id: 'template-id',
          matchedAttributes: JSON.stringify({ user: 'first' }),
        },
      },
      clientId: 'client-id-a',
      configSetName: 'config-set-a',
      tenantName: 'tenant-a',
      dryRun: true,
    });
    expect(result[1]).toMatchObject({
      emailId: 'low-2',
      content: {
        to: { email: SES_SIMULATOR.SUCCESS },
        template: {
          id: 'template-id',
          matchedAttributes: undefined,
        },
      },
    });
  });
});
