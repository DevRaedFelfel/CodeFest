import { type Diagnostic } from '@codemirror/lint';
import {
  type LintContext,
  isInsideStringOrComment,
  posOf,
  quickFix,
  quickFixInsert,
  quickFixRemove,
} from '../diagnostic-helpers';

/**
 * Method call rules (§4.6).
 * CF160-CF167: Missing/extra parentheses on methods vs properties.
 * CF170-CF176: Wrong argument count for known methods.
 */
export function methodRules(ctx: LintContext): Diagnostic[] {
  return [
    ...checkMissingParens(ctx),
    ...checkPropertyAsMethod(ctx),
    ...checkWrongArgCount(ctx),
  ];
}

// ── Known methods that REQUIRE () ────────────────────────────────────────

const KNOWN_METHODS_NO_PARENS: Array<{ pattern: RegExp; fullName: string; rule: string }> = [
  { pattern: /\bConsole\.(ReadLine|WriteLine|Write|Clear|ReadKey|Read|ResetColor|Beep)\s*;/g, fullName: 'Console.', rule: 'CF160' },
  { pattern: /\.(?:Add|Remove|RemoveAt|Insert|Clear|Sort|Reverse|Contains|IndexOf|Find|FindAll|ForEach|AddRange|ToList|ToArray|ToString|ToUpper|ToLower|Trim|TrimStart|TrimEnd|Split|Replace|Substring|StartsWith|EndsWith|CompareTo|Equals|CopyTo|GetType|Parse|TryParse)\s*;/g, fullName: '.', rule: 'CF162' },
];

function checkMissingParens(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    for (const { pattern, rule } of KNOWN_METHODS_NO_PARENS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const absPos = posOf(ctx, i, match.index);
        if (isInsideStringOrComment(ctx.code, absPos)) continue;

        // Extract method name from match
        const methodName = match[0].replace(';', '').trim();
        diagnostics.push({
          from: absPos,
          to: absPos + match[0].length - 1, // exclude ;
          severity: 'error',
          message: `Did you mean \`${methodName}()\`? Methods need parentheses \`()\` to be called.`,
          source: `CodeFest [${rule}]`,
          actions: [quickFix(`Fix: \`${methodName}()\``, `${methodName}()`)],
        });
      }
    }
  }

  return diagnostics;
}

// ── Properties used as methods (CF165-CF167) ─────────────────────────────

const PROPERTY_AS_METHOD: Array<{ pattern: RegExp; property: string }> = [
  { pattern: /\.Count\s*\(\s*\)/g, property: 'Count' },
  { pattern: /\.Length\s*\(\s*\)/g, property: 'Length' },
];

function checkPropertyAsMethod(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    for (const { pattern, property } of PROPERTY_AS_METHOD) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const absPos = posOf(ctx, i, match.index);
        if (isInsideStringOrComment(ctx.code, absPos)) continue;

        // Find just the () part to remove
        const parenStart = match[0].indexOf('(');
        diagnostics.push({
          from: absPos,
          to: absPos + match[0].length,
          severity: 'warning',
          message: `\`${property}\` is a property, not a method. Remove the parentheses: use \`.${property}\` instead of \`.${property}()\`.`,
          source: 'CodeFest [CF165]',
          actions: [quickFix(`Fix: \`.${property}\``, `.${property}`)],
        });
      }
    }
  }

  return diagnostics;
}

// ── Wrong argument count (CF170-CF176) ───────────────────────────────────

interface ArgCountRule {
  pattern: RegExp;
  minArgs: number;
  maxArgs: number;
  methodName: string;
  message: string;
  rule: string;
}

const ARG_COUNT_RULES: ArgCountRule[] = [
  {
    pattern: /\bMath\.Pow\s*\(/g,
    minArgs: 2, maxArgs: 2,
    methodName: 'Math.Pow',
    message: '`Math.Pow()` requires 2 arguments: `Math.Pow(base, exponent)`.',
    rule: 'CF171',
  },
  {
    pattern: /\bMath\.Sqrt\s*\(/g,
    minArgs: 1, maxArgs: 1,
    methodName: 'Math.Sqrt',
    message: '`Math.Sqrt()` requires 1 argument.',
    rule: 'CF172',
  },
  {
    pattern: /\bMath\.Max\s*\(/g,
    minArgs: 2, maxArgs: 2,
    methodName: 'Math.Max',
    message: '`Math.Max()` takes exactly 2 arguments. For 3+ values, nest calls: `Math.Max(Math.Max(1, 2), 3)`.',
    rule: 'CF173',
  },
  {
    pattern: /\bMath\.Min\s*\(/g,
    minArgs: 2, maxArgs: 2,
    methodName: 'Math.Min',
    message: '`Math.Min()` takes exactly 2 arguments.',
    rule: 'CF173',
  },
  {
    pattern: /\bConsole\.ReadLine\s*\(/g,
    minArgs: 0, maxArgs: 0,
    methodName: 'Console.ReadLine',
    message: '`Console.ReadLine()` takes no arguments. To show a prompt first, use `Console.Write("prompt")` on the previous line.',
    rule: 'CF174',
  },
  {
    pattern: /\bConvert\.ToInt32\s*\(/g,
    minArgs: 1, maxArgs: 1,
    methodName: 'Convert.ToInt32',
    message: '`Convert.ToInt32()` requires an argument.',
    rule: 'CF157',
  },
  {
    pattern: /\bConvert\.ToDouble\s*\(/g,
    minArgs: 1, maxArgs: 1,
    methodName: 'Convert.ToDouble',
    message: '`Convert.ToDouble()` requires an argument.',
    rule: 'CF157',
  },
];

function checkWrongArgCount(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    for (const rule of ARG_COUNT_RULES) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const absPos = posOf(ctx, i, match.index);
        if (isInsideStringOrComment(ctx.code, absPos)) continue;

        // Find the opening ( position in the line
        const parenStart = match.index + match[0].length - 1;
        const argCount = countArgs(line, parenStart);
        if (argCount === null) continue; // couldn't parse args

        let shouldFlag = false;
        let message = rule.message;

        if (argCount < rule.minArgs) {
          shouldFlag = true;
        } else if (argCount > rule.maxArgs) {
          shouldFlag = true;
        }

        if (shouldFlag) {
          diagnostics.push({
            from: absPos,
            to: absPos + match[0].length,
            severity: argCount < rule.minArgs ? 'error' : 'warning',
            message,
            source: `CodeFest [${rule.rule}]`,
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Count comma-separated arguments inside parentheses starting at openIdx.
 * Returns null if parens aren't balanced on this line.
 */
function countArgs(line: string, openIdx: number): number | null {
  if (line[openIdx] !== '(') return null;

  let depth = 0;
  let argCount = 0;
  let hasContent = false;

  for (let i = openIdx; i < line.length; i++) {
    const c = line[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        return hasContent ? argCount + 1 : 0;
      }
    } else if (c === ',' && depth === 1) {
      argCount++;
    } else if (depth === 1 && c.trim()) {
      hasContent = true;
    }
  }

  return null; // unbalanced
}
