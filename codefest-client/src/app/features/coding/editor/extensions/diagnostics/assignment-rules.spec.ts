import { assignmentRules } from './assignment-rules';
import { makeCtx, hasDiagnostic, hasMessageContaining } from '../test-helpers';
import { buildSymbolTable } from '../symbol-table';

describe('assignment-rules', () => {

  // ── CF110: Assignment in if condition ──────────────────────────────

  describe('CF110 - Assignment in if condition', () => {
    it('should flag = in if condition', () => {
      const diags = assignmentRules(makeCtx('if (x = 5) { }'));
      expect(hasDiagnostic(diags, 'CF110')).toBe(true);
      expect(hasMessageContaining(diags, '`==`')).toBe(true);
    });

    it('should not flag == in if condition', () => {
      const diags = assignmentRules(makeCtx('if (x == 5) { }'));
      expect(hasDiagnostic(diags, 'CF110')).toBe(false);
    });

    it('should not flag != in if condition', () => {
      const diags = assignmentRules(makeCtx('if (x != 5) { }'));
      expect(hasDiagnostic(diags, 'CF110')).toBe(false);
    });

    it('should not flag <= in if condition', () => {
      const diags = assignmentRules(makeCtx('if (x <= 5) { }'));
      expect(hasDiagnostic(diags, 'CF110')).toBe(false);
    });

    it('should not flag >= in if condition', () => {
      const diags = assignmentRules(makeCtx('if (x >= 5) { }'));
      expect(hasDiagnostic(diags, 'CF110')).toBe(false);
    });
  });

  // ── CF111: Assignment in while condition ──────────────────────────

  describe('CF111 - Assignment in while condition', () => {
    it('should flag = in while condition', () => {
      const diags = assignmentRules(makeCtx('while (x = 5) { }'));
      expect(hasDiagnostic(diags, 'CF111')).toBe(true);
    });
  });

  // ── CF112: == used as statement ───────────────────────────────────

  describe('CF112 - Comparison as statement', () => {
    it('should flag x == 5; as standalone statement', () => {
      const diags = assignmentRules(makeCtx('x == 5;'));
      expect(hasDiagnostic(diags, 'CF112')).toBe(true);
      expect(hasMessageContaining(diags, '`=`')).toBe(true);
    });

    it('should not flag == inside if/return', () => {
      const diags = assignmentRules(makeCtx('if (x == 5) { }'));
      expect(hasDiagnostic(diags, 'CF112')).toBe(false);
    });

    it('should not flag return x == 5;', () => {
      const diags = assignmentRules(makeCtx('return x == 5;'));
      expect(hasDiagnostic(diags, 'CF112')).toBe(false);
    });
  });

  // ── CF113: != used as statement ───────────────────────────────────

  describe('CF113 - != comparison as statement', () => {
    it('should flag x != 5; as standalone statement', () => {
      const diags = assignmentRules(makeCtx('x != 5;'));
      expect(hasDiagnostic(diags, 'CF113')).toBe(true);
    });
  });

  // ── CF124: Assignment to self ─────────────────────────────────────

  describe('CF124 - Self assignment', () => {
    it('should flag x = x;', () => {
      const diags = assignmentRules(makeCtx('x = x;'));
      expect(hasDiagnostic(diags, 'CF124')).toBe(true);
      expect(hasMessageContaining(diags, 'assigned to itself')).toBe(true);
    });

    it('should not flag x = y;', () => {
      const diags = assignmentRules(makeCtx('x = y;'));
      expect(hasDiagnostic(diags, 'CF124')).toBe(false);
    });

    it('should not flag x == x; (comparison, not assignment)', () => {
      const diags = assignmentRules(makeCtx('x == x;'));
      expect(hasDiagnostic(diags, 'CF124')).toBe(false);
    });
  });

  // ── CF121: var without initializer ────────────────────────────────

  describe('CF121 - var without initializer', () => {
    it('should flag var x;', () => {
      const ctx = makeCtx('var x;');
      const symbols = buildSymbolTable(ctx);
      const diags = assignmentRules(ctx, symbols);
      expect(hasDiagnostic(diags, 'CF121')).toBe(true);
    });

    it('should not flag var x = 5;', () => {
      const ctx = makeCtx('var x = 5;');
      const symbols = buildSymbolTable(ctx);
      const diags = assignmentRules(ctx, symbols);
      expect(hasDiagnostic(diags, 'CF121')).toBe(false);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag = inside string literal', () => {
      const diags = assignmentRules(makeCtx('if (x == "a = b") { }'));
      expect(hasDiagnostic(diags, 'CF110')).toBe(false);
    });

    it('should not flag normal assignment', () => {
      const diags = assignmentRules(makeCtx('int x = 5;'));
      expect(hasDiagnostic(diags, 'CF112')).toBe(false);
    });
  });
});
