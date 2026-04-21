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

export enum CapitalizedSesConfigurationSetEventType {
  Bounce = 'Bounce',
  Complaint = 'Complaint',
  Delivery = 'Delivery',
  Reject = 'Reject',
  RenderingFailure = 'Rendering Failure',
}
