import {
  mapDbHighPriorityItemToSesModel,
  mapDbLowPriorityItemToSesModel,
} from '#utils/dbMapper';
import { EmailPriority } from 'om-common/types';
import { SES_SIMULATOR } from 'om-common/utils';
import { describe, expect, it, vi } from 'vitest';

import { makeEmailStatusHistoryItem } from '../__helpers__/emailFixtures.js';

vi.mock('#config/env', () => ({
  default: {
    aws: {
      configurationSetName: 'config-set',
      tenantName: 'tenant-name',
    },
  },
}));

describe('dbMapper high priority utils', () => {
  it('maps a high priority item with body content to the SES send input', () => {
    const input = makeEmailStatusHistoryItem({
      content: {
        from: {
          email: 'sender@example.com',
          name: 'Sender, Inc.',
        },
        to: {
          email: 'user@example.com',
          name: '  User "Quoted"  ',
        },
        subject: 'Subject line',
        body: {
          html: '<p>Hello</p>',
          text: 'Hello',
        },
        extendedHeaders: [{ N: 'X-Test', V: 'value' }],
      },
    });

    expect(mapDbHighPriorityItemToSesModel(input)).toEqual({
      FromEmailAddress: '"Sender, Inc." <sender@example.com>',
      Destination: {
        ToAddresses: ['"  User \\"Quoted\\"  " <user@example.com>'],
      },
      Content: {
        Simple: {
          Subject: { Data: 'Subject line' },
          Body: {
            Html: { Data: '<p>Hello</p>' },
            Text: { Data: 'Hello' },
          },
          Headers: [{ Name: 'X-Test', Value: 'value' }],
        },
      },
      TenantName: 'tenant-name',
      ConfigurationSetName: 'config-set',
    });
  });

  it('rejects a high priority dry-run item with non-simulator recipient', () => {
    expect(() =>
      mapDbHighPriorityItemToSesModel(
        makeEmailStatusHistoryItem({
          dryRun: true,
          content: {
            from: { email: 'sender@example.com' },
            to: { email: 'user@example.com' },
            subject: 'Subject line',
            body: { html: '<p>Hello</p>' },
          },
        }),
      ),
    ).toThrowError(expect.objectContaining({ name: 'DryRunValidationError' }));
  });

  it('maps a high priority item with template content to the SES send input', () => {
    expect(
      mapDbHighPriorityItemToSesModel(
        makeEmailStatusHistoryItem({
          content: {
            from: { email: 'sender@example.com' },
            to: { email: 'user@example.com' },
            template: {
              id: 'template-id',
              matchedAttributes: '{"name":"Test name"}',
            },
            extendedHeaders: [{ N: 'X-Test', V: 'value' }],
          },
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        Content: {
          Template: {
            TemplateName: 'template-id',
            TemplateData: '{"name":"Test name"}',
            Headers: [{ Name: 'X-Test', Value: 'value' }],
          },
        },
      }),
    );
  });
});

describe('dbMapper low priority utils', () => {
  it('maps low priority template items to the SES bulk send input', () => {
    const items = [
      makeEmailStatusHistoryItem({
        dryRun: true,
        content: {
          from: { email: 'sender@example.com', name: 'Sender Name' },
          to: { email: SES_SIMULATOR.SUCCESS },
          replyTo: { email: 'reply@example.com' },
          template: {
            id: 'template-id',
            matchedAttributes: '{"name":"Test name"}',
          },
          extendedHeaders: [{ N: 'X-First', V: '1' }],
        },
      }),
      makeEmailStatusHistoryItem({
        emailId: 'email-2',
        requestId: 'request-1',
        priority: EmailPriority.LOW,
        dryRun: true,
        content: {
          from: { email: 'sender@example.com', name: 'Sender Name' },
          to: { email: SES_SIMULATOR.BOUNCE },
          template: {
            id: 'template-id',
            matchedAttributes: '{"name":"Test second name"}',
          },
        },
      }),
    ];

    expect(mapDbLowPriorityItemToSesModel(items)).toEqual({
      FromEmailAddress: 'Sender Name <sender@example.com>',
      ReplyToAddresses: ['reply@example.com'],
      DefaultContent: {
        Template: {
          TemplateName: 'template-id',
          TemplateData: '{}',
        },
      },
      BulkEmailEntries: [
        {
          Destination: { ToAddresses: [SES_SIMULATOR.SUCCESS] },
          ReplacementEmailContent: {
            ReplacementTemplate: {
              ReplacementTemplateData: '{"name":"Test name"}',
            },
          },
          ReplacementHeaders: [{ Name: 'X-First', Value: '1' }],
        },
        {
          Destination: { ToAddresses: [SES_SIMULATOR.BOUNCE] },
          ReplacementEmailContent: {
            ReplacementTemplate: {
              ReplacementTemplateData: '{"name":"Test second name"}',
            },
          },
          ReplacementHeaders: undefined,
        },
      ],
    });
  });

  it('rejects low priority body content because bulk send requires templates', () => {
    expect(() =>
      mapDbLowPriorityItemToSesModel([
        makeEmailStatusHistoryItem({
          priority: EmailPriority.LOW,
          content: {
            from: { email: 'sender@example.com' },
            to: { email: 'user@example.com' },
            body: { html: '<p>Hello</p>' },
          },
        }),
      ]),
    ).toThrow(
      'SendBulkEmail only supports template-based content. Body content is not allowed.',
    );
  });

  it('rejects low priority batches when a later item is missing template content', () => {
    expect(() =>
      mapDbLowPriorityItemToSesModel([
        makeEmailStatusHistoryItem({
          priority: EmailPriority.LOW,
          content: {
            from: { email: 'sender@example.com' },
            to: { email: SES_SIMULATOR.SUCCESS },
            template: { id: 'template-id' },
          },
        }),
        makeEmailStatusHistoryItem({
          emailId: 'email-2',
          priority: EmailPriority.LOW,
          content: {
            from: { email: 'sender@example.com' },
            to: { email: SES_SIMULATOR.SUCCESS },
            body: { html: '<p>Hello</p>' },
          },
        }),
      ]),
    ).toThrow(
      'SendBulkEmail only supports template-based content. Body content is not allowed.',
    );
  });
});
