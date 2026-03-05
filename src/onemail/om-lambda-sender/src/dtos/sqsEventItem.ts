import z from 'zod';

// TODO: consider moving this schema and this type to a shared package on common package
export const SqsEventItemSchema = z.object({
  emailId: z.string().trim().min(1),
});

export type SqsEventItem = z.infer<typeof SqsEventItemSchema>;
