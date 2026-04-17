import {
  CapitalizedSesBounceSubType,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import z from 'zod';

// TODO: consider moving this schema and this type to a shared package on common package
const MailSchema = z.object({
  timestamp: z.string(),
  messageId: z.string(),
});

const BounceSchema = z.object({
  bounceType: z.enum(CapitalizedSesBounceType),
  bounceSubType: z.enum(CapitalizedSesBounceSubType).nullish(),
  feedbackId: z.string(),
  bouncedRecipients: z.array(
    z.object({
      emailAddress: z.string(), // string because could be name <email>
    }),
  ),
  timestamp: z.string(),
});

const ComplaintSchema = z.object({
  complainedRecipients: z.array(
    z.object({
      emailAddress: z.string(), // string because could be name <email>
    }),
  ),
  timestamp: z.string(),
  feedbackId: z.string(),
  complaintSubType: z.string().nullish(),
});

const DeliverySchema = z.object({
  timestamp: z.string(),
});

const RejectSchema = z.object({
  reason: z.string().nullable(),
});

const EventBaseSchema = z.object({
  mail: MailSchema,
});

export const EventTypeSchema = z.object({
  eventType: z.string(),
});

export const ConfSetEventItemSchema = z.discriminatedUnion('eventType', [
  EventBaseSchema.extend({
    eventType: z.literal(CapitalizedSesConfigurationSetEventType.Bounce),
    bounce: BounceSchema,
  }),
  EventBaseSchema.extend({
    eventType: z.literal(CapitalizedSesConfigurationSetEventType.Complaint),
    complaint: ComplaintSchema,
  }),
  EventBaseSchema.extend({
    eventType: z.literal(CapitalizedSesConfigurationSetEventType.Delivery),
    delivery: DeliverySchema,
  }),
  EventBaseSchema.extend({
    eventType: z.literal(CapitalizedSesConfigurationSetEventType.Reject),
    reject: RejectSchema,
  }),
]);

export type ConfSetEventItem = z.infer<typeof ConfSetEventItemSchema>;
