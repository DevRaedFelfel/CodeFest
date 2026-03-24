import { type Diagnostic, type Action } from '@codemirror/lint';
import { type Text } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';

/** Shared context passed to every rule module. */
export interface LintContext {
  lines: string[];
  code: string;
  doc: Text;
  lineOffsets: number[];
}

/** Signature every rule module exports. */
export type RuleSet = (ctx: LintContext) => Diagnostic[];

/** Maximum diagnostics returned per lint pass. */
export const MAX_DIAGNOSTICS = 50;

/** Build LintContext from CodeMirror document. */
export function buildContext(code: string, doc: Text): LintContext {
  const lines = code.split('\n');
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for \n
  }
  return { lines, code, doc, lineOffsets };
}

/** Absolute document position from line index + column. */
export function posOf(ctx: LintContext, lineIndex: number, col: number): number {
  return ctx.lineOffsets[lineIndex] + col;
}

/**
 * Check if a character position in a line is inside a string literal.
 * Handles escaped quotes. Does NOT handle verbatim or interpolated strings
 * spanning across the check boundary — use isInsideStringOrComment for that.
 */
export function isInsideString(line: string, pos: number): boolean {
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < pos; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';
    if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
  }
  return inDouble || inSingle;
}

/**
 * Full-document scanner: checks if an absolute position is inside a
 * string literal, char literal, or comment.
 */
export function isInsideStringOrComment(code: string, pos: number): boolean {
  let inString = false;
  let inVerbatim = false;
  let inChar = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < pos && i < code.length; i++) {
    const c = code[i];
    const next = code[i + 1];
    const prev = i > 0 ? code[i - 1] : '';

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inVerbatim) {
      if (c === '"') {
        if (next === '"') { i++; continue; } // escaped "" in verbatim
        inVerbatim = false;
      }
      continue;
    }
    if (inString) {
      if (c === '"' && prev !== '\\') inString = false;
      continue;
    }
    if (inChar) {
      if (c === "'" && prev !== '\\') inChar = false;
      continue;
    }

    // Not inside anything — detect openers
    if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (c === '@' && next === '"') { inVerbatim = true; i++; continue; }
    if ((c === '$' && next === '"') || (c === '$' && code[i + 1] === '@')) {
      // Interpolated strings — treat as regular string for our purposes
      // (the $ prefix doesn't change quote matching)
      continue;
    }
    if (c === '"' && prev !== '\\') { inString = true; continue; }
    if (c === "'" && prev !== '\\') { inChar = true; continue; }
  }

  return inString || inVerbatim || inChar || inLineComment || inBlockComment;
}

/** Create a quick-fix action that replaces text at the diagnostic range. */
export function quickFix(name: string, replacement: string): Action {
  return {
    name,
    apply(view: EditorView, from: number, to: number) {
      view.dispatch({ changes: { from, to, insert: replacement } });
    },
  };
}

/** Create a quick-fix action that inserts text at the `to` position. */
export function quickFixInsert(name: string, insert: string): Action {
  return {
    name,
    apply(view: EditorView, _from: number, to: number) {
      view.dispatch({ changes: { from: to, to, insert } });
    },
  };
}

/** Create a quick-fix action that removes the diagnostic range. */
export function quickFixRemove(name: string): Action {
  return {
    name,
    apply(view: EditorView, from: number, to: number) {
      view.dispatch({ changes: { from, to, insert: '' } });
    },
  };
}

/** Cap diagnostics at MAX_DIAGNOSTICS, prioritizing errors > warnings > info. */
export function truncateDiagnostics(diags: Diagnostic[]): Diagnostic[] {
  if (diags.length <= MAX_DIAGNOSTICS) return diags;

  const priority: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const sorted = [...diags].sort((a, b) => {
    const pa = priority[a.severity] ?? 3;
    const pb = priority[b.severity] ?? 3;
    if (pa !== pb) return pa - pb;
    return a.from - b.from;
  });

  return sorted.slice(0, MAX_DIAGNOSTICS);
}
