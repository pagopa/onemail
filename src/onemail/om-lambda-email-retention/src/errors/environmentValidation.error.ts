import { $ZodIssue } from 'zod/v4/core';

export class EnvironmentValidationError extends Error {
  public readonly issues: readonly $ZodIssue[];

  public constructor(issues: readonly $ZodIssue[]) {
    const details = issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    super(`Invalid environment variables:\n${details}`);
    this.name = 'EnvironmentValidationError';
    this.issues = issues;
  }
}
