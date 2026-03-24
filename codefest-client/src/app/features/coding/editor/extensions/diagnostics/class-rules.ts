import { type Diagnostic } from '@codemirror/lint';
import {
  type LintContext,
  isInsideStringOrComment,
  posOf,
  quickFix,
  quickFixInsert,
  quickFixRemove,
} from '../diagnostic-helpers';
import { type SymbolTable } from '../symbol-table';

/**
 * Class & method declaration rules (§4.8).
 * CF210-CF222: Main method issues, access modifiers, declaration structure.
 */
export function classRules(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  return [
    ...checkMainMethod(ctx, symbols),
    ...checkDuplicateAccessModifiers(ctx),
    ...checkAccessModifierOnLocal(ctx),
    ...checkConstructorReturnType(ctx, symbols),
  ];
}

// ── CF210-CF213: Main method issues ─────────────────────────────────────

function checkMainMethod(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const mainMethods: number[] = [];

  for (const [name, method] of symbols.methods) {
    if (name === 'Main') {
      mainMethods.push(method.declaredLine);

      // CF210: Main without static
      if (!method.isStatic) {
        const line = ctx.lines[method.declaredLine];
        const mainPos = line.indexOf('Main');
        diagnostics.push({
          from: posOf(ctx, method.declaredLine, mainPos),
          to: posOf(ctx, method.declaredLine, mainPos + 4),
          severity: 'error',
          message: 'The `Main` method must be declared `static`.',
          source: 'CodeFest [CF210]',
          actions: [quickFixInsert('Add `static`', 'static ')],
        });
      }
    }
  }

  // CF213: Multiple Main methods
  if (mainMethods.length > 1) {
    for (const line of mainMethods) {
      const lineText = ctx.lines[line];
      const mainPos = lineText.indexOf('Main');
      diagnostics.push({
        from: posOf(ctx, line, mainPos),
        to: posOf(ctx, line, mainPos + 4),
        severity: 'warning',
        message: 'Multiple `Main` methods found. A program should have exactly one entry point.',
        source: 'CodeFest [CF213]',
      });
    }
  }

  return diagnostics;
}

// ── CF220: Duplicate/conflicting access modifiers ───────────────────────

function checkDuplicateAccessModifiers(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const modifiers = ['public', 'private', 'protected', 'internal'];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    const found: string[] = [];
    for (const mod of modifiers) {
      const regex = new RegExp(`\\b${mod}\\b`, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        if (!isInsideStringOrComment(ctx.code, posOf(ctx, i, match.index))) {
          found.push(mod);
        }
      }
    }

    if (found.length > 1) {
      const firstIdx = line.indexOf(found[0]);
      diagnostics.push({
        from: posOf(ctx, i, firstIdx),
        to: posOf(ctx, i, firstIdx + found.join(' ').length),
        severity: 'error',
        message: 'Duplicate or conflicting access modifiers.',
        source: 'CodeFest [CF220]',
      });
    }
  }

  return diagnostics;
}

// ── CF222: Access modifier on local variable ────────────────────────────

function checkAccessModifierOnLocal(ctx: LintContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Track whether we're inside a method body
  let inMethodBody = false;
  let braceDepth = 0;
  let methodBraceStart = 0;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    // Simple method detection: line with return type + name + (
    const methodDecl = /\b(?:void|int|string|double|bool|char|decimal|float|long|Task|static\s+\w+)\s+\w+\s*\(/.test(trimmed);

    for (const c of line) {
      if (c === '{') {
        braceDepth++;
        if (methodDecl && !inMethodBody) {
          inMethodBody = true;
          methodBraceStart = braceDepth;
        }
      }
      if (c === '}') {
        if (inMethodBody && braceDepth === methodBraceStart) {
          inMethodBody = false;
        }
        braceDepth--;
      }
    }

    if (inMethodBody && braceDepth > methodBraceStart) {
      // Inside a method body — check for access modifiers on variable declarations
      const accessMatch = trimmed.match(/^(public|private|protected|internal)\s+(int|string|double|bool|char|decimal|float|long|var)\s+\w+/);
      if (accessMatch) {
        const modPos = line.indexOf(accessMatch[1]);
        diagnostics.push({
          from: posOf(ctx, i, modPos),
          to: posOf(ctx, i, modPos + accessMatch[1].length),
          severity: 'error',
          message: `Access modifiers (\`${accessMatch[1]}\`) cannot be used on local variables.`,
          source: 'CodeFest [CF222]',
          actions: [quickFixRemove(`Remove \`${accessMatch[1]}\``)],
        });
      }
    }
  }

  return diagnostics;
}

// ── CF216: Constructor with return type ──────────────────────────────────

function checkConstructorReturnType(ctx: LintContext, symbols: SymbolTable): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const className = symbols.currentClass;
  if (!className) return diagnostics;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    // Look for: void ClassName( or int ClassName(
    const ctorMatch = line.match(new RegExp(`\\b(void|int|string|double|bool)\\s+(${className})\\s*\\(`));
    if (ctorMatch) {
      const typePos = line.indexOf(ctorMatch[1]);
      const absPos = posOf(ctx, i, typePos);
      if (!isInsideStringOrComment(ctx.code, absPos)) {
        diagnostics.push({
          from: absPos,
          to: absPos + ctorMatch[1].length,
          severity: 'warning',
          message: `Constructors don't have a return type. Remove \`${ctorMatch[1]}\` from \`${ctorMatch[1]} ${className}()\`.`,
          source: 'CodeFest [CF216]',
          actions: [quickFix(`Remove \`${ctorMatch[1]}\``, '')],
        });
      }
    }
  }

  return diagnostics;
}
