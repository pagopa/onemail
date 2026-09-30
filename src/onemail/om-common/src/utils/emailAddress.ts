/** Canonical form used as the blacklist partition key. */
export const normalizeEmailAddress = (emailAddress: string): string =>
  emailAddress.trim().toLowerCase();

/** Masks the local part so an address can be logged without exposing PII. */
export const maskEmailAddress = (emailAddress: string): string => {
  const normalized = normalizeEmailAddress(emailAddress);
  const separatorIndex = normalized.lastIndexOf('@');

  if (separatorIndex <= 0) {
    return '***';
  }

  const domain = normalized.slice(separatorIndex + 1);
  if (domain.length === 0) {
    return '***';
  }

  return `${normalized[0]}***@${domain}`;
};
