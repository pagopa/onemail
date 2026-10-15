import { z } from 'zod';

const EnvSchema = z.object({
  AWS_EMAIL_DB_TABLE: z.string().trim().min(1),
  AWS_EMAIL_DB_REQUEST_ID_GSI: z.string().trim().min(1),
  AWS_ATTACHMENTS_BUCKET: z.string().trim().min(1),
  EMAIL_RETENTION_DAYS: z.coerce.number().int().positive(),
});

export const parseEnv = (source: NodeJS.ProcessEnv) => {
  const parsed = EnvSchema.parse(source);

  return {
    aws: {
      emailDbTable: parsed.AWS_EMAIL_DB_TABLE,
      emailDbRequestIdGSI: parsed.AWS_EMAIL_DB_REQUEST_ID_GSI,
      attachmentsBucket: parsed.AWS_ATTACHMENTS_BUCKET,
    },
    emailRetentionDays: parsed.EMAIL_RETENTION_DAYS,
  };
};

export default parseEnv(process.env);
