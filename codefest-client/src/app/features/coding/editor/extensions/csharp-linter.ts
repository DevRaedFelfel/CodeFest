import { type Diagnostic } from '@codemirror/lint';
import { type EditorView } from '@codemirror/view';
import { buildContext, truncateDiagnostics } from './diagnostic-helpers';
import {
  structuralRules,
  stringLiteralRules,
  typoRules,
  assignmentRules,
  controlFlowRules,
  methodRules,
  typeRules,
  classRules,
  styleRules,
} from './diagnostics';
import { buildSymbolTable } from './symbol-table';

/**
 * C# client-side linter for CodeMirror.
 * Produces advisory diagnostics (squiggly underlines) — never blocks submission.
 *
 * Orchestrates modular rule sets and caps output at 50 diagnostics,
 * prioritizing errors over warnings over info.
 */
export function csharpLinter(view: EditorView): Diagnostic[] {
  const code = view.state.doc.toString();

  // Short-circuit: empty or trivial documents
  if (code.trim().length < 3) return [];

  const ctx = buildContext(code, view.state.doc);
  const symbols = buildSymbolTable(ctx);

  const diagnostics: Diagnostic[] = [
    // Phase 1: structural checks (brackets, semicolons)
    ...structuralRules(ctx),
    // Phase 1: unclosed strings, interpolation errors
    ...stringLiteralRules(ctx),
    // Phase 1+2: typos, case-sensitivity, keyword casing
    ...typoRules(ctx),
    // Phase 1+3: assignment confusion, uninitialized vars
    ...assignmentRules(ctx, symbols),
    // Phase 1+2+3: control flow, suspicious patterns, unreachable code
    ...controlFlowRules(ctx),
    // Phase 2: method calls, missing parens, wrong arg count
    ...methodRules(ctx),
    // Phase 3: type mismatches, parse errors, return types
    ...typeRules(ctx, symbols),
    // Phase 3: Main/static, constructors, access modifiers
    ...classRules(ctx, symbols),
    // Phase 3: style hints, best practices
    ...styleRules(ctx),
  ];

  return truncateDiagnostics(diagnostics);
}
