import { controlFlowRules } from './control-flow-rules';
import { makeCtx, hasDiagnostic, hasMessageContaining } from '../test-helpers';

describe('control-flow-rules', () => {

  // ── CF180: foreach without in ─────────────────────────────────────

  describe('CF180 - foreach without in', () => {
    it('should flag foreach without in keyword', () => {
      const diags = controlFlowRules(makeCtx('foreach (var item collection) { }'));
      expect(hasDiagnostic(diags, 'CF180')).toBe(true);
    });

    it('should not flag correct foreach', () => {
      const diags = controlFlowRules(makeCtx('foreach (var item in collection) { }'));
      expect(hasDiagnostic(diags, 'CF180')).toBe(false);
    });
  });

  // ── CF204: Empty catch block ──────────────────────────────────────

  describe('CF204 - Empty catch block', () => {
    it('should flag empty catch block', () => {
      const diags = controlFlowRules(makeCtx('try { } catch { }'));
      expect(hasDiagnostic(diags, 'CF204')).toBe(true);
    });

    it('should flag empty catch with exception parameter', () => {
      const diags = controlFlowRules(makeCtx('try { } catch (Exception ex) { }'));
      expect(hasDiagnostic(diags, 'CF204')).toBe(true);
    });

    it('should not flag catch with body', () => {
      const diags = controlFlowRules(makeCtx('try { } catch (Exception ex) { Console.WriteLine(ex.Message); }'));
      expect(hasDiagnostic(diags, 'CF204')).toBe(false);
    });
  });

  // ── CF205: throw ex; ──────────────────────────────────────────────

  describe('CF205 - throw ex; instead of throw;', () => {
    it('should flag throw ex;', () => {
      const diags = controlFlowRules(makeCtx('throw ex;'));
      expect(hasDiagnostic(diags, 'CF205')).toBe(true);
      expect(hasMessageContaining(diags, 'throw;')).toBe(true);
    });

    it('should not flag throw new Exception()', () => {
      const diags = controlFlowRules(makeCtx('throw new Exception("error");'));
      expect(hasDiagnostic(diags, 'CF205')).toBe(false);
    });

    it('should not flag throw; (bare rethrow)', () => {
      const diags = controlFlowRules(makeCtx('throw;'));
      expect(hasDiagnostic(diags, 'CF205')).toBe(false);
    });
  });

  // ── CF200-CF203: Suspicious semicolons ────────────────────────────

  describe('CF200 - Suspicious semicolon after if', () => {
    it('should flag if (condition);', () => {
      const diags = controlFlowRules(makeCtx('if (true);'));
      expect(hasDiagnostic(diags, 'CF200')).toBe(true);
    });

    it('should not flag if (condition) {', () => {
      const diags = controlFlowRules(makeCtx('if (true) {\n}'));
      expect(hasDiagnostic(diags, 'CF200')).toBe(false);
    });
  });

  describe('CF201 - Suspicious semicolon after for', () => {
    it('should flag for (...);', () => {
      const diags = controlFlowRules(makeCtx('for (int i = 0; i < 10; i++);'));
      expect(hasDiagnostic(diags, 'CF201')).toBe(true);
    });
  });

  describe('CF202 - Suspicious semicolon after while', () => {
    it('should flag while (condition);', () => {
      const diags = controlFlowRules(makeCtx('while (true);'));
      expect(hasDiagnostic(diags, 'CF202')).toBe(true);
    });

    it('should not flag do-while pattern', () => {
      const diags = controlFlowRules(makeCtx('do {\n  x++;\n} while (x < 10);'));
      expect(hasDiagnostic(diags, 'CF202')).toBe(false);
    });
  });

  // ── CF188: case without break ─────────────────────────────────────

  describe('CF188 - case without break', () => {
    it('should flag case block without break/return', () => {
      const code = 'switch (x) {\n  case 1:\n    Console.WriteLine("one");\n  case 2:\n    break;\n}';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF188')).toBe(true);
    });

    it('should not flag case with break', () => {
      const code = 'switch (x) {\n  case 1:\n    Console.WriteLine("one");\n    break;\n  case 2:\n    break;\n}';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF188')).toBe(false);
    });

    it('should not flag case with return', () => {
      const code = 'switch (x) {\n  case 1:\n    return "one";\n  case 2:\n    return "two";\n}';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF188')).toBe(false);
    });
  });

  // ── CF190-CF193: Unreachable code ─────────────────────────────────

  describe('CF190 - Code after return', () => {
    it('should flag code after return statement', () => {
      const code = 'return 5;\nConsole.WriteLine("unreachable");';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF190')).toBe(true);
    });

    it('should not flag code after return when next line is }', () => {
      const code = 'return 5;\n}';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF190')).toBe(false);
    });
  });

  describe('CF191 - Code after break', () => {
    it('should flag code after break', () => {
      const code = 'break;\nConsole.WriteLine("unreachable");';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF191')).toBe(true);
    });
  });

  // ── CF181: else without if ────────────────────────────────────────

  describe('CF181 - else without if', () => {
    it('should not flag else after }', () => {
      const code = 'if (true) {\n  x++;\n}\nelse {\n  x--;\n}';
      const diags = controlFlowRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF181')).toBe(false);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag for (;;) as suspicious semicolon', () => {
      // for(;;) has semicolons inside the for header, not after )
      const diags = controlFlowRules(makeCtx('for (;;) { break; }'));
      expect(hasDiagnostic(diags, 'CF201')).toBe(false);
    });
  });
});
