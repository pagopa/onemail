import { EmailPriority, EmailStatus } from 'om-common/types';
import { z } from 'zod';

const StringAttributeSchema = z.object({ S: z.string().min(1) });

const AttachmentAttributeSchema = z.object({
  M: z.object({ s3Key: StringAttributeSchema }),
});

// Subset of an EmailStatusHistory item as found in a DynamoDB stream image (DynamoDB JSON).
export const EmailStreamImageSchema = z.object({
  emailId: StringAttributeSchema,
  requestId: StringAttributeSchema,
  priority: z.object({ S: z.enum(EmailPriority) }),
  status: z.object({ S: z.enum(EmailStatus) }),
  content: z
    .object({
      M: z.object({
        attachments: z
          .object({ L: z.array(AttachmentAttributeSchema) })
          .optional(),
      }),
    })
    .optional(),
});

export type EmailStreamImage = z.infer<typeof EmailStreamImageSchema>;
