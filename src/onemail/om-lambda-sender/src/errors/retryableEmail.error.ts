export interface RetryableEmailContext {
  emailId?: string;
  requestId?: string;
}

export class RetryableEmailError extends Error {
  public readonly context: RetryableEmailContext;

  constructor(
    message: string,
    context: RetryableEmailContext,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'RetryableEmailError';
    this.context = context;
  }
}
