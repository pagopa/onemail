import {
  SanitizeHtmlSchema,
  SanitizeTemplateSchema,
} from '#dtos/email/validateHtml.dto';
import { describe, expect, it } from 'vitest';

describe('SanitizeTemplateSchema', () => {
  it('accepts up to 500000 characters without changing the raw HTML limit', () => {
    const htmlContent = 'a'.repeat(500000);
    expect(SanitizeTemplateSchema.parse({ htmlContent })).toEqual({
      htmlContent,
    });
    expect(SanitizeHtmlSchema.safeParse({ htmlContent }).success).toBe(false);
    expect(
      SanitizeTemplateSchema.safeParse({ htmlContent: `${htmlContent}a` })
        .success,
    ).toBe(false);
  });

  it.each([undefined, null, 123, ''])(
    'rejects missing, non-string or empty HTML: %s',
    (htmlContent) => {
      expect(SanitizeTemplateSchema.safeParse({ htmlContent }).success).toBe(
        false,
      );
    },
  );

  it.each([
    '<p>{{name}}</p>',
    '{{#if user}}{{#each items}}<p>{{this.name}}</p>{{/each}}{{/if}}',
    '<a href="https://example.com/{{user.id}}">Hello</a>',
  ])('preserves escaped placeholders and blocks: %s', (htmlContent) => {
    expect(SanitizeTemplateSchema.parse({ htmlContent })).toEqual({
      htmlContent,
    });
  });

  it.each([
    '<p>{{{name}}}</p>',
    '<p>{{& name}}</p>',
    '<p>{{ &name}}</p>',
    '<p>{{\n& name}}</p>',
  ])('passes unescaped placeholders to the service: %s', (htmlContent) => {
    expect(SanitizeTemplateSchema.parse({ htmlContent })).toEqual({
      htmlContent,
    });
  });
});
