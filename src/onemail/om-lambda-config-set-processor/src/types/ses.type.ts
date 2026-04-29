export enum CapitalizedSesBounceSubType {
  Undetermined = 'Undetermined',
  General = 'General',
  NoEmail = 'NoEmail',
  Suppressed = 'Suppressed',
  OnAccountSuppressionList = 'OnAccountSuppressionList',
  MailboxFull = 'MailboxFull',
  MessageTooLarge = 'MessageTooLarge',
  CustomTimeoutExceeded = 'CustomTimeoutExceeded',
  ContentRejected = 'ContentRejected',
  AttachmentRejected = 'AttachmentRejected',
}
export enum CapitalizedSesBounceType {
  Undetermined = 'Undetermined',
  Permanent = 'Permanent',
  Transient = 'Transient',
}

/** Transient sub-types that are non-retryable and treated as hard bounces */
export const CapitalizedNonRetryableTransientSubTypes =
  new Set<CapitalizedSesBounceSubType>([
    CapitalizedSesBounceSubType.AttachmentRejected,
    CapitalizedSesBounceSubType.ContentRejected,
    CapitalizedSesBounceSubType.MessageTooLarge,
  ]);

export enum CapitalizedSesConfigurationSetEventType {
  Bounce = 'Bounce',
  Complaint = 'Complaint',
  Delivery = 'Delivery',
  Reject = 'Reject',
  RenderingFailure = 'Rendering Failure',
}
