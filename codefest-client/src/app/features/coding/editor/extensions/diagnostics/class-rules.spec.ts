import { classRules } from './class-rules';
import { makeCtx } from '../test-helpers';
import { buildSymbolTable } from '../symbol-table';

function runClassRules(code: string) {
  const ctx = makeCtx(code);
  const symbols = buildSymbolTable(ctx);
  return classRules(ctx, symbols);
}

describe('class-rules', () => {

  // ── CF210: Main without static ────────────────────────────────────

  describe('CF210 - Main without static', () => {
    it('should flag void Main() without static', () => {
      const code = 'class Program {\n  void Main(string[] args) {\n  }\n}';
      const diags = runClassRules(code);
      expect(diags.some(d => d.source?.includes('CF210'))).toBe(true);
      expect(diags.some(d => d.message.includes('static'))).toBe(true);
    });

    it('should not flag static void Main()', () => {
      const code = 'class Program {\n  static void Main(string[] args) {\n  }\n}';
      const diags = runClassRules(code);
      expect(diags.some(d => d.source?.includes('CF210'))).toBe(false);
    });
  });

  // ── CF213: Multiple Main methods ──────────────────────────────────

  describe('CF213 - Multiple Main methods', () => {
    it('should flag multiple Main methods', () => {
      const code = 'class A {\n  static void Main() { }\n}\nclass B {\n  static void Main() { }\n}';
      const diags = runClassRules(code);
      expect(diags.some(d => d.source?.includes('CF213'))).toBe(true);
    });
  });

  // ── CF220: Duplicate access modifiers ─────────────────────────────

  describe('CF220 - Duplicate access modifiers', () => {
    it('should flag public private', () => {
      const diags = runClassRules('public private void Foo() { }');
      expect(diags.some(d => d.source?.includes('CF220'))).toBe(true);
    });

    it('should not flag single modifier', () => {
      const diags = runClassRules('public void Foo() { }');
      expect(diags.some(d => d.source?.includes('CF220'))).toBe(false);
    });
  });

  // ── CF216: Constructor with return type ───────────────────────────

  describe('CF216 - Constructor with return type', () => {
    it('should flag void ClassName()', () => {
      const code = 'class MyClass {\n  void MyClass() {\n  }\n}';
      const diags = runClassRules(code);
      expect(diags.some(d => d.source?.includes('CF216'))).toBe(true);
      expect(diags.some(d => d.message.includes("don't have a return type"))).toBe(true);
    });

    it('should not flag constructor without return type', () => {
      const code = 'class MyClass {\n  MyClass() {\n  }\n}';
      const diags = runClassRules(code);
      expect(diags.some(d => d.source?.includes('CF216'))).toBe(false);
    });
  });

  // ── False Positives ───────────────────────────────────────────────

  describe('false positives', () => {
    it('should not flag normal method as Main issue', () => {
      const code = 'class Program {\n  public void Foo() { }\n}';
      const diags = runClassRules(code);
      expect(diags.some(d => d.source?.includes('CF210'))).toBe(false);
    });
  });
});
