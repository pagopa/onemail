import { cleanCssAst, cleanInlineCss } from '#utils/cssSanitizer';
import { describe, expect, it } from 'vitest';

describe('cleanCssAst', () => {
  it('preserves safe email CSS', () => {
    const css = `
@media screen and (max-width: 600px) {
  .hero { color: red !important; width: calc(100% - 20px); }
}
.outlook { mso-line-height-rule: exactly; }
`;

    expect(cleanCssAst(css)).toBe(css);
  });

  it('preserves regular URLs and HTTPS imports', () => {
    const css = `@import url("https://cdn.example.com/email.css");
.hero { background-image: url("https://cdn.example.com/image.png"); }`;

    expect(cleanCssAst(css)).toBe(css);
  });

  it('removes blocked properties and values', () => {
    const result = cleanCssAst(
      '.hero { color: red; behavior: url(x.htc); -moz-binding: url(x.xml); width: expression(alert(1)); background: url("javascript:alert(1)"); }',
    );

    expect(result).toContain('color: red');
    expect(result).not.toContain('behavior');
    expect(result).not.toContain('-moz-binding');
    expect(result).not.toContain('expression');
    expect(result).not.toContain('javascript:');
  });

  it('removes blocked imports', () => {
    const result = cleanCssAst(
      '@import "javascript:alert(1)"; @import url("vbscript:msgbox(1)"); .hero { color: red; }',
    );

    expect(result).not.toContain('@import');
    expect(result).toContain('.hero { color: red; }');
  });

  it('removes non-HTTPS CSS URLs', () => {
    const result = cleanCssAst(
      '.hero { color: red; background-image: url("http://cdn.example.com/image.png"); }',
    );

    expect(result).toContain('color: red');
    expect(result).not.toContain('background-image');
    expect(result).not.toContain('http://');
  });

  it('returns a safe comment for malformed CSS', () => {
    expect(cleanCssAst('.hero { color: red;')).toBe(
      '/* stripped invalid css */',
    );
  });
});

describe('cleanInlineCss', () => {
  it('preserves safe inline declarations', () => {
    expect(cleanInlineCss('color: red; width: 100%;')).toBe(
      'color: red; width: 100%;',
    );
  });

  it('removes unsafe inline declarations', () => {
    expect(
      cleanInlineCss('color: red; background: url("javascript:alert(1)");'),
    ).toBe('color: red;');
  });

  it('returns a safe comment for malformed inline CSS', () => {
    expect(cleanInlineCss('color: "red;')).toBe('/* stripped invalid css */');
  });
});
