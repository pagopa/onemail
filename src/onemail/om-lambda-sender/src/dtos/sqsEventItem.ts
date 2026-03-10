import z from 'zod';

// TODO: consider moving this schema and this type to a shared package on common package
export const SqsEventItemHighSchema = z.object({
  emailId: z.string().trim().min(1),
});
export const SqsEventItemLowSchema = z.object({
  requestId: z.string().trim().min(1),
});

export type SqsEventItemHigh = z.infer<typeof SqsEventItemHighSchema>;
export type SqsEventItemLow = z.infer<typeof SqsEventItemLowSchema>;
