import { structuralRules } from './structural-rules';
import { makeCtx, hasDiagnostic, hasMessageContaining } from '../test-helpers';

describe('structural-rules', () => {

  // ── Bracket Matching ──────────────────────────────────────────────

  describe('CF001 - Unmatched {', () => {
    it('should flag unclosed opening brace', () => {
      const diags = structuralRules(makeCtx('if (true) {\n  Console.WriteLine("hi");'));
      expect(hasDiagnostic(diags, 'CF001')).toBe(true);
    });

    it('should not flag balanced braces', () => {
      const diags = structuralRules(makeCtx('if (true) {\n  Console.WriteLine("hi");\n}'));
      expect(hasDiagnostic(diags, 'CF001')).toBe(false);
    });

    it('should not flag braces inside strings', () => {
      const diags = structuralRules(makeCtx('string s = "{ hello }";'));
      expect(hasDiagnostic(diags, 'CF001')).toBe(false);
      expect(hasDiagnostic(diags, 'CF002')).toBe(false);
    });
  });

  describe('CF002 - Extra }', () => {
    it('should flag unexpected closing brace', () => {
      const diags = structuralRules(makeCtx('Console.WriteLine("hi");\n}'));
      expect(hasDiagnostic(diags, 'CF002')).toBe(true);
    });
  });

  describe('CF003 - Unmatched (', () => {
    it('should flag unclosed parenthesis', () => {
      const diags = structuralRules(makeCtx('Console.WriteLine("hi"'));
      expect(hasDiagnostic(diags, 'CF003')).toBe(true);
    });
  });

  describe('CF004 - Extra )', () => {
    it('should flag unexpected closing parenthesis', () => {
      const diags = structuralRules(makeCtx('Console.WriteLine("hi"));'));
      expect(hasDiagnostic(diags, 'CF004')).toBe(true);
    });
  });

  describe('CF005 - Unmatched [', () => {
    it('should flag unclosed bracket', () => {
      const diags = structuralRules(makeCtx('int x = arr[0'));
      expect(hasDiagnostic(diags, 'CF005')).toBe(true);
    });
  });

  describe('CF006 - Extra ]', () => {
    it('should flag unexpected closing bracket', () => {
      const diags = structuralRules(makeCtx('int x = 5]'));
      expect(hasDiagnostic(diags, 'CF006')).toBe(true);
    });
  });

  describe('CF020 - Mismatched delimiters', () => {
    it('should flag ( closed by }', () => {
      const diags = structuralRules(makeCtx('if (true}'));
      expect(hasDiagnostic(diags, 'CF020')).toBe(true);
      expect(hasMessageContaining(diags, 'Mismatched delimiters')).toBe(true);
    });
  });

  // ── Semicolons ────────────────────────────────────────────────────

  describe('CF010 - Missing semicolons', () => {
    it('should flag missing semicolon after method call ending with )', () => {
      const diags = structuralRules(makeCtx('Console.WriteLine("hi")\nint x = 5;'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(true);
    });

    it('should not flag line ending with { or }', () => {
      const diags = structuralRules(makeCtx('if (true) {'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });

    it('should not flag comment lines', () => {
      const diags = structuralRules(makeCtx('// this is a comment'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });

    it('should not flag multi-line calls (next line starts with .)', () => {
      const diags = structuralRules(makeCtx('myList\n  .Where(x => x > 0)\n  .ToList();'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });

    it('should not flag method declarations', () => {
      const diags = structuralRules(makeCtx('static void Main(string[] args)\n{'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });

    it('should not flag if/else/for keywords', () => {
      const diags = structuralRules(makeCtx('if (true)\n{\n}'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });
  });

  describe('CF014 - Double semicolons', () => {
    it('should flag ;; outside for loop', () => {
      const diags = structuralRules(makeCtx('int x = 5;;'));
      expect(hasDiagnostic(diags, 'CF014')).toBe(true);
    });

    it('should not flag ;; inside for loop', () => {
      const diags = structuralRules(makeCtx('for (;;) { }'));
      expect(hasDiagnostic(diags, 'CF014')).toBe(false);
    });
  });

  // ── False Positive Checks ─────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag balanced nested braces', () => {
      const code = 'class Foo {\n  void Bar() {\n    if (true) {\n    }\n  }\n}';
      const diags = structuralRules(makeCtx(code));
      const bracketErrors = diags.filter(d => d.source?.match(/CF00[1-6]/));
      expect(bracketErrors.length).toBe(0);
    });

    it('should not flag braces inside comments', () => {
      const diags = structuralRules(makeCtx('// { this is a comment }'));
      const bracketErrors = diags.filter(d => d.source?.match(/CF00[1-6]/));
      expect(bracketErrors.length).toBe(0);
    });

    it('should not flag lines ending with comma (multi-line args)', () => {
      const diags = structuralRules(makeCtx('Console.WriteLine(\n  "hello",\n  "world"\n);'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });

    it('should not flag lines ending with => (lambda)', () => {
      const diags = structuralRules(makeCtx('var fn =>\n  5;'));
      expect(hasDiagnostic(diags, 'CF010')).toBe(false);
    });

    it('should not flag attribute syntax [Serializable]', () => {
      const diags = structuralRules(makeCtx('[Serializable]\nclass Foo { }'));
      const bracketErrors = diags.filter(d => d.source?.match(/CF00[5-6]/));
      expect(bracketErrors.length).toBe(0);
    });
  });
});
