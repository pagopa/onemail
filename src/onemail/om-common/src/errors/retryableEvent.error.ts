export interface RetryableEventErrorContext {
  emailId?: string;
  requestId?: string;
  providerMessageId?: string;
  attempt?: number;
}

export class RetryableEventError extends Error {
  public readonly context: RetryableEventErrorContext;

  constructor(
    message: string,
    context: RetryableEventErrorContext,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'RetryableEventError';
    this.context = context;
  }
}
