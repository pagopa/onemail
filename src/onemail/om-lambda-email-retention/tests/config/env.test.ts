import { parseEnv } from '#config/env';
import { describe, expect, it } from 'vitest';

const validEnv = {
  AWS_EMAIL_DB_TABLE: 'email-table',
  AWS_EMAIL_DB_REQUEST_ID_GSI: 'request-id-gsi',
  AWS_ATTACHMENTS_BUCKET: 'attachments-bucket',
  EMAIL_RETENTION_DAYS: '5',
};

describe('parseEnv', () => {
  it('returns the parsed configuration when all variables are valid', () => {
    expect(parseEnv(validEnv)).toEqual({
      aws: {
        emailDbTable: 'email-table',
        emailDbRequestIdGSI: 'request-id-gsi',
        attachmentsBucket: 'attachments-bucket',
      },
      emailRetentionDays: 5,
    });
  });

  it.each(Object.keys(validEnv))('throws when %s is blank', (name) => {
    expect(() => parseEnv({ ...validEnv, [name]: '  ' })).toThrow();
  });

  it.each(['0', '-1', '2.5', 'five'])(
    'throws when EMAIL_RETENTION_DAYS is %s',
    (value) => {
      expect(() =>
        parseEnv({ ...validEnv, EMAIL_RETENTION_DAYS: value }),
      ).toThrow();
    },
  );
});
