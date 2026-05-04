export interface PermanentEventErrorContext {
  emailId?: string;
  requestId?: string;
  providerMessageId?: string;
  error?: string;
  record?: unknown;
  // When true, the catch handler should skips log for this error
  silent?: boolean;
}

export class PermanentEventError extends Error {
  public readonly context: PermanentEventErrorContext;

  constructor(message: string, context?: PermanentEventErrorContext) {
    super(message);
    this.name = 'PermanentEventError';
    this.context = context || {};
  }
}
