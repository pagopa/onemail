import postcss from 'postcss';

const BLOCKED_PROPERTIES = new Set(['-moz-binding', 'behavior']);
const BLOCKED_VALUES = ['expression'];

const hasUnsafeCssUrl = (value: string): boolean => {
  // Find every url(...) token
  const urlMatches = value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi);

  for (const match of urlMatches) {
    const urlValue = match[2] ?? '';

    const normalizedUrlValue = urlValue
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .toLowerCase();

    if (!normalizedUrlValue.startsWith('https://')) {
      return true;
    }
  }

  return false;
};

const hasUnsafeCssImport = (value: string): boolean => {
  const parameters = value.trim();

  if (parameters.toLowerCase().startsWith('url(')) {
    return hasUnsafeCssUrl(parameters);
  }

  // Extract first @import parameter, quoted or unquoted
  const importUrl = parameters.match(/^(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const normalizedUrl = (
    importUrl?.[1] ?? // @import "https://example.com/style.css"; - double quoted
    importUrl?.[2] ?? // @import 'https://example.com/style.css'; - single quoted
    importUrl?.[3] ?? // @import  https://example.com/style.css; - unquoted
    ''
  )
    .trim()
    .toLowerCase();

  return !normalizedUrl.startsWith('https://');
};

export const cleanCssAst = (css: string): string => {
  try {
    const root = postcss.parse(css, { from: undefined });

    // Remove unsafe declarations (prop: value)
    root.walkDecls((declaration) => {
      const property = declaration.prop.toLowerCase();
      const value = declaration.value.toLowerCase();
      const hasBlockedProperties = BLOCKED_PROPERTIES.has(property);
      const hasBlockedValue = BLOCKED_VALUES.some((blockedValue) =>
        value.includes(blockedValue),
      );
      const hasUnsafeUrl = hasUnsafeCssUrl(declaration.value);

      if (hasBlockedProperties || hasBlockedValue || hasUnsafeUrl) {
        declaration.remove();
      }
    });

    // Remove unsafe @import rules
    root.walkAtRules('import', (rule) => {
      const parameters = rule.params.toLowerCase();
      const hasBlockedValue = BLOCKED_VALUES.some((blockedValue) =>
        parameters.includes(blockedValue),
      );
      const hasUnsafeUrl = hasUnsafeCssImport(rule.params);

      if (hasBlockedValue || hasUnsafeUrl) {
        rule.remove();
      }
    });

    return root.toString();
  } catch {
    return '/* stripped invalid css */';
  }
};

export const cleanInlineCss = (css: string): string => {
  // PostCSS needs a CSS rule for parsing inline styles
  const wrappedCss = `.inline-wrapper { ${css} }`;
  const safeWrappedCss = cleanCssAst(wrappedCss);

  return safeWrappedCss
    .replace(/^\.inline-wrapper\s*\{\s*/, '')
    .replace(/\s*\}\s*$/, '')
    .trim();
};
