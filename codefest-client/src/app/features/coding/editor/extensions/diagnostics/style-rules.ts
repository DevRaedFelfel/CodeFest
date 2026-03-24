import { type Diagnostic } from '@codemirror/lint';
import {
  type LintContext,
  isInsideStringOrComment,
  posOf,
  quickFix,
} from '../diagnostic-helpers';

/**
 * Style & best practice rules (§4.9).
 * Info severity — educational hints, not errors.
 */
export function styleRules(ctx: LintContext): Diagnostic[] {
  return [
    ...checkRedundantBoolComparison(ctx),
    ...checkNullCheckOnValueType(ctx),
    ...checkStringConcatInLoop(ctx),
    ...checkLongMethod(ctx),
    ...checkDeepNesting(ctx),
    ...checkUsingPosition(ctx),
    ...checkReadLineNullSafety(ctx),
    ...checkEmptyStringComparison(ctx),
  ];
}

// ── CF241: x == true / x == false ────────────────────────────────────────

function checkRedundantBoolComparison(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const regex = /(\w+)\s*==\s*(true|false)\b/g;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const pat = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = pat.exec(line)) !== null) {
      const absPos = posOf(ctx, i, match.index);
      if (isInsideStringOrComment(ctx.code, absPos)) continue;

      const varName = match[1];
      const boolVal = match[2];
      const suggestion = boolVal === 'true' ? varName : `!${varName}`;

      diagnostics.push({
        from: absPos,
        to: absPos + match[0].length,
        severity: 'info',
        message: `Redundant comparison. Use \`${suggestion}\` directly.`,
        source: 'CodeFest [CF241]',
        actions: [quickFix(`Simplify to \`${suggestion}\``, suggestion)],
      });
    }
  }

  return diagnostics;
}

// ── CF242: x != null on value type ──────────────────────────────────────

function checkNullCheckOnValueType(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const valueTypes = /\b(int|double|float|decimal|long|short|byte|char|bool)\s+(\w+)/;
  const declaredValueVars = new Set<string>();

  // First pass: collect value-type variables
  for (const line of ctx.lines) {
    const match = line.match(valueTypes);
    if (match) declaredValueVars.add(match[2]);
  }

  // Second pass: find null checks on them
  const nullCheck = /(\w+)\s*!=\s*null\b/g;
  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const pat = new RegExp(nullCheck.source, nullCheck.flags);
    let match: RegExpExecArray | null;
    while ((match = pat.exec(line)) !== null) {
      if (declaredValueVars.has(match[1])) {
        const absPos = posOf(ctx, i, match.index);
        if (isInsideStringOrComment(ctx.code, absPos)) continue;

        diagnostics.push({
          from: absPos,
          to: absPos + match[0].length,
          severity: 'info',
          message: `Value types like \`${match[1]}\`'s type can never be \`null\`. This check is unnecessary.`,
          source: 'CodeFest [CF242]',
        });
      }
    }
  }

  return diagnostics;
}

// ── CF243: String concatenation in loop ─────────────────────────────────

function checkStringConcatInLoop(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let inLoop = false;
  let loopDepth = 0;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();

    if (/\b(for|foreach|while)\s*\(/.test(trimmed)) {
      inLoop = true;
      loopDepth = 0;
    }

    if (inLoop) {
      for (const c of line) {
        if (c === '{') loopDepth++;
        if (c === '}') { loopDepth--; if (loopDepth <= 0) inLoop = false; }
      }

      // Check for string += "..." or string = string + "..."
      const concatMatch = trimmed.match(/(\w+)\s*\+=\s*("|\w)/);
      if (concatMatch) {
        const absPos = posOf(ctx, i, line.indexOf(concatMatch[0]));
        if (!isInsideStringOrComment(ctx.code, absPos)) {
          diagnostics.push({
            from: absPos,
            to: absPos + concatMatch[0].length,
            severity: 'info',
            message: 'Building strings in a loop with `+` is slow. Consider using `StringBuilder` or `string.Join()`.',
            source: 'CodeFest [CF243]',
          });
        }
      }
    }
  }

  return diagnostics;
}

// ── CF249: Long method ──────────────────────────────────────────────────

function checkLongMethod(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const methodDecl = /\b(?:public|private|protected|internal|static|async|virtual|override|abstract)\s+.*?\b(void|int|string|double|bool|char|decimal|Task\b)\s+(\w+)\s*\(/;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const match = line.match(methodDecl);
    if (!match) continue;

    const methodName = match[2];
    let braceDepth = 0;
    let started = false;
    let lineCount = 0;

    for (let j = i; j < ctx.lines.length; j++) {
      for (const c of ctx.lines[j]) {
        if (c === '{') { braceDepth++; started = true; }
        if (c === '}') braceDepth--;
      }
      if (started) lineCount++;
      if (started && braceDepth <= 0) break;
    }

    if (lineCount > 50) {
      const namePos = line.indexOf(methodName);
      diagnostics.push({
        from: posOf(ctx, i, namePos),
        to: posOf(ctx, i, namePos + methodName.length),
        severity: 'info',
        message: `This method is quite long (${lineCount} lines). Consider breaking it into smaller methods.`,
        source: 'CodeFest [CF249]',
      });
    }
  }

  return diagnostics;
}

// ── CF250: Deep nesting ─────────────────────────────────────────────────

function checkDeepNesting(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let depth = 0;
  const flaggedDepths = new Set<number>();

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    for (const c of line) {
      if (c === '{') depth++;
      if (c === '}') depth--;
    }

    if (depth > 4 && !flaggedDepths.has(depth)) {
      flaggedDepths.add(depth);
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('{') && !trimmed.startsWith('}')) {
        diagnostics.push({
          from: posOf(ctx, i, 0),
          to: posOf(ctx, i, line.length),
          severity: 'info',
          message: `This code is deeply nested (${depth} levels). Consider simplifying with early returns or extracting methods.`,
          source: 'CodeFest [CF250]',
        });
      }
    }
  }

  return diagnostics;
}

// ── CF251: using not at top of file ─────────────────────────────────────

function checkUsingPosition(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let pastHeader = false;

  for (let i = 0; i < ctx.lines.length; i++) {
    const trimmed = ctx.lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('using ')) continue;
    pastHeader = true;

    if (pastHeader && trimmed.startsWith('using ') && trimmed.endsWith(';')) {
      diagnostics.push({
        from: posOf(ctx, i, 0),
        to: posOf(ctx, i, ctx.lines[i].length),
        severity: 'warning',
        message: '`using` statements should be at the top of the file.',
        source: 'CodeFest [CF251]',
      });
    }
  }

  return diagnostics;
}

// ── CF247: Console.ReadLine().Method() without null check ───────────────

function checkReadLineNullSafety(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    // Console.ReadLine().SomeMethod() without ?.
    const match = line.match(/Console\.ReadLine\(\)\s*\.\s*(\w+)/);
    if (match) {
      const readlinePos = line.indexOf('Console.ReadLine()');
      const absPos = posOf(ctx, i, readlinePos);
      if (!isInsideStringOrComment(ctx.code, absPos)) {
        // Check it's not already using ?.
        const afterReadLine = line.slice(readlinePos + 'Console.ReadLine()'.length);
        if (!afterReadLine.startsWith('?')) {
          diagnostics.push({
            from: absPos,
            to: absPos + match[0].length + 'Console.ReadLine()'.length - match[0].length + match[0].length,
            severity: 'info',
            message: `\`Console.ReadLine()\` can return \`null\`. Consider using \`Console.ReadLine()?.${match[1]}()\` or adding a null check.`,
            source: 'CodeFest [CF247]',
          });
        }
      }
    }
  }

  return diagnostics;
}

// ── CF248: Comparison with "" instead of string.IsNullOrEmpty ───────────

function checkEmptyStringComparison(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const match = line.match(/(\w+)\s*==\s*""\s*/);
    if (match) {
      const absPos = posOf(ctx, i, match.index!);
      if (!isInsideStringOrComment(ctx.code, absPos)) {
        diagnostics.push({
          from: absPos,
          to: absPos + match[0].length,
          severity: 'info',
          message: `Consider using \`string.IsNullOrEmpty(${match[1]})\` instead of \`${match[1]} == ""\` — it also handles \`null\`.`,
          source: 'CodeFest [CF248]',
          actions: [quickFix(`Fix: \`string.IsNullOrEmpty(${match[1]})\``, `string.IsNullOrEmpty(${match[1]})`)],
        });
      }
    }
  }

  return diagnostics;
}
