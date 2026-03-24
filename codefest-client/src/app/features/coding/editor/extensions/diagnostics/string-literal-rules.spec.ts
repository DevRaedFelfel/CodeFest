import { stringLiteralRules } from './string-literal-rules';
import { makeCtx, hasDiagnostic, hasMessageContaining } from '../test-helpers';

describe('string-literal-rules', () => {

  // ── CF030: Unterminated string ────────────────────────────────────

  describe('CF030 - Unterminated string literal', () => {
    it('should flag unclosed double-quoted string', () => {
      const diags = stringLiteralRules(makeCtx('string s = "hello;'));
      expect(hasDiagnostic(diags, 'CF030')).toBe(true);
    });

    it('should not flag properly closed string', () => {
      const diags = stringLiteralRules(makeCtx('string s = "hello";'));
      expect(hasDiagnostic(diags, 'CF030')).toBe(false);
    });

    it('should not flag string with escaped quotes', () => {
      const diags = stringLiteralRules(makeCtx('string s = "he said \\"hi\\"";'));
      expect(hasDiagnostic(diags, 'CF030')).toBe(false);
    });

    it('should not flag empty string', () => {
      const diags = stringLiteralRules(makeCtx('string s = "";'));
      expect(hasDiagnostic(diags, 'CF030')).toBe(false);
    });

    it('should not flag comment lines', () => {
      const diags = stringLiteralRules(makeCtx('// string s = "unclosed'));
      expect(hasDiagnostic(diags, 'CF030')).toBe(false);
    });
  });

  // ── CF031: Unterminated verbatim string ───────────────────────────

  describe('CF031 - Unterminated verbatim string', () => {
    it('should flag unclosed verbatim string at end of file', () => {
      const diags = stringLiteralRules(makeCtx('string s = @"hello\nworld'));
      expect(hasDiagnostic(diags, 'CF031')).toBe(true);
    });

    it('should not flag properly closed verbatim string', () => {
      const diags = stringLiteralRules(makeCtx('string s = @"hello\nworld";'));
      expect(hasDiagnostic(diags, 'CF031')).toBe(false);
    });
  });

  // ── CF032: Unterminated char literal ──────────────────────────────

  describe('CF032 - Unterminated char literal', () => {
    it('should flag unclosed char literal', () => {
      const diags = stringLiteralRules(makeCtx("char c = 'A;"));
      expect(hasDiagnostic(diags, 'CF032')).toBe(true);
    });

    it('should not flag properly closed char literal', () => {
      const diags = stringLiteralRules(makeCtx("char c = 'A';"));
      expect(hasDiagnostic(diags, 'CF032')).toBe(false);
    });

    it('should not flag escaped char literal', () => {
      const diags = stringLiteralRules(makeCtx("char c = '\\n';"));
      expect(hasDiagnostic(diags, 'CF032')).toBe(false);
    });
  });

  // ── CF033: Empty char literal ─────────────────────────────────────

  describe('CF033 - Empty char literal', () => {
    it("should flag empty ''", () => {
      const diags = stringLiteralRules(makeCtx("char c = '';"));
      expect(hasDiagnostic(diags, 'CF033')).toBe(true);
      expect(hasMessageContaining(diags, 'Empty character literal')).toBe(true);
    });
  });

  // ── CF035: Missing $ prefix ───────────────────────────────────────

  describe('CF035 - Missing interpolation prefix', () => {
    it('should flag {variable} inside non-interpolated string', () => {
      const diags = stringLiteralRules(makeCtx('string s = "Hello {name}";'));
      expect(hasDiagnostic(diags, 'CF035')).toBe(true);
      expect(hasMessageContaining(diags, 'missing the `$` prefix')).toBe(true);
    });

    it('should not flag $"..." interpolated strings', () => {
      const diags = stringLiteralRules(makeCtx('string s = $"Hello {name}";'));
      expect(hasDiagnostic(diags, 'CF035')).toBe(false);
    });

    it('should not flag strings without braces', () => {
      const diags = stringLiteralRules(makeCtx('string s = "Hello world";'));
      expect(hasDiagnostic(diags, 'CF035')).toBe(false);
    });
  });

  // ── CF037: Empty {} in interpolated string ────────────────────────

  describe('CF037 - Empty interpolation', () => {
    it('should flag $"...{}..." with empty braces', () => {
      const diags = stringLiteralRules(makeCtx('string s = $"Hello {}";'));
      expect(hasDiagnostic(diags, 'CF037')).toBe(true);
    });

    it('should not flag $"...{name}..." with content in braces', () => {
      const diags = stringLiteralRules(makeCtx('string s = $"Hello {name}";'));
      expect(hasDiagnostic(diags, 'CF037')).toBe(false);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag interpolated string with format specifier', () => {
      const code = 'string s = $"{value:N2}";';
      const diags = stringLiteralRules(makeCtx(code));
      // Should not flag : as an error
      expect(diags.filter(d => d.severity === 'error').length).toBe(0);
    });

    it('should not flag multiple strings on one line', () => {
      const code = 'Console.WriteLine("hello" + " " + "world");';
      const diags = stringLiteralRules(makeCtx(code));
      expect(hasDiagnostic(diags, 'CF030')).toBe(false);
    });
  });
});
