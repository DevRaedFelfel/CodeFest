import { styleRules } from './style-rules';
import { makeCtx, hasDiagnostic, hasMessageContaining } from '../test-helpers';

describe('style-rules', () => {

  // ── CF241: Redundant bool comparison ──────────────────────────────

  describe('CF241 - x == true / x == false', () => {
    it('should flag x == true', () => {
      const diags = styleRules(makeCtx('if (done == true) { }'));
      expect(hasDiagnostic(diags, 'CF241')).toBe(true);
      expect(hasMessageContaining(diags, 'Redundant comparison')).toBe(true);
    });

    it('should flag x == false', () => {
      const diags = styleRules(makeCtx('if (done == false) { }'));
      expect(hasDiagnostic(diags, 'CF241')).toBe(true);
    });

    it('should not flag x == 5', () => {
      const diags = styleRules(makeCtx('if (x == 5) { }'));
      expect(hasDiagnostic(diags, 'CF241')).toBe(false);
    });
  });

  // ── CF248: Empty string comparison ────────────────────────────────

  describe('CF248 - Comparison with ""', () => {
    it('should suggest string.IsNullOrEmpty', () => {
      const diags = styleRules(makeCtx('if (name == "") { }'));
      expect(hasDiagnostic(diags, 'CF248')).toBe(true);
      expect(hasMessageContaining(diags, 'IsNullOrEmpty')).toBe(true);
    });
  });

  // ── CF247: ReadLine without null check ────────────────────────────

  describe('CF247 - ReadLine null safety', () => {
    it('should flag Console.ReadLine().ToLower()', () => {
      const diags = styleRules(makeCtx('string s = Console.ReadLine().ToLower();'));
      expect(hasDiagnostic(diags, 'CF247')).toBe(true);
    });

    it('should not flag Console.ReadLine()?.ToLower()', () => {
      const diags = styleRules(makeCtx('string s = Console.ReadLine()?.ToLower();'));
      expect(hasDiagnostic(diags, 'CF247')).toBe(false);
    });
  });

  // ── CF249: Long method ────────────────────────────────────────────

  describe('CF249 - Long method', () => {
    it('should flag method with more than 50 lines', () => {
      const lines = ['public static void LongMethod() {'];
      for (let i = 0; i < 55; i++) {
        lines.push(`  Console.WriteLine("line ${i}");`);
      }
      lines.push('}');
      const diags = styleRules(makeCtx(lines.join('\n')));
      expect(hasDiagnostic(diags, 'CF249')).toBe(true);
    });

    it('should not flag method with fewer than 50 lines', () => {
      const lines = ['public static void ShortMethod() {'];
      for (let i = 0; i < 10; i++) {
        lines.push(`  Console.WriteLine("line ${i}");`);
      }
      lines.push('}');
      const diags = styleRules(makeCtx(lines.join('\n')));
      expect(hasDiagnostic(diags, 'CF249')).toBe(false);
    });
  });

  // ── CF250: Deep nesting ───────────────────────────────────────────

  describe('CF250 - Deep nesting', () => {
    it('should flag code nested more than 4 levels', () => {
      const code = 'class A {\n  void B() {\n    if (true) {\n      if (true) {\n        if (true) {\n          Console.WriteLine("deep");\n        }\n      }\n    }\n  }\n}';
      const diags = styleRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF250')).toBe(true);
    });
  });

  // ── All style rules are info severity ─────────────────────────────

  describe('severity', () => {
    it('should only produce info/warning severity diagnostics', () => {
      const code = 'if (done == true) { }\nif (name == "") { }';
      const diags = styleRules(makeCtx(code));
      for (const d of diags) {
        expect(['info', 'warning']).toContain(d.severity);
      }
    });
  });
});
