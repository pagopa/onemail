import { z } from 'zod';

const domainPatternSchema = z
  .string()
  .regex(
    /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?))*(?:\.\*)?$/,
  )
  .refine((pattern) => !(pattern.startsWith('*.') && pattern.endsWith('.*')));

export const parseDomainPatterns = (
  variableName: string,
  value: string | undefined,
): string[] => {
  if (!value?.trim()) return [];

  const result = z
    .array(domainPatternSchema)
    .safeParse(value.split(',').map((pattern) => pattern.trim().toLowerCase()));
  if (!result.success) {
    throw new Error(
      `Invalid ${variableName}: expected comma-separated domains or single-sided wildcards such as "pec.*" or "*.test"`,
    );
  }

  return result.data;
};

export const matchesRecipientDomain = (
  email: string,
  domainPatterns: string[],
): boolean => {
  const domain = email.split('@').at(-1)?.trim().toLowerCase();
  if (!domain) return false;

  return domainPatterns.some((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase();
    if (normalizedPattern.startsWith('*.'))
      return domain.endsWith(normalizedPattern.slice(1));
    if (normalizedPattern.endsWith('.*'))
      return domain.startsWith(normalizedPattern.slice(0, -1));
    return domain === normalizedPattern;
  });
};
