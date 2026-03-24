/**
 * Shared test utilities for diagnostic rule unit tests.
 * Creates LintContext from raw code strings without needing a full CodeMirror editor.
 */
import { Text } from '@codemirror/state';
import { type Diagnostic } from '@codemirror/lint';
import { buildContext, type LintContext } from './diagnostic-helpers';

/** Build a LintContext from a raw code string (for unit tests). */
export function makeCtx(code: string): LintContext {
  const doc = Text.of(code.split('\n'));
  return buildContext(code, doc);
}

/** Check if diagnostics contain a diagnostic with a given source rule ID. */
export function hasDiagnostic(diags: Diagnostic[], ruleId: string): boolean {
  return diags.some(d => d.source?.includes(ruleId));
}

/** Get diagnostics matching a specific rule ID. */
export function getDiagnostics(diags: Diagnostic[], ruleId: string): Diagnostic[] {
  return diags.filter(d => d.source?.includes(ruleId));
}

/** Check if any diagnostic message contains the given text. */
export function hasMessageContaining(diags: Diagnostic[], text: string): boolean {
  return diags.some(d => d.message.includes(text));
}
