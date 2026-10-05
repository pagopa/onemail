import {
  matchesRecipientDomain,
  parseDomainPatterns,
} from '#config/domainPatterns';
import { describe, expect, it } from 'vitest';

describe('parseDomainPatterns', () => {
  it('normalizes case and whitespace in comma-separated patterns', () => {
    expect(
      parseDomainPatterns(
        'EXCLUDED_DOMAINS',
        ' PEC.* , *.Test , LegalMail.IT ',
      ),
    ).toEqual(['pec.*', '*.test', 'legalmail.it']);
  });

  it('returns an empty list for an unset or empty value', () => {
    expect(parseDomainPatterns('EXCLUDED_DOMAINS', undefined)).toEqual([]);
    expect(parseDomainPatterns('EXCLUDED_DOMAINS', '  ')).toEqual([]);
  });

  it('rejects empty list entries and arbitrary regular expressions', () => {
    expect(() => parseDomainPatterns('EXCLUDED_DOMAINS', 'pec.*,')).toThrow(
      'Invalid EXCLUDED_DOMAINS',
    );
    expect(() =>
      parseDomainPatterns('EXCLUDED_DOMAINS', '.*@example.com'),
    ).toThrow('Invalid EXCLUDED_DOMAINS');
    expect(() => parseDomainPatterns('EXCLUDED_DOMAINS', '*.test.*')).toThrow(
      'Invalid EXCLUDED_DOMAINS',
    );
  });
});

describe('matchesRecipientDomain', () => {
  it('matches a suffix wildcard without matching its bare prefix', () => {
    expect(matchesRecipientDomain('user@pec.it', ['pec.*'])).toBe(true);
    expect(matchesRecipientDomain('user@pec.net', ['pec.*'])).toBe(true);
    expect(matchesRecipientDomain('user@pec', ['pec.*'])).toBe(false);
  });

  it('matches a leading wildcard by suffix without matching test.it', () => {
    expect(matchesRecipientDomain('user@foo.test', ['*.test'])).toBe(true);
    expect(matchesRecipientDomain('user@sub.foo.test', ['*.test'])).toBe(true);
    expect(matchesRecipientDomain('user@test.it', ['*.test'])).toBe(false);
    expect(matchesRecipientDomain('user@test', ['*.test'])).toBe(false);
  });

  it('matches exact domains case-insensitively', () => {
    expect(matchesRecipientDomain('user@LEGALMAIL.IT', ['legalmail.it'])).toBe(
      true,
    );
    expect(
      matchesRecipientDomain('user@mail.legalmail.it', ['legalmail.it']),
    ).toBe(false);
  });

  it('does not match domains that only contain a configured pattern', () => {
    expect(matchesRecipientDomain('user@notpec.it', ['pec.*'])).toBe(false);
  });
});
