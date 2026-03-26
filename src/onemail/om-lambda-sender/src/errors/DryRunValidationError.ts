export class DryRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DryRunValidationError';
  }
}
