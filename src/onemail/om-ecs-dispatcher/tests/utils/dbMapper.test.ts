import env from '#config/env';
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
  it('sets the TTL from creation time for high and low priority emails', () => {
    const now = new Date('2026-11-06T10:00:00.999Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const expectedExpiration =
        Math.floor(now.getTime() / 1000) + env.emailRetentionDays * 86400;
      const high = mapEmailTransactionalToDbItem(
        makeHighPriorityEmailDto(),
        'request-high',
        makeTenantConfiguration(),
        false,
      );
      const low = mapEmailLowPriorityToDbItem(
        makeLowPriorityEmailDto(),
        'request-low',
        makeTenantConfiguration(),
        false,
      );
      expect(high.expiration_time).toBe(expectedExpiration);
      expect(low.length).toBeGreaterThan(0);
      expect(
        low.every((email) => email.expiration_time === expectedExpiration),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([undefined, { firstName: 'User' }])(
    'maps transactional template content with attributes %j',
    (templateAttributes) => {
      randomUUID.mockReturnValue('templated-email-id');

      const result = mapEmailTransactionalToDbItem(
        {
          from: { email: 'sender@example.com' },
          to: { email: 'user@example.com' },
          templateContent: {
            templateId: 'template-id',
            templateAttributes,
          },
        },
        'request-id',
        makeTenantConfiguration(),
        false,
      );

      expect(result).toMatchObject({
        emailId: 'templated-email-id',
        content: {
          template: {
            id: 'template-id',
            matchedAttributes: templateAttributes
              ? JSON.stringify(templateAttributes)
              : undefined,
          },
        },
      });
      expect(result.content.body).toBeUndefined();
      expect(result.content.subject).toBeUndefined();
    },
  );

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
