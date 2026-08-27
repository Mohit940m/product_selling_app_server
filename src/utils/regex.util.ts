/**
 * Escapes regex metacharacters so a raw string can be safely embedded in a
 * `new RegExp(...)` call as a literal substring match.
 *
 * Without this, any user-supplied search/filter value containing a regex
 * metacharacter (`(`, `)`, `+`, `*`, `[`, `]`, `\`, `.`, `^`, `$`, `|`, `?`,
 * `{`, `}`) — plausible in ordinary product names like "Galaxy S23+" or
 * "iPhone (Pro)" — throws a SyntaxError when passed straight to `new
 * RegExp()`, which surfaces as a 500 for a completely normal search term.
 */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
