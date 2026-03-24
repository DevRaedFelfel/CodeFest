import { type Diagnostic } from '@codemirror/lint';
import {
  type LintContext,
  isInsideStringOrComment,
  posOf,
  quickFix,
} from '../diagnostic-helpers';
import { type SymbolTable } from '../symbol-table';

/**
 * Type mismatch rules (§4.5).
 * CF130-CF136: Assignment type mismatches.
 * CF140-CF143: Return type mismatches.
 * CF150-CF152: Condition type errors.
 * CF155-CF157: Parse method argument errors.
 */
export function typeRules(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  return [
    ...checkAssignmentMismatch(ctx, symbols),
    ...checkReadLineAssignment(ctx),
    ...checkConditionType(ctx, symbols),
    ...checkParseArgErrors(ctx, symbols),
    ...checkReturnTypeMismatch(ctx, symbols),
  ];
}

// ── CF130-CF134: Assignment type mismatches ──────────────────────────────

function checkAssignmentMismatch(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    // Pattern: type varName = literal;
    const assignMatch = line.match(/\b(int|double|float|decimal|long|short|byte)\s+(\w+)\s*=\s*"([^"]*)"\s*;/);
    if (assignMatch) {
      const absPos = posOf(ctx, i, line.indexOf('"'));
      if (!isInsideStringOrComment(ctx.code, posOf(ctx, i, 0))) {
        diagnostics.push({
          from: absPos,
          to: absPos + assignMatch[3].length + 2,
          severity: 'error',
          message: `Cannot assign a \`string\` to variable \`${assignMatch[2]}\` of type \`${assignMatch[1]}\`.`,
          source: 'CodeFest [CF130]',
        });
      }
    }

    // string s = 42;
    const strNumMatch = line.match(/\bstring\s+(\w+)\s*=\s*(\d+)\s*;/);
    if (strNumMatch) {
      const numPos = line.indexOf(strNumMatch[2], line.indexOf('='));
      const absPos = posOf(ctx, i, numPos);
      if (!isInsideStringOrComment(ctx.code, absPos)) {
        diagnostics.push({
          from: absPos,
          to: absPos + strNumMatch[2].length,
          severity: 'error',
          message: `Cannot assign an \`int\` to variable \`${strNumMatch[1]}\` of type \`string\`. Use \`${strNumMatch[2]}.ToString()\` or \`"${strNumMatch[2]}"\`.`,
          source: 'CodeFest [CF131]',
          actions: [
            quickFix(`Fix: \`"${strNumMatch[2]}"\``, `"${strNumMatch[2]}"`),
          ],
        });
      }
    }

    // int x = true/false;
    const intBoolMatch = line.match(/\b(int|double|float|decimal|long|short|byte)\s+(\w+)\s*=\s*(true|false)\s*;/);
    if (intBoolMatch) {
      const boolPos = line.indexOf(intBoolMatch[3], line.indexOf('='));
      const absPos = posOf(ctx, i, boolPos);
      diagnostics.push({
        from: absPos,
        to: absPos + intBoolMatch[3].length,
        severity: 'error',
        message: `Cannot assign a \`bool\` to variable \`${intBoolMatch[2]}\` of type \`${intBoolMatch[1]}\`.`,
        source: 'CodeFest [CF132]',
      });
    }

    // bool b = 0 or 1;
    const boolNumMatch = line.match(/\bbool\s+(\w+)\s*=\s*(\d+)\s*;/);
    if (boolNumMatch) {
      const numPos = line.indexOf(boolNumMatch[2], line.indexOf('='));
      const absPos = posOf(ctx, i, numPos);
      diagnostics.push({
        from: absPos,
        to: absPos + boolNumMatch[2].length,
        severity: 'error',
        message: 'Cannot assign an `int` to a `bool`. In C#, use `true` or `false` (not `0`/`1` like C/C++).',
        source: 'CodeFest [CF133]',
      });
    }
  }

  return diagnostics;
}

// ── CF135-CF136: Console.ReadLine() assigned to wrong type ──────────────

function checkReadLineAssignment(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const match = line.match(/\b(int|double|float|decimal|long|short|byte|bool)\s+(\w+)\s*=\s*Console\.ReadLine\s*\(\s*\)/);
    if (match) {
      const readlinePos = line.indexOf('Console.ReadLine');
      const absPos = posOf(ctx, i, readlinePos);
      if (!isInsideStringOrComment(ctx.code, absPos)) {
        const parseMethod = match[1] === 'double' ? 'double.Parse' : match[1] === 'bool' ? 'bool.Parse' : `${match[1]}.Parse`;
        diagnostics.push({
          from: absPos,
          to: absPos + 'Console.ReadLine()'.length,
          severity: 'error',
          message: `\`Console.ReadLine()\` returns a \`string\`. Use \`${parseMethod}(Console.ReadLine())\` to convert.`,
          source: `CodeFest [CF${match[1] === 'double' ? '136' : '135'}]`,
          actions: [quickFix(`Wrap in \`${parseMethod}()\``, `${parseMethod}(Console.ReadLine())`)],
        });
      }
    }
  }

  return diagnostics;
}

// ── CF150-CF152: Non-boolean in conditions ──────────────────────────────

function checkConditionType(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    // if/while with just a variable or literal in condition
    const condMatch = line.match(/\b(if|while)\s*\(\s*(\w+)\s*\)/);
    if (!condMatch) continue;

    const keyword = condMatch[1];
    const condExpr = condMatch[2];

    // Check for numeric literal in condition: while(1), if(0)
    if (/^\d+$/.test(condExpr)) {
      const condPos = line.indexOf(condExpr, line.indexOf('('));
      diagnostics.push({
        from: posOf(ctx, i, condPos),
        to: posOf(ctx, i, condPos + condExpr.length),
        severity: 'error',
        message: `\`${keyword}\` condition must be a \`bool\`. Did you mean \`${keyword} (true)\`?`,
        source: `CodeFest [CF152]`,
        actions: [quickFix('Fix: `true`', 'true')],
      });
      continue;
    }

    // Check for string literal in condition
    if (condExpr.startsWith('"')) {
      const condPos = line.indexOf(condExpr, line.indexOf('('));
      diagnostics.push({
        from: posOf(ctx, i, condPos),
        to: posOf(ctx, i, condPos + condExpr.length),
        severity: 'error',
        message: `\`${keyword}\` condition must be a \`bool\`. Strings are not booleans in C#.`,
        source: 'CodeFest [CF151]',
      });
      continue;
    }

    // Check if variable is known to be non-bool
    const varInfo = symbols.variables.get(condExpr);
    if (varInfo && varInfo.type !== 'unknown' && varInfo.type !== 'bool') {
      const condPos = line.indexOf(condExpr, line.indexOf('('));
      diagnostics.push({
        from: posOf(ctx, i, condPos),
        to: posOf(ctx, i, condPos + condExpr.length),
        severity: 'error',
        message: `\`${keyword}\` condition must be a \`bool\` expression. \`${varInfo.type}\` is not implicitly convertible to \`bool\` in C#. Did you mean \`${keyword} (${condExpr} != 0)\`?`,
        source: 'CodeFest [CF150]',
        actions: [quickFix(`Fix: \`${condExpr} != 0\``, `${condExpr} != 0`)],
      });
    }
  }

  return diagnostics;
}

// ── CF155-CF157: Parse argument errors ──────────────────────────────────

function checkParseArgErrors(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    // int.Parse(42) — numeric literal passed to Parse
    const parseLitMatch = line.match(/\b(int|double|decimal|float|long|bool)\.Parse\s*\(\s*(\d+(?:\.\d+)?)\s*\)/);
    if (parseLitMatch) {
      const parsePos = line.indexOf(`${parseLitMatch[1]}.Parse`);
      const absPos = posOf(ctx, i, parsePos);
      if (!isInsideStringOrComment(ctx.code, absPos)) {
        diagnostics.push({
          from: absPos,
          to: absPos + parseLitMatch[0].length,
          severity: 'error',
          message: `\`${parseLitMatch[1]}.Parse()\` expects a \`string\` argument, not an \`${parseLitMatch[1]}\`. You already have a number!`,
          source: 'CodeFest [CF155]',
          actions: [quickFix(`Fix: just use \`${parseLitMatch[2]}\``, parseLitMatch[2])],
        });
      }
    }

    // int.Parse(x) where x is known to be int
    const parseVarMatch = line.match(/\b(int|double|decimal|float|long)\.Parse\s*\(\s*(\w+)\s*\)/);
    if (parseVarMatch) {
      const varName = parseVarMatch[2];
      const varInfo = symbols.variables.get(varName);
      if (varInfo && varInfo.type === parseVarMatch[1]) {
        const parsePos = line.indexOf(`${parseVarMatch[1]}.Parse`);
        const absPos = posOf(ctx, i, parsePos);
        if (!isInsideStringOrComment(ctx.code, absPos)) {
          diagnostics.push({
            from: absPos,
            to: absPos + parseVarMatch[0].length,
            severity: 'warning',
            message: `\`${parseVarMatch[1]}.Parse()\` expects a \`string\`. \`${varName}\` is already an \`${varInfo.type}\`.`,
            source: 'CodeFest [CF156]',
            actions: [quickFix(`Fix: just use \`${varName}\``, varName)],
          });
        }
      }
    }
  }

  return diagnostics;
}

// ── CF140-CF143: Return type mismatches ──────────────────────────────────

function checkReturnTypeMismatch(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, methods] of symbols.methods) {
    for (const method of methods) {
      if (method.returnType === 'void') {
        // CF141: void method returning a value
        for (let i = method.declaredLine + 1; i < ctx.lines.length; i++) {
          const line = ctx.lines[i];
          const trimmed = line.trim();
          if (trimmed === '}') break; // rough scope end

          const returnMatch = trimmed.match(/\breturn\s+(.+);/);
          if (returnMatch) {
            const returnPos = line.indexOf('return');
            diagnostics.push({
              from: posOf(ctx, i, returnPos),
              to: posOf(ctx, i, returnPos + returnMatch[0].length),
              severity: 'error',
              message: 'Cannot return a value from a `void` method.',
              source: 'CodeFest [CF141]',
            });
          }
        }
      }

      // CF142: Non-void method with no return
      if (method.returnType !== 'void' && method.returnType !== 'Task') {
        let hasReturn = false;
        let braceDepth = 0;
        let started = false;

        for (let i = method.declaredLine; i < ctx.lines.length; i++) {
          const line = ctx.lines[i];
          if (line.includes('{')) { braceDepth++; started = true; }
          if (line.includes('}')) { braceDepth--; if (started && braceDepth <= 0) break; }

          if (/\breturn\b/.test(line)) {
            hasReturn = true;
            break;
          }
        }

        if (!hasReturn && started) {
          diagnostics.push({
            from: posOf(ctx, method.declaredLine, Math.max(0, ctx.lines[method.declaredLine].indexOf(name))),
            to: posOf(ctx, method.declaredLine, Math.max(0, ctx.lines[method.declaredLine].indexOf(name)) + name.length),
            severity: 'warning',
            message: `Method \`${name}\` is declared to return \`${method.returnType}\` but has no \`return\` statement.`,
            source: 'CodeFest [CF142]',
          });
        }
      }
    }
  }

  return diagnostics;
}
