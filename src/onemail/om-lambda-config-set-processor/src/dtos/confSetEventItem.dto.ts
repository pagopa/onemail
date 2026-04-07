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
  bounceSubType: z.enum(CapitalizedSesBounceSubType),
  feedbackId: z.string(),
  bouncedRecipients: z.array(
    z.object({
      emailAddress: z.email(),
    }),
  ),
  timestamp: z.string(),
});

const ComplaintSchema = z.object({
  complainedRecipients: z.array(
    z.object({
      emailAddress: z.email(),
    }),
  ),
  timestamp: z.string(),
  feedbackId: z.string(),
  complaintSubType: z.string(),
});

const DeliverySchema = z.object({
  timestamp: z.string(),
});

const RejectSchema = z.object({
  reason: z.string(),
});

const EventDetailSchema = z.object({});

const EventBaseSchema = z.object({
  mail: MailSchema,
});

const HandledConfSetEventItemSchema = z.discriminatedUnion('eventType', [
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
    eventType: z.literal(CapitalizedSesConfigurationSetEventType.Send),
    send: EventDetailSchema,
  }),
  EventBaseSchema.extend({
    eventType: z.literal(CapitalizedSesConfigurationSetEventType.Reject),
    reject: RejectSchema,
  }),
]);

const UnhandledConfSetEventItemSchema = z.object({
  eventType: z.string(),
});

export const ConfSetEventItemSchema = z.union([
  HandledConfSetEventItemSchema,
  UnhandledConfSetEventItemSchema,
]);

export type ConfSetEventItem = z.infer<typeof ConfSetEventItemSchema>;
export type HandledConfSetEventItem = z.infer<
  typeof HandledConfSetEventItemSchema
>;
