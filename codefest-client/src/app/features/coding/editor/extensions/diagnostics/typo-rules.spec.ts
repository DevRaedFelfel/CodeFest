import { typoRules } from './typo-rules';
import { makeCtx, hasMessageContaining } from '../test-helpers';

describe('typo-rules', () => {

  // ── Class Name Typos ──────────────────────────────────────────────

  describe('Console typos', () => {
    it('should flag lowercase console', () => {
      const diags = typoRules(makeCtx('console.WriteLine("hi");'));
      expect(hasMessageContaining(diags, 'Console')).toBe(true);
    });

    it('should flag CONSOLE', () => {
      const diags = typoRules(makeCtx('CONSOLE.WriteLine("hi");'));
      expect(hasMessageContaining(diags, 'Console')).toBe(true);
    });

    it('should flag Consle (misspelling)', () => {
      const diags = typoRules(makeCtx('Consle.WriteLine("hi");'));
      expect(hasMessageContaining(diags, 'Console')).toBe(true);
    });

    it('should not flag correct Console', () => {
      const diags = typoRules(makeCtx('Console.WriteLine("hi");'));
      const consoleErrors = diags.filter(d => d.message.includes('Did you mean `Console`'));
      expect(consoleErrors.length).toBe(0);
    });
  });

  describe('Math typos', () => {
    it('should flag lowercase math', () => {
      const diags = typoRules(makeCtx('math.Pow(2, 3);'));
      expect(hasMessageContaining(diags, 'Math')).toBe(true);
    });
  });

  describe('Convert typos', () => {
    it('should flag lowercase convert', () => {
      const diags = typoRules(makeCtx('convert.ToInt32("5");'));
      expect(hasMessageContaining(diags, 'Convert')).toBe(true);
    });
  });

  // ── Method Name Typos ─────────────────────────────────────────────

  describe('Method name typos', () => {
    it('should flag Writeline → WriteLine', () => {
      const diags = typoRules(makeCtx('Console.Writeline("hi");'));
      expect(hasMessageContaining(diags, 'WriteLine')).toBe(true);
    });

    it('should flag writeline → WriteLine', () => {
      const diags = typoRules(makeCtx('Console.writeline("hi");'));
      expect(hasMessageContaining(diags, 'WriteLine')).toBe(true);
    });

    it('should flag Readline → ReadLine', () => {
      const diags = typoRules(makeCtx('Console.Readline();'));
      expect(hasMessageContaining(diags, 'ReadLine')).toBe(true);
    });

    it('should flag lenght → Length', () => {
      const diags = typoRules(makeCtx('int x = s.lenght;'));
      expect(hasMessageContaining(diags, 'Length')).toBe(true);
    });

    it('should flag tostring → ToString', () => {
      const diags = typoRules(makeCtx('string s = x.tostring();'));
      expect(hasMessageContaining(diags, 'ToString')).toBe(true);
    });

    it('should flag parseInt (JavaScript habit)', () => {
      const diags = typoRules(makeCtx('int x = parseInt("5");'));
      expect(hasMessageContaining(diags, 'int.Parse')).toBe(true);
    });
  });

  // ── Keyword Casing ────────────────────────────────────────────────

  describe('Keyword casing', () => {
    it('should flag If → if', () => {
      const diags = typoRules(makeCtx('If (true) { }'));
      expect(hasMessageContaining(diags, 'keywords are lowercase')).toBe(true);
    });

    it('should flag Else → else', () => {
      const diags = typoRules(makeCtx('} Else {'));
      expect(hasMessageContaining(diags, 'keywords are lowercase')).toBe(true);
    });

    it('should flag True → true', () => {
      const diags = typoRules(makeCtx('bool b = True;'));
      expect(hasMessageContaining(diags, 'lowercase `true`')).toBe(true);
    });

    it('should flag False → false', () => {
      const diags = typoRules(makeCtx('bool b = False;'));
      expect(hasMessageContaining(diags, 'lowercase `false`')).toBe(true);
    });

    it('should flag NULL → null', () => {
      const diags = typoRules(makeCtx('string s = NULL;'));
      expect(hasMessageContaining(diags, 'null')).toBe(true);
    });

    it('should flag Var → var', () => {
      const diags = typoRules(makeCtx('Var x = 5;'));
      expect(hasMessageContaining(diags, 'var')).toBe(true);
    });
  });

  // ── Type Alias Preferences ────────────────────────────────────────

  describe('Type alias preferences', () => {
    it('should suggest string instead of String (info)', () => {
      const diags = typoRules(makeCtx('String name = "Ali";'));
      const infos = diags.filter(d => d.severity === 'info' && d.message.includes('string'));
      expect(infos.length).toBeGreaterThan(0);
    });

    it('should suggest int instead of Int32 (info)', () => {
      const diags = typoRules(makeCtx('Int32 x = 5;'));
      expect(hasMessageContaining(diags, 'int')).toBe(true);
    });

    it('should suggest bool instead of Boolean (info)', () => {
      const diags = typoRules(makeCtx('Boolean b = true;'));
      expect(hasMessageContaining(diags, 'bool')).toBe(true);
    });
  });

  // ── Main Method Casing ────────────────────────────────────────────

  describe('Main method casing', () => {
    it('should flag void main(', () => {
      const diags = typoRules(makeCtx('void main(string[] args) { }'));
      expect(hasMessageContaining(diags, 'Main')).toBe(true);
    });

    it('should flag static void main(', () => {
      const diags = typoRules(makeCtx('static void main(string[] args) { }'));
      expect(hasMessageContaining(diags, 'Main')).toBe(true);
    });

    it('should not flag correct static void Main(', () => {
      const diags = typoRules(makeCtx('static void Main(string[] args) { }'));
      const mainErrors = diags.filter(d => d.message.includes('must be `Main`'));
      expect(mainErrors.length).toBe(0);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag typos inside string literals', () => {
      const diags = typoRules(makeCtx('string msg = "Use console.writeline to print";'));
      const errors = diags.filter(d => d.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('should not flag typos in comments', () => {
      const diags = typoRules(makeCtx('// console.writeline is wrong'));
      const errors = diags.filter(d => d.severity === 'error');
      expect(errors.length).toBe(0);
    });
  });
});
