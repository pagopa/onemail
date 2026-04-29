export interface PermanentEmailErrorContext {
  emailId?: string;
  requestId?: string;
  error?: string;
  emailRecord?: unknown;
}

export class PermanentEmailError extends Error {
  public readonly context: PermanentEmailErrorContext;

  constructor(message: string, context?: PermanentEmailErrorContext) {
    super(message);
    this.name = 'PermanentEmailError';
    this.context = context || {};
  }
}
