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
 * Control flow rules (§4.7).
 * Phase 1: foreach without in (CF180), empty catch (CF204), throw ex (CF205).
 * Phase 2: suspicious patterns (CF200-CF203), else/catch/case context (CF181-CF188).
 * Phase 3: unreachable code (CF190-CF196).
 */
export function controlFlowRules(ctx: LintContext): Diagnostic[] {
  return [
    ...checkForeachWithoutIn(ctx),
    ...checkEmptyCatch(ctx),
    ...checkThrowEx(ctx),
    ...checkSuspiciousSemicolons(ctx),
    ...checkOrphanedKeywords(ctx),
    ...checkCaseWithoutBreak(ctx),
    ...checkBreakContinueContext(ctx),
    ...checkUnreachableCode(ctx),
  ];
}

// ── CF180: foreach without `in` ──────────────────────────────────────────

function checkForeachWithoutIn(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const regex = /\bforeach\s*\(\s*(?:var|int|string|double|bool|char|decimal|float|long|\w+)\s+(\w+)\s+(?!in\b)(\w+)/;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const match = line.match(regex);
    if (match) {
      const foreachPos = line.indexOf('foreach');
      diagnostics.push({
        from: posOf(ctx, i, foreachPos),
        to: posOf(ctx, i, line.length),
        severity: 'error',
        message: 'Missing `in` keyword in `foreach` loop. Syntax: `foreach (var item in collection)`.',
        source: 'CodeFest [CF180]',
      });
    }
  }

  return diagnostics;
}

// ── CF204: Empty catch block ─────────────────────────────────────────────

function checkEmptyCatch(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (!line.includes('catch')) continue;
    if (line.trim().startsWith('//')) continue;

    // Look ahead for empty catch body: catch (...) { }
    const restOfCode = ctx.lines.slice(i).join('\n');
    const catchBody = restOfCode.match(/\bcatch\s*(\([^)]*\))?\s*\{\s*\}/);

    if (catchBody && catchBody.index !== undefined && catchBody.index < 80) {
      const catchPos = line.indexOf('catch');
      diagnostics.push({
        from: posOf(ctx, i, catchPos),
        to: posOf(ctx, i, catchPos + 5),
        severity: 'warning',
        message: 'Empty `catch` block silently swallows errors. At minimum, log the exception.',
        source: 'CodeFest [CF204]',
      });
    }
  }

  return diagnostics;
}

// ── CF205: throw ex; → throw; ────────────────────────────────────────────

function checkThrowEx(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const throwRegex = /\bthrow\s+(\w+)\s*;/;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const match = line.match(throwRegex);
    if (match && match[1] !== 'new') {
      const throwPos = line.indexOf('throw');
      diagnostics.push({
        from: posOf(ctx, i, throwPos),
        to: posOf(ctx, i, throwPos + match[0].length),
        severity: 'info',
        message: 'Use `throw;` instead of `throw ex;` to preserve the original stack trace.',
        source: 'CodeFest [CF205]',
        actions: [quickFix('Fix: `throw;`', 'throw;')],
      });
    }
  }

  return diagnostics;
}

// ── CF200-CF203: Suspicious semicolons after control flow ────────────────

function checkSuspiciousSemicolons(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const patterns = [
    { regex: /\bif\s*\([^)]*\)\s*;/g, keyword: 'if', rule: 'CF200' },
    { regex: /\bfor\s*\([^)]*\)\s*;/g, keyword: 'for', rule: 'CF201' },
    { regex: /\bwhile\s*\([^)]*\)\s*;/g, keyword: 'while', rule: 'CF202' },
    { regex: /\bforeach\s*\([^)]*\)\s*;/g, keyword: 'foreach', rule: 'CF203' },
  ];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    for (const { regex, keyword, rule } of patterns) {
      const pat = new RegExp(regex.source, regex.flags);
      let match: RegExpExecArray | null;
      while ((match = pat.exec(line)) !== null) {
        // For `while`, skip do-while pattern
        if (keyword === 'while') {
          // Look back for `}` before the while — it's a do-while
          const beforeWhile = line.slice(0, match.index).trim();
          if (beforeWhile.endsWith('}')) continue;
          // Also check previous non-empty lines
          let prevLine = '';
          for (let j = i - 1; j >= 0; j--) {
            prevLine = ctx.lines[j].trim();
            if (prevLine.length > 0) break;
          }
          if (prevLine.endsWith('}')) continue;
        }

        const semiPos = match.index + match[0].length - 1;
        const absPos = posOf(ctx, i, semiPos);
        if (isInsideStringOrComment(ctx.code, absPos)) continue;

        diagnostics.push({
          from: absPos,
          to: absPos + 1,
          severity: 'warning',
          message: `Suspicious semicolon after \`${keyword}\`. The ${keyword === 'if' ? 'condition block' : 'loop body'} is empty.`,
          source: `CodeFest [${rule}]`,
          actions: [quickFixRemove('Remove `;`')],
        });
      }
    }
  }

  return diagnostics;
}

// ── CF181-CF183: Orphaned else/catch/finally ─────────────────────────────

function checkOrphanedKeywords(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    // CF181: else without if — check if there's no preceding } or if block
    if (/^\s*else\b/.test(line)) {
      let foundPrecedingBlock = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = ctx.lines[j].trim();
        if (prev.length === 0) continue;
        if (prev.endsWith('}') || prev.startsWith('}')) {
          foundPrecedingBlock = true;
          break;
        }
        if (/\bif\b/.test(prev)) {
          foundPrecedingBlock = true;
          break;
        }
        break; // first non-empty line didn't match
      }

      if (!foundPrecedingBlock) {
        const elsePos = line.indexOf('else');
        diagnostics.push({
          from: posOf(ctx, i, elsePos),
          to: posOf(ctx, i, elsePos + 4),
          severity: 'error',
          message: '`else` without a matching `if`.',
          source: 'CodeFest [CF181]',
        });
      }
    }

    // CF182: catch without try
    if (/^\s*catch\b/.test(line)) {
      let foundTry = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = ctx.lines[j].trim();
        if (prev.length === 0) continue;
        if (prev.endsWith('}') || prev.startsWith('}')) { foundTry = true; break; }
        if (/\btry\b/.test(prev)) { foundTry = true; break; }
        break;
      }
      if (!foundTry) {
        const catchPos = line.indexOf('catch');
        diagnostics.push({
          from: posOf(ctx, i, catchPos),
          to: posOf(ctx, i, catchPos + 5),
          severity: 'error',
          message: '`catch` without a matching `try`.',
          source: 'CodeFest [CF182]',
        });
      }
    }

    // CF183: finally without try
    if (/^\s*finally\b/.test(line)) {
      let foundContext = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = ctx.lines[j].trim();
        if (prev.length === 0) continue;
        if (prev.endsWith('}') || prev.startsWith('}')) { foundContext = true; break; }
        if (/\b(try|catch)\b/.test(prev)) { foundContext = true; break; }
        break;
      }
      if (!foundContext) {
        const finallyPos = line.indexOf('finally');
        diagnostics.push({
          from: posOf(ctx, i, finallyPos),
          to: posOf(ctx, i, finallyPos + 7),
          severity: 'error',
          message: '`finally` without a matching `try`.',
          source: 'CodeFest [CF183]',
        });
      }
    }
  }

  return diagnostics;
}

// ── CF188: case without break/return ─────────────────────────────────────

function checkCaseWithoutBreak(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const caseMatch = line.match(/^\s*(case\s+.+:|default\s*:)/);
    if (!caseMatch) continue;

    // Look ahead for break/return/throw/goto before next case/default/}
    let hasTerminator = false;
    let hasStatements = false;

    for (let j = i + 1; j < ctx.lines.length; j++) {
      const nextTrimmed = ctx.lines[j].trim();
      if (nextTrimmed.length === 0 || nextTrimmed.startsWith('//')) continue;

      // Next case/default or closing brace — end of this case block
      if (/^\s*(case\s|default\s*:|\})/.test(nextTrimmed)) break;

      hasStatements = true;
      if (/\b(break|return|throw|goto)\b/.test(nextTrimmed)) {
        hasTerminator = true;
        break;
      }
    }

    if (hasStatements && !hasTerminator) {
      const casePos = line.indexOf(caseMatch[1]);
      diagnostics.push({
        from: posOf(ctx, i, casePos),
        to: posOf(ctx, i, casePos + caseMatch[1].length),
        severity: 'warning',
        message: 'Missing `break` at end of `case` block. C# does not allow fall-through.',
        source: 'CodeFest [CF188]',
        actions: [quickFixInsert('Add `break;`', '\n    break;')],
      });
    }
  }

  return diagnostics;
}

// ── CF185-CF186: break/continue outside loop ─────────────────────────────

function checkBreakContinueContext(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const loopKeywords = /\b(for|foreach|while|do|switch)\b/;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    const breakMatch = trimmed.match(/^\s*break\s*;/);
    const continueMatch = trimmed.match(/^\s*continue\s*;/);

    if (!breakMatch && !continueMatch) continue;

    // Look backward for enclosing loop/switch
    let depth = 0;
    let foundLoop = false;

    for (let j = i - 1; j >= 0; j--) {
      const prev = ctx.lines[j].trim();
      if (prev.includes('}')) depth++;
      if (prev.includes('{')) {
        if (depth > 0) {
          depth--;
        } else {
          // Check if this { is preceded by a loop/switch keyword
          if (loopKeywords.test(prev)) {
            foundLoop = true;
          }
          break;
        }
      }
    }

    if (!foundLoop) {
      const keyword = breakMatch ? 'break' : 'continue';
      const kPos = line.indexOf(keyword);
      const ruleId = breakMatch ? 'CF185' : 'CF186';
      const msg = breakMatch
        ? '`break` can only be used inside a loop or `switch` statement.'
        : '`continue` can only be used inside a loop (`for`, `while`, `foreach`, `do-while`).';

      diagnostics.push({
        from: posOf(ctx, i, kPos),
        to: posOf(ctx, i, kPos + keyword.length),
        severity: 'warning',
        message: msg,
        source: `CodeFest [${ruleId}]`,
      });
    }
  }

  return diagnostics;
}

// ── CF190-CF196: Unreachable code ────────────────────────────────────────

function checkUnreachableCode(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const terminators = /^\s*(return\b|break\s*;|continue\s*;|throw\b)/;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (!terminators.test(trimmed)) continue;
    if (trimmed.startsWith('//')) continue;

    // Find the terminator keyword
    const termMatch = trimmed.match(/\b(return|break|continue|throw)\b/);
    if (!termMatch) continue;

    // Make sure the terminator statement is complete (ends with ;)
    const restOfLine = trimmed.slice(trimmed.indexOf(termMatch[1]));
    if (!restOfLine.includes(';')) continue;

    // Check next non-empty, non-comment lines in the same block
    for (let j = i + 1; j < ctx.lines.length; j++) {
      const nextTrimmed = ctx.lines[j].trim();
      if (nextTrimmed.length === 0) continue;
      if (nextTrimmed.startsWith('//')) continue;

      // End of block — no unreachable code
      if (nextTrimmed === '}' || nextTrimmed.startsWith('}')) break;
      // Next case label — not unreachable
      if (/^\s*(case\s|default\s*:)/.test(nextTrimmed)) break;

      diagnostics.push({
        from: posOf(ctx, j, 0),
        to: posOf(ctx, j, ctx.lines[j].length),
        severity: 'warning',
        message: `Unreachable code detected after \`${termMatch[1]}\` statement.`,
        source: `CodeFest [CF19${termMatch[1] === 'return' ? '0' : termMatch[1] === 'break' ? '1' : termMatch[1] === 'continue' ? '2' : '3'}]`,
      });
      break; // Only flag the first unreachable line
    }
  }

  return diagnostics;
}
