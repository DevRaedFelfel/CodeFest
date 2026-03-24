import { typeRules } from './type-rules';
import { makeCtx } from '../test-helpers';
import { buildSymbolTable } from '../symbol-table';

function runTypeRules(code: string) {
  const ctx = makeCtx(code);
  const symbols = buildSymbolTable(ctx);
  return typeRules(ctx, symbols);
}

describe('type-rules', () => {

  // ── CF130: int = "string" ─────────────────────────────────────────

  describe('CF130 - String assigned to int', () => {
    it('should flag int x = "hello";', () => {
      const diags = runTypeRules('int x = "hello";');
      expect(diags.some(d => d.source?.includes('CF130'))).toBe(true);
    });

    it('should not flag int x = 5;', () => {
      const diags = runTypeRules('int x = 5;');
      expect(diags.some(d => d.source?.includes('CF130'))).toBe(false);
    });
  });

  // ── CF131: string = 42 ───────────────────────────────────────────

  describe('CF131 - Number assigned to string', () => {
    it('should flag string s = 42;', () => {
      const diags = runTypeRules('string s = 42;');
      expect(diags.some(d => d.source?.includes('CF131'))).toBe(true);
      expect(diags.some(d => d.message.includes('ToString()'))).toBe(true);
    });
  });

  // ── CF132: int = true ────────────────────────────────────────────

  describe('CF132 - Bool assigned to int', () => {
    it('should flag int x = true;', () => {
      const diags = runTypeRules('int x = true;');
      expect(diags.some(d => d.source?.includes('CF132'))).toBe(true);
    });
  });

  // ── CF133: bool = 0 ──────────────────────────────────────────────

  describe('CF133 - Int assigned to bool', () => {
    it('should flag bool b = 0;', () => {
      const diags = runTypeRules('bool b = 0;');
      expect(diags.some(d => d.source?.includes('CF133'))).toBe(true);
      expect(diags.some(d => d.message.includes('true'))).toBe(true);
    });

    it('should flag bool b = 1;', () => {
      const diags = runTypeRules('bool b = 1;');
      expect(diags.some(d => d.source?.includes('CF133'))).toBe(true);
    });
  });

  // ── CF135-CF136: Console.ReadLine() to non-string ─────────────────

  describe('CF135 - ReadLine to int', () => {
    it('should flag int x = Console.ReadLine();', () => {
      const diags = runTypeRules('int x = Console.ReadLine();');
      expect(diags.some(d => d.source?.includes('CF135'))).toBe(true);
      expect(diags.some(d => d.message.includes('int.Parse'))).toBe(true);
    });
  });

  describe('CF136 - ReadLine to double', () => {
    it('should flag double d = Console.ReadLine();', () => {
      const diags = runTypeRules('double d = Console.ReadLine();');
      expect(diags.some(d => d.source?.includes('CF136'))).toBe(true);
      expect(diags.some(d => d.message.includes('double.Parse'))).toBe(true);
    });
  });

  // ── CF152: Non-boolean in condition ───────────────────────────────

  describe('CF152 - Numeric literal in condition', () => {
    it('should flag while(1)', () => {
      const diags = runTypeRules('while (1) { }');
      expect(diags.some(d => d.source?.includes('CF152'))).toBe(true);
      expect(diags.some(d => d.message.includes('true'))).toBe(true);
    });

    it('should not flag while(true)', () => {
      const diags = runTypeRules('while (true) { }');
      expect(diags.some(d => d.source?.includes('CF152'))).toBe(false);
    });
  });

  // ── CF155: Parse with wrong arg type ──────────────────────────────

  describe('CF155 - Parse with numeric literal', () => {
    it('should flag int.Parse(42)', () => {
      const diags = runTypeRules('int.Parse(42);');
      expect(diags.some(d => d.source?.includes('CF155'))).toBe(true);
      expect(diags.some(d => d.message.includes('already have'))).toBe(true);
    });

    it('should not flag int.Parse("42")', () => {
      const diags = runTypeRules('int.Parse("42");');
      expect(diags.some(d => d.source?.includes('CF155'))).toBe(false);
    });
  });

  // ── CF141: void method returning value ────────────────────────────

  describe('CF141 - Void method returning value', () => {
    it('should flag return 5; in void method', () => {
      const code = 'void Foo() {\n  return 5;\n}';
      const diags = runTypeRules(code);
      expect(diags.some(d => d.source?.includes('CF141'))).toBe(true);
    });

    it('should not flag return; in void method', () => {
      const code = 'void Foo() {\n  return;\n}';
      const diags = runTypeRules(code);
      expect(diags.some(d => d.source?.includes('CF141'))).toBe(false);
    });
  });

  // ── CF142: Non-void method with no return ─────────────────────────

  describe('CF142 - Missing return in non-void method', () => {
    it('should flag int method without return', () => {
      const code = 'int Foo() {\n  Console.WriteLine("hi");\n}';
      const diags = runTypeRules(code);
      expect(diags.some(d => d.source?.includes('CF142'))).toBe(true);
    });

    it('should not flag int method with return', () => {
      const code = 'int Foo() {\n  return 5;\n}';
      const diags = runTypeRules(code);
      expect(diags.some(d => d.source?.includes('CF142'))).toBe(false);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag string s = "hello";', () => {
      const diags = runTypeRules('string s = "hello";');
      expect(diags.length).toBe(0);
    });

    it('should not flag int x = 42;', () => {
      const diags = runTypeRules('int x = 42;');
      expect(diags.length).toBe(0);
    });

    it('should not flag bool b = true;', () => {
      const diags = runTypeRules('bool b = true;');
      expect(diags.length).toBe(0);
    });
  });
});
