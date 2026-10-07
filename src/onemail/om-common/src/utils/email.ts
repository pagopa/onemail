import type { EmailAddress } from '../types/emailStatusHistory.js';

export const normalizeEmailAddress = (emailAddress: string): string =>
  emailAddress.trim().toLowerCase();

export const extractEmailAddress = (emailAddress: string): string => {
  const openingBracketIndex = emailAddress.lastIndexOf('<');
  const closingBracketIndex = emailAddress.indexOf('>', openingBracketIndex);
  const address =
    openingBracketIndex >= 0 && closingBracketIndex > openingBracketIndex
      ? emailAddress.slice(openingBracketIndex + 1, closingBracketIndex)
      : emailAddress;

  return normalizeEmailAddress(address);
};

function escapeEmailDisplayName(name: string): string {
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const hasSpecialChars = /[",;:<>@()[\]\\]/.test(name);
  const hasLeadingOrTrailingWhitespace = /^\s/.test(name) || /\s$/.test(name);
  const needsQuoting = hasSpecialChars || hasLeadingOrTrailingWhitespace;
  return needsQuoting ? `"${escaped}"` : escaped;
}

export const formatEmailAddress = (address: EmailAddress): string =>
  address.name
    ? `${escapeEmailDisplayName(address.name)} <${address.email}>`
    : address.email;
