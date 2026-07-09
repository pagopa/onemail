import {
  hasMeaningfulHtmlSanitizationChange,
  sanitizeEmailHtml,
} from '#utils/htmlSanitizer';
import { describe, expect, it } from 'vitest';

describe('sanitizeEmailHtml', () => {
  it('keeps allowed tags intact', () => {
    expect(sanitizeEmailHtml('<p>Hello <strong>World</strong></p>')).toBe(
      '<p>Hello <strong>World</strong></p>',
    );
  });

  it('removes script tags', () => {
    expect(sanitizeEmailHtml('<p>Hi</p><script>alert(1)</script>')).toBe(
      '<p>Hi</p>',
    );
  });

  it('removes disallowed attributes', () => {
    expect(sanitizeEmailHtml('<p onclick="evil()">Click</p>')).toBe(
      '<p>Click</p>',
    );
  });

  it('strips data: URIs from img src', () => {
    expect(
      sanitizeEmailHtml('<img src="data:image/png;base64,AAAA" alt="x"/>'),
    ).toBe('<img alt="x" />');
  });

  it('keeps allowed img attributes', () => {
    expect(
      sanitizeEmailHtml(
        '<img src="https://example.com/img.png" alt="x" width="100" height="50"/>',
      ),
    ).toBe(
      '<img src="https://example.com/img.png" alt="x" width="100" height="50" />',
    );
  });

  it('keeps inline styles', () => {
    expect(sanitizeEmailHtml('<p style="color:red">Styled</p>')).toBe(
      '<p style="color:red">Styled</p>',
    );
  });
});

describe('hasMeaningfulHtmlSanitizationChange', () => {
  it('returns false for identical input and sanitized output', () => {
    const html = '<p>Hello</p>';
    expect(hasMeaningfulHtmlSanitizationChange(html, html)).toBe(false);
  });

  it('returns false when only whitespace between tags differs (no false positive)', () => {
    const original = '<p>Hello</p>  <p>World</p>';
    const sanitized = '<p>Hello</p><p>World</p>';
    expect(hasMeaningfulHtmlSanitizationChange(original, sanitized)).toBe(
      false,
    );
  });

  it('returns false when tag casing differs (no false positive)', () => {
    const original = '<P>Hello</P>';
    const sanitized = '<p>Hello</p>';
    expect(hasMeaningfulHtmlSanitizationChange(original, sanitized)).toBe(
      false,
    );
  });

  it('returns true when a tag is removed', () => {
    const original = '<p>Hello</p><script>alert(1)</script>';
    const sanitized = '<p>Hello</p>';
    expect(hasMeaningfulHtmlSanitizationChange(original, sanitized)).toBe(true);
  });

  it('returns true when an attribute is removed', () => {
    const original = '<p onclick="evil()">Click</p>';
    const sanitized = '<p>Click</p>';
    expect(hasMeaningfulHtmlSanitizationChange(original, sanitized)).toBe(true);
  });

  it('returns true when content is fully stripped', () => {
    const original = '<script>alert(1)</script>';
    const sanitized = '';
    expect(hasMeaningfulHtmlSanitizationChange(original, sanitized)).toBe(true);
  });
});
