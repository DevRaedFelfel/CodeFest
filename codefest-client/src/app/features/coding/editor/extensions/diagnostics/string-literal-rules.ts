import { type Diagnostic } from '@codemirror/lint';
import { type LintContext, posOf, quickFixInsert } from '../diagnostic-helpers';

/**
 * String literal rules: unclosed strings (CF030-CF033),
 * and string interpolation errors (CF035-CF038, added in Phase 2).
 */
export function stringLiteralRules(ctx: LintContext): Diagnostic[] {
  return [
    ...checkUnterminatedStrings(ctx),
    ...checkUnterminatedCharLiterals(ctx),
    ...checkInterpolationErrors(ctx),
  ];
}

// ── Unterminated String Literals (CF030-CF031) ──────────────────────────

function checkUnterminatedStrings(ctx: LintContext): Diagnostic[] {
  const { lines } = ctx;
  const diagnostics: Diagnostic[] = [];
  let inVerbatim = false;
  let verbatimStartLine = 0;
  let verbatimStartCol = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith('//')) continue;

    // Handle multi-line verbatim strings
    if (inVerbatim) {
      // Look for closing " that isn't ""
      let j = 0;
      while (j < line.length) {
        if (line[j] === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') {
            j += 2; // skip escaped ""
          } else {
            inVerbatim = false;
            break;
          }
        } else {
          j++;
        }
      }
      continue;
    }

    // Scan line for string issues
    let inString = false;
    let stringStart = -1;
    let inLineComment = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const next = j + 1 < line.length ? line[j + 1] : '';
      const prev = j > 0 ? line[j - 1] : '';

      // Line comment
      if (!inString && c === '/' && next === '/') {
        inLineComment = true;
        break;
      }

      if (inLineComment) break;

      // Verbatim string start
      if (!inString && (c === '@' || (c === '$' && next === '@')) && line.indexOf('"', c === '$' ? j + 2 : j + 1) === (c === '$' ? j + 2 : j + 1)) {
        const quotePos = c === '$' ? j + 2 : j + 1;
        // Check if verbatim string closes on this line
        let closed = false;
        let k = quotePos + 1;
        while (k < line.length) {
          if (line[k] === '"') {
            if (k + 1 < line.length && line[k + 1] === '"') {
              k += 2;
            } else {
              closed = true;
              j = k;
              break;
            }
          } else {
            k++;
          }
        }
        if (!closed) {
          inVerbatim = true;
          verbatimStartLine = i;
          verbatimStartCol = j;
        }
        continue;
      }

      // Regular or interpolated string
      if (!inString && c === '"' && prev !== '\\' && prev !== '@') {
        inString = true;
        stringStart = j;
        continue;
      }

      if (inString && c === '"' && prev !== '\\') {
        inString = false;
        stringStart = -1;
        continue;
      }

      // Handle escaped characters in string
      if (inString && c === '\\') {
        j++; // skip next char
        continue;
      }
    }

    // If we ended the line still inside a string, it's unterminated
    if (inString && stringStart >= 0) {
      diagnostics.push({
        from: posOf(ctx, i, stringStart),
        to: posOf(ctx, i, line.length),
        severity: 'error',
        message: 'Unterminated string literal. Missing closing `"`.',
        source: 'CodeFest [CF030]',
        actions: [quickFixInsert('Add `"`', '"')],
      });
    }
  }

  // If we ended the file still in a verbatim string
  if (inVerbatim) {
    diagnostics.push({
      from: posOf(ctx, verbatimStartLine, verbatimStartCol),
      to: posOf(ctx, verbatimStartLine, ctx.lines[verbatimStartLine].length),
      severity: 'error',
      message: 'Unterminated verbatim string. Close it with `"`.',
      source: 'CodeFest [CF031]',
      actions: [quickFixInsert('Add `"`', '"')],
    });
  }

  return diagnostics;
}

// ── Unterminated Char Literals (CF032-CF033) ─────────────────────────────

function checkUnterminatedCharLiterals(ctx: LintContext): Diagnostic[] {
  const { lines, code } = ctx;
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Quick pre-filter: skip lines without single quotes
    if (!line.includes("'")) continue;
    if (line.trim().startsWith('//')) continue;

    // Find char literal patterns
    const charRegex = /'([^'\\]|\\.)*'/g;
    const emptyCharRegex = /''/g;

    // Check for empty char literal ''
    let emptyMatch: RegExpExecArray | null;
    emptyCharRegex.lastIndex = 0;
    while ((emptyMatch = emptyCharRegex.exec(line)) !== null) {
      const absPos = posOf(ctx, i, emptyMatch.index);
      if (!isInStringOrComment(code, absPos)) {
        diagnostics.push({
          from: absPos,
          to: absPos + 2,
          severity: 'error',
          message: "Empty character literal. A `char` must contain exactly one character, e.g., `'A'`.",
          source: 'CodeFest [CF033]',
        });
      }
    }

    // Check for unterminated char literals (single ' without closing)
    let inStr = false;
    let inCh = false;
    let chStart = -1;
    let inComment = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const next = j + 1 < line.length ? line[j + 1] : '';
      const prev = j > 0 ? line[j - 1] : '';

      if (c === '/' && next === '/') { inComment = true; break; }
      if (inComment) break;

      if (!inCh && c === '"' && prev !== '\\') { inStr = !inStr; continue; }
      if (inStr) continue;

      if (!inCh && c === "'") {
        inCh = true;
        chStart = j;
        continue;
      }
      if (inCh) {
        if (c === "'" && prev !== '\\') {
          inCh = false;
          chStart = -1;
        } else if (c === '\\') {
          j++; // skip escaped char
        }
      }
    }

    // If line ended with an open char literal
    if (inCh && chStart >= 0) {
      diagnostics.push({
        from: posOf(ctx, i, chStart),
        to: posOf(ctx, i, line.length),
        severity: 'error',
        message: 'Unterminated or invalid character literal.',
        source: 'CodeFest [CF032]',
        actions: [quickFixInsert("Add `'`", "'")],
      });
    }
  }

  return diagnostics;
}

/** Lightweight check for absolute position in string/comment (for char literal checks). */
function isInStringOrComment(code: string, pos: number): boolean {
  let inStr = false;
  let inComment = false;
  let inBlock = false;

  for (let i = 0; i < pos && i < code.length; i++) {
    const c = code[i];
    const next = code[i + 1];
    const prev = i > 0 ? code[i - 1] : '';

    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; i++; } continue; }
    if (inComment) { if (c === '\n') inComment = false; continue; }
    if (inStr) { if (c === '"' && prev !== '\\') inStr = false; continue; }

    if (c === '/' && next === '/') { inComment = true; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    if (c === '"') { inStr = true; continue; }
  }

  return inStr || inComment || inBlock;
}

// ── String Interpolation Errors (CF035-CF038) — Phase 2 ─────────────────

function checkInterpolationErrors(ctx: LintContext): Diagnostic[] {
  const { lines } = ctx;
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;

    // CF035: {variable} in non-interpolated string (missing $ prefix)
    // Look for "...{word}..." where the string doesn't start with $
    const nonInterpRegex = /(?<!\$)"([^"]*\{[a-zA-Z_]\w*\}[^"]*)"/g;
    let match: RegExpExecArray | null;
    nonInterpRegex.lastIndex = 0;
    while ((match = nonInterpRegex.exec(line)) !== null) {
      const absPos = posOf(ctx, i, match.index);
      // Make sure the character before the " is not @ (verbatim) or $ (interpolated)
      const charBefore = match.index > 0 ? line[match.index - 1] : '';
      if (charBefore === '$' || charBefore === '@') continue;

      diagnostics.push({
        from: absPos,
        to: absPos + match[0].length,
        severity: 'warning',
        message: 'This looks like string interpolation, but the string is missing the `$` prefix.',
        source: 'CodeFest [CF035]',
        actions: [{
          name: 'Add `$` prefix',
          apply(view, from) {
            view.dispatch({ changes: { from, to: from, insert: '$' } });
          },
        }],
      });
    }

    // CF037: Empty {} in interpolated string
    const emptyBraceRegex = /\$"[^"]*\{\}[^"]*"/g;
    emptyBraceRegex.lastIndex = 0;
    while ((match = emptyBraceRegex.exec(line)) !== null) {
      const braceIdx = line.indexOf('{}', match.index);
      if (braceIdx >= 0) {
        diagnostics.push({
          from: posOf(ctx, i, braceIdx),
          to: posOf(ctx, i, braceIdx + 2),
          severity: 'warning',
          message: 'Empty expression `{}` in interpolated string. Put an expression inside, e.g., `{name}`.',
          source: 'CodeFest [CF037]',
        });
      }
    }
  }

  return diagnostics;
}
