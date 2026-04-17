type EmailAddress = {
  email: string;
  name?: string;
};

const makeEmailAddress = (email: string, name?: string): EmailAddress => ({
  email,
  ...(name ? { name } : {}),
});

export const makeHighPriorityEmailDto = (
  overrides: Record<string, unknown> = {},
) => ({
  from: makeEmailAddress('sender@example.com', 'OneMail Sender'),
  to: makeEmailAddress('user@example.com', 'OneMail Recipient'),
  emailContent: {
    subject: 'Test subject',
    html: '<p>Hello from OneMail test content</p>',
  },
  ...overrides,
});

export const makeLowPriorityEmailDto = (
  overrides: Record<string, unknown> = {},
) => ({
  from: makeEmailAddress('sender@example.com', 'OneMail Sender'),
  templateId: 'template-id',
  sendingInfo: [
    {
      to: makeEmailAddress('user1@example.com', 'User One'),
      templateAttributes: {
        firstName: 'User',
      },
    },
  ],
  ...overrides,
});

export const makeTenantConfiguration = () => ({
  tenantName: 'tenant-a',
  configSetName: 'config-set-a',
  clientId: 'client-id-a',
});
