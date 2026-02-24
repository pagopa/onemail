import z from 'zod';

export const sendEmailTransactionalBodySchema = z.object({
  to: z.email(),
  subject: z.string(),
  body: z.string(),
  replyTo: z.email().optional(),
});

export const sendEmailTransactionalBodySchemaQuery = z.object({
  test: z.string(),
});

export type SendEmailTransactionalBody = z.infer<
  typeof sendEmailTransactionalBodySchema
>;

export type SendEmailTransactionalQuery = z.infer<
  typeof sendEmailTransactionalBodySchemaQuery
>;

export type SendEmailTransactionalRes = {
  id: string;
};
