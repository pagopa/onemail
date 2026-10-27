import type { EmailHighPriorityBodyDTO } from '#dtos/email/emailHighPriority.dto';

import { isTemplatedEmail } from '#utils/emailTypeGuard';
import { describe, expect, it } from 'vitest';

import { makeHighPriorityEmailDto } from '../__helpers__/dtoFactories.js';

describe('isTemplatedEmail', () => {
  it('returns true for an email with template content', () => {
    const email: EmailHighPriorityBodyDTO = {
      from: { email: 'sender@example.com' },
      to: { email: 'user@example.com' },
      templateContent: { templateId: 'template-id' },
    };

    expect(isTemplatedEmail(email)).toBe(true);
  });

  it('returns false for an email with direct content', () => {
    expect(isTemplatedEmail(makeHighPriorityEmailDto())).toBe(false);
  });
});
