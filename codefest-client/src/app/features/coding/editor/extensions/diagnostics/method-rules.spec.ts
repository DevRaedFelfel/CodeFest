import { methodRules } from './method-rules';
import { makeCtx, hasDiagnostic, hasMessageContaining } from '../test-helpers';

describe('method-rules', () => {

  // ── CF160-CF164: Missing parentheses on method calls ──────────────

  describe('CF160 - Missing () on Console methods', () => {
    it('should flag Console.ReadLine;', () => {
      const diags = methodRules(makeCtx('Console.ReadLine;'));
      expect(hasDiagnostic(diags, 'CF160')).toBe(true);
      expect(hasMessageContaining(diags, 'ReadLine()')).toBe(true);
    });

    it('should flag Console.WriteLine;', () => {
      const diags = methodRules(makeCtx('Console.WriteLine;'));
      expect(hasDiagnostic(diags, 'CF160')).toBe(true);
    });

    it('should not flag Console.ReadLine();', () => {
      const diags = methodRules(makeCtx('Console.ReadLine();'));
      expect(hasDiagnostic(diags, 'CF160')).toBe(false);
    });
  });

  describe('CF162 - Missing () on instance methods', () => {
    it('should flag .Add;', () => {
      const diags = methodRules(makeCtx('myList.Add;'));
      expect(hasDiagnostic(diags, 'CF162')).toBe(true);
    });

    it('should flag .Sort;', () => {
      const diags = methodRules(makeCtx('myList.Sort;'));
      expect(hasDiagnostic(diags, 'CF162')).toBe(true);
    });

    it('should flag .ToString;', () => {
      const diags = methodRules(makeCtx('x.ToString;'));
      expect(hasDiagnostic(diags, 'CF162')).toBe(true);
    });
  });

  // ── CF165-CF167: Property used as method ──────────────────────────

  describe('CF165 - Property as method', () => {
    it('should flag .Count()', () => {
      const diags = methodRules(makeCtx('int n = list.Count();'));
      expect(hasDiagnostic(diags, 'CF165')).toBe(true);
      expect(hasMessageContaining(diags, 'property, not a method')).toBe(true);
    });

    it('should flag .Length()', () => {
      const diags = methodRules(makeCtx('int n = arr.Length();'));
      expect(hasDiagnostic(diags, 'CF165')).toBe(true);
    });

    it('should not flag .Count without ()', () => {
      const diags = methodRules(makeCtx('int n = list.Count;'));
      expect(hasDiagnostic(diags, 'CF165')).toBe(false);
    });
  });

  // ── CF171-CF176: Wrong argument count ─────────────────────────────

  describe('CF171 - Math.Pow wrong args', () => {
    it('should flag Math.Pow(5) — too few args', () => {
      const diags = methodRules(makeCtx('Math.Pow(5);'));
      expect(hasDiagnostic(diags, 'CF171')).toBe(true);
    });

    it('should not flag Math.Pow(2, 3) — correct args', () => {
      const diags = methodRules(makeCtx('Math.Pow(2, 3);'));
      expect(hasDiagnostic(diags, 'CF171')).toBe(false);
    });

    it('should flag Math.Pow(1, 2, 3) — too many args', () => {
      const diags = methodRules(makeCtx('Math.Pow(1, 2, 3);'));
      expect(hasDiagnostic(diags, 'CF171')).toBe(true);
    });
  });

  describe('CF172 - Math.Sqrt wrong args', () => {
    it('should flag Math.Sqrt() — no args', () => {
      const diags = methodRules(makeCtx('Math.Sqrt();'));
      expect(hasDiagnostic(diags, 'CF172')).toBe(true);
    });

    it('should not flag Math.Sqrt(9) — correct', () => {
      const diags = methodRules(makeCtx('Math.Sqrt(9);'));
      expect(hasDiagnostic(diags, 'CF172')).toBe(false);
    });
  });

  describe('CF174 - Console.ReadLine with args', () => {
    it('should flag Console.ReadLine("prompt")', () => {
      const diags = methodRules(makeCtx('Console.ReadLine("prompt");'));
      expect(hasDiagnostic(diags, 'CF174')).toBe(true);
    });

    it('should not flag Console.ReadLine()', () => {
      const diags = methodRules(makeCtx('Console.ReadLine();'));
      expect(hasDiagnostic(diags, 'CF174')).toBe(false);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag methods inside string literals', () => {
      const diags = methodRules(makeCtx('string s = "Console.ReadLine;";'));
      expect(hasDiagnostic(diags, 'CF160')).toBe(false);
    });
  });
});
