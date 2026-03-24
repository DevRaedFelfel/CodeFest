import { type Diagnostic } from '@codemirror/lint';
import {
  type LintContext,
  isInsideStringOrComment,
  quickFix,
  quickFixInsert,
  quickFixRemove,
  posOf,
} from '../diagnostic-helpers';

/**
 * Structural rules: bracket matching (CF001-CF007), semicolons (CF010-CF014),
 * and mismatched delimiters (CF020-CF022).
 */
export function structuralRules(ctx: LintContext): Diagnostic[] {
  return [
    ...checkUnmatchedBrackets(ctx),
    ...checkMissingSemicolons(ctx),
    ...checkDoubleSemicolons(ctx),
  ];
}

// ── Bracket Matching (CF001-CF007, CF020-CF022) ─────────────────────────

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const NAMES: Record<string, string> = {
  '{': 'brace', '}': 'brace',
  '(': 'parenthesis', ')': 'parenthesis',
  '[': 'bracket', ']': 'bracket',
};

function checkUnmatchedBrackets(ctx: LintContext): Diagnostic[] {
  const { code } = ctx;
  const diagnostics: Diagnostic[] = [];
  const stack: Array<{ char: string; pos: number }> = [];

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c !== '{' && c !== '}' && c !== '(' && c !== ')' && c !== '[' && c !== ']') continue;
    if (isInsideStringOrComment(code, i)) continue;

    if (PAIRS[c]) {
      stack.push({ char: c, pos: i });
    } else if (CLOSERS[c]) {
      if (stack.length > 0 && stack[stack.length - 1].char === CLOSERS[c]) {
        stack.pop();
      } else if (stack.length > 0 && stack[stack.length - 1].char !== CLOSERS[c]) {
        // Mismatched: CF020-CF022
        const opener = stack[stack.length - 1];
        const expected = PAIRS[opener.char];
        diagnostics.push({
          from: i,
          to: i + 1,
          severity: 'error',
          message: `Mismatched delimiters: opened with \`${opener.char}\` but closed with \`${c}\`. Did you mean \`${expected}\`?`,
          source: 'CodeFest [CF020]',
          actions: [quickFix(`Fix: \`${expected}\``, expected)],
        });
        stack.pop();
      } else {
        // Extra closer with no opener: CF002/CF004/CF006
        diagnostics.push({
          from: i,
          to: i + 1,
          severity: 'error',
          message: `Unexpected closing \`${c}\`. No matching opening ${NAMES[c]} found.`,
          source: `CodeFest [CF00${c === '}' ? '2' : c === ')' ? '4' : '6'}]`,
          actions: [quickFixRemove(`Remove \`${c}\``)],
        });
      }
    }
  }

  // Remaining unclosed openers: CF001/CF003/CF005
  for (const item of stack) {
    const closer = PAIRS[item.char];
    const lineNum = ctx.doc.lineAt(item.pos).number;
    diagnostics.push({
      from: item.pos,
      to: item.pos + 1,
      severity: 'error',
      message: `Opening ${NAMES[item.char]} \`${item.char}\` on line ${lineNum} has no matching closing \`${closer}\`.`,
      source: `CodeFest [CF00${item.char === '{' ? '1' : item.char === '(' ? '3' : '5'}]`,
      actions: [quickFixInsert(`Add \`${closer}\``, closer)],
    });
  }

  return diagnostics;
}

// ── Missing Semicolons (CF010-CF014) ─────────────────────────────────────

/** Keywords / patterns that start lines which don't need semicolons. */
const NO_SEMI_KEYWORDS = /^\s*(if|else|for|foreach|while|do|switch|try|catch|finally|class|struct|enum|interface|namespace|public|private|protected|internal|static|abstract|virtual|override|sealed|partial|async)\b/;
const NO_SEMI_ENDINGS = ['{', '}', ',', '(', '[', '=>', ':', '&&', '||', '+', '-', '*', '/'];
const CONTINUATION_STARTS = ['.', '?', ':', '&&', '||', '+', '-', '*', '/', '{', '??'];

function checkMissingSemicolons(ctx: LintContext): Diagnostic[] {
  const { lines } = ctx;
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.endsWith('*/')) continue;
    // Skip preprocessor directives
    if (trimmed.startsWith('#')) continue;
    // Skip attributes
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) continue;
    // Skip lines that are keywords/declarations
    if (NO_SEMI_KEYWORDS.test(trimmed)) continue;
    // Skip using/namespace declarations (they need ; but are handled differently)
    if (/^\s*using\s/.test(trimmed) && !trimmed.endsWith(';')) {
      diagnostics.push({
        from: posOf(ctx, i, line.length),
        to: posOf(ctx, i, line.length),
        severity: 'error',
        message: 'Missing semicolon `;` at end of `using` statement.',
        source: 'CodeFest [CF010]',
        actions: [quickFixInsert('Add `;`', ';')],
      });
      continue;
    }

    // Skip if line already ends with semicolon
    if (trimmed.endsWith(';')) continue;
    // Skip lines ending with characters that don't need semicolons
    if (NO_SEMI_ENDINGS.some(e => trimmed.endsWith(e))) continue;
    // Skip case/default labels
    if (/^\s*(case\s|default\s*:)/.test(trimmed)) continue;
    // Skip lines that end with comment
    if (/\/\/[^"]*$/.test(trimmed)) continue;

    // Check if line ends with `)` — likely a method call or statement needing ;
    // Also check lines ending with identifiers, literals, `++`, `--`, `]`
    const needsSemicolon = /(\)|"|\w|\+\+|--|])$/.test(trimmed);

    if (needsSemicolon) {
      // Check next non-empty line for continuation
      let nextTrimmed = '';
      for (let j = i + 1; j < lines.length; j++) {
        nextTrimmed = lines[j].trim();
        if (nextTrimmed.length > 0) break;
      }

      // If next line starts with a continuation operator, this is multi-line — skip
      const isContinuation = CONTINUATION_STARTS.some(s => nextTrimmed.startsWith(s));
      if (isContinuation) continue;

      // Additional check: if line looks like a method declaration (has `{` on next line), skip
      if (nextTrimmed === '{') continue;

      // Skip lines that are clearly method/class declarations (type + name + params)
      if (/\b(void|int|string|double|bool|char|decimal|long|float|short|byte|object|var|Task)\s+\w+\s*\(/.test(trimmed) && !trimmed.includes('=')) continue;

      diagnostics.push({
        from: posOf(ctx, i, line.length),
        to: posOf(ctx, i, line.length),
        severity: 'error',
        message: 'Missing semicolon `;` at end of statement.',
        source: 'CodeFest [CF010]',
        actions: [quickFixInsert('Add `;`', ';')],
      });
    }
  }

  return diagnostics;
}

// ── Double Semicolons (CF014) ────────────────────────────────────────────

function checkDoubleSemicolons(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    // Skip inside for() headers — ;; is valid there
    if (/\bfor\s*\(/.test(line)) continue;

    let idx = line.indexOf(';;');
    while (idx >= 0) {
      if (!isInsideStringOrComment(ctx.code, posOf(ctx, i, idx))) {
        diagnostics.push({
          from: posOf(ctx, i, idx),
          to: posOf(ctx, i, idx + 2),
          severity: 'warning',
          message: 'Double semicolon `;;`. Did you add an extra one?',
          source: 'CodeFest [CF014]',
          actions: [quickFix('Remove extra `;`', ';')],
        });
      }
      idx = line.indexOf(';;', idx + 2);
    }
  }

  return diagnostics;
}
