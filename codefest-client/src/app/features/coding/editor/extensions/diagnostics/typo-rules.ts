import { type Diagnostic } from '@codemirror/lint';
import { type LintContext, isInsideStringOrComment, posOf, quickFix } from '../diagnostic-helpers';
import {
  CLASS_NAME_TYPOS,
  METHOD_NAME_TYPOS,
  KEYWORD_CASING_TYPOS,
  MAIN_METHOD_TYPOS,
  type TypoEntry,
} from '../../data/common-typos';

/**
 * Typo & case-sensitivity rules (§4.3).
 * Data-driven: scans each line against the typo dictionaries.
 */
export function typoRules(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('//')) continue;

    // Run all typo categories
    checkTypos(ctx, i, line, CLASS_NAME_TYPOS, diagnostics);
    checkTypos(ctx, i, line, METHOD_NAME_TYPOS, diagnostics);
    checkTypos(ctx, i, line, KEYWORD_CASING_TYPOS, diagnostics);
    checkTypos(ctx, i, line, MAIN_METHOD_TYPOS, diagnostics);
  }

  return diagnostics;
}

function checkTypos(
  ctx: LintContext,
  lineIndex: number,
  line: string,
  entries: TypoEntry[],
  diagnostics: Diagnostic[],
): void {
  for (const entry of entries) {
    // Reset regex lastIndex for global patterns
    const regex = new RegExp(entry.pattern.source, entry.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const absPos = posOf(ctx, lineIndex, match.index);

      // Skip if inside a string literal or comment
      if (isInsideStringOrComment(ctx.code, absPos)) continue;

      // For info-severity type alias suggestions, skip if inside `using` statements
      if (entry.severity === 'info' && /\busing\b/.test(line)) continue;

      // For String -> string, skip if it's String.Method() (static call is fine)
      if (entry.correction === 'string' && /\bString\s*\./.test(line.slice(match.index))) continue;

      diagnostics.push({
        from: absPos,
        to: absPos + match[0].length,
        severity: entry.severity,
        message: entry.message,
        source: 'CodeFest [CF-TYPO]',
        actions: [quickFix(`Fix: \`${entry.correction}\``, entry.correction)],
      });
    }
  }
}
