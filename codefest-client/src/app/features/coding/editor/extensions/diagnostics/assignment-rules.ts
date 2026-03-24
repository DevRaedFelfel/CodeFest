import { type Diagnostic } from '@codemirror/lint';
import { type LintContext, isInsideStringOrComment, posOf, quickFix } from '../diagnostic-helpers';
import { type SymbolTable } from '../symbol-table';

/**
 * Assignment & comparison rules (§4.4).
 * Phase 1: = vs == confusion (CF110-CF113), assignment to self (CF124).
 * Phase 3: uninitialized variables (CF120-CF123) — requires symbol table.
 */
export function assignmentRules(ctx: LintContext, symbols?: SymbolTable): Diagnostic[] {
  return [
    ...checkAssignmentInCondition(ctx),
    ...checkComparisonAsStatement(ctx),
    ...checkSelfAssignment(ctx),
    ...(symbols ? checkUninitializedVars(ctx, symbols) : []),
    ...(symbols ? checkVarWithoutInitializer(ctx) : []),
    ...(symbols ? checkDuplicateDeclarations(ctx, symbols) : []),
    ...(symbols ? checkUnusedVariables(ctx, symbols) : []),
  ];
}

// ── CF110-CF111: Assignment in condition ─────────────────────────────────

function checkAssignmentInCondition(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    // Match if/while with condition containing single =
    const conditionMatch = line.match(/\b(if|while)\s*\(/);
    if (!conditionMatch) continue;

    const parenStart = line.indexOf('(', conditionMatch.index!);
    if (parenStart < 0) continue;

    // Extract condition content (simple: find matching paren)
    const condContent = extractParenContent(line, parenStart);
    if (!condContent) continue;

    // Find single = that isn't ==, !=, <=, >=
    const eqRegex = /[^!=<>]=[^=]/g;
    let match: RegExpExecArray | null;
    while ((match = eqRegex.exec(condContent.text)) !== null) {
      const eqCol = condContent.startCol + match.index + 1; // +1 for the char before =
      const absPos = posOf(ctx, i, eqCol);

      if (isInsideStringOrComment(ctx.code, absPos)) continue;

      const keyword = conditionMatch[1];
      diagnostics.push({
        from: absPos,
        to: absPos + 1,
        severity: 'warning',
        message: `Did you mean \`==\`? A single \`=\` is assignment, \`==\` is comparison.`,
        source: `CodeFest [CF${keyword === 'if' ? '110' : '111'}]`,
        actions: [quickFix('Fix: `==`', '==')],
      });
    }
  }

  return diagnostics;
}

// ── CF112-CF113: Comparison as statement ─────────────────────────────────

function checkComparisonAsStatement(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    // x == value; as a standalone statement
    const eqMatch = trimmed.match(/^(\w[\w.]*)\s*==\s*[^=].*;\s*$/);
    if (eqMatch && !/\b(if|while|for|return|bool|var|case)\b/.test(trimmed)) {
      const eqPos = line.indexOf('==');
      if (eqPos >= 0) {
        const absPos = posOf(ctx, i, eqPos);
        if (!isInsideStringOrComment(ctx.code, absPos)) {
          diagnostics.push({
            from: absPos,
            to: absPos + 2,
            severity: 'warning',
            message: 'Did you mean `=`? `==` compares but doesn\'t assign. Use `=` for assignment.',
            source: 'CodeFest [CF112]',
            actions: [quickFix('Fix: `=`', '=')],
          });
        }
      }
    }

    // x != value; as standalone statement
    const neqMatch = trimmed.match(/^(\w[\w.]*)\s*!=\s*.*;\s*$/);
    if (neqMatch && !/\b(if|while|for|return|bool|var|case)\b/.test(trimmed)) {
      const neqPos = line.indexOf('!=');
      if (neqPos >= 0) {
        const absPos = posOf(ctx, i, neqPos);
        if (!isInsideStringOrComment(ctx.code, absPos)) {
          diagnostics.push({
            from: absPos,
            to: absPos + 2,
            severity: 'warning',
            message: 'This comparison does nothing on its own. Did you mean to use it in an `if` statement?',
            source: 'CodeFest [CF113]',
          });
        }
      }
    }
  }

  return diagnostics;
}

// ── CF124: Assignment to self ────────────────────────────────────────────

function checkSelfAssignment(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const selfAssignRegex = /\b(\w+)\s*=\s*\1\s*;/g;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    selfAssignRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = selfAssignRegex.exec(line)) !== null) {
      // Make sure it's not == (comparison)
      const afterFirst = match.index + match[1].length;
      const segment = line.slice(afterFirst);
      if (segment.match(/^\s*==/)) continue;

      const absPos = posOf(ctx, i, match.index);
      if (isInsideStringOrComment(ctx.code, absPos)) continue;

      diagnostics.push({
        from: absPos,
        to: absPos + match[0].length,
        severity: 'warning',
        message: `Variable \`${match[1]}\` is assigned to itself. This has no effect.`,
        source: 'CodeFest [CF124]',
      });
    }
  }

  return diagnostics;
}

// ── Phase 3: Uninitialized variable usage (CF120) ───────────────────────

function checkUninitializedVars(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, info] of symbols.variables) {
    if (info.initialized) continue;
    if (info.usedLines.length === 0) continue;

    // Check if there's an assignment between declaration and first use
    const firstUse = Math.min(...info.usedLines);
    if (firstUse <= info.declaredLine) continue;

    let assigned = false;
    for (let line = info.declaredLine + 1; line < firstUse; line++) {
      if (line < ctx.lines.length) {
        const assignRegex = new RegExp(`\\b${name}\\s*=(?!=)`);
        if (assignRegex.test(ctx.lines[line])) {
          assigned = true;
          break;
        }
      }
    }

    if (!assigned) {
      diagnostics.push({
        from: posOf(ctx, firstUse, Math.max(0, ctx.lines[firstUse].indexOf(name))),
        to: posOf(ctx, firstUse, Math.max(0, ctx.lines[firstUse].indexOf(name)) + name.length),
        severity: 'error',
        message: `Variable \`${name}\` is used but may not have been assigned a value.`,
        source: 'CodeFest [CF120]',
      });
    }
  }

  return diagnostics;
}

// ── Phase 3: var without initializer (CF121) ────────────────────────────

function checkVarWithoutInitializer(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const varNoInit = /\bvar\s+(\w+)\s*;/g;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    varNoInit.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = varNoInit.exec(line)) !== null) {
      const absPos = posOf(ctx, i, match.index);
      if (isInsideStringOrComment(ctx.code, absPos)) continue;

      diagnostics.push({
        from: absPos,
        to: absPos + match[0].length - 1, // exclude ;
        severity: 'error',
        message: '`var` requires an initializer. Use an explicit type like `int x;` or assign a value: `var x = 0;`',
        source: 'CodeFest [CF121]',
      });
    }
  }

  return diagnostics;
}

// ── Phase 3: Duplicate variable declarations (CF123) ────────────────────

function checkDuplicateDeclarations(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, number>(); // name -> first declaration line

  for (const [name, info] of symbols.variables) {
    const existing = seen.get(name);
    if (existing !== undefined && existing !== info.declaredLine) {
      diagnostics.push({
        from: posOf(ctx, info.declaredLine, Math.max(0, ctx.lines[info.declaredLine].indexOf(name))),
        to: posOf(ctx, info.declaredLine, Math.max(0, ctx.lines[info.declaredLine].indexOf(name)) + name.length),
        severity: 'error',
        message: `A variable named \`${name}\` is already declared in this scope.`,
        source: 'CodeFest [CF123]',
      });
    } else {
      seen.set(name, info.declaredLine);
    }
  }

  return diagnostics;
}

// ── Phase 3: Unused variables (CF122) ───────────────────────────────────

function checkUnusedVariables(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, info] of symbols.variables) {
    // Skip common patterns: loop vars, _ discard, args
    if (name === '_' || name === 'args') continue;
    if (info.usedLines.length === 0) {
      diagnostics.push({
        from: posOf(ctx, info.declaredLine, Math.max(0, ctx.lines[info.declaredLine].indexOf(name))),
        to: posOf(ctx, info.declaredLine, Math.max(0, ctx.lines[info.declaredLine].indexOf(name)) + name.length),
        severity: 'info',
        message: `Variable \`${name}\` is declared but never used.`,
        source: 'CodeFest [CF122]',
      });
    }
  }

  return diagnostics;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractParenContent(line: string, openIdx: number): { text: string; startCol: number } | null {
  let depth = 0;
  for (let i = openIdx; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') {
      depth--;
      if (depth === 0) {
        return { text: line.slice(openIdx + 1, i), startCol: openIdx + 1 };
      }
    }
  }
  return null;
}
