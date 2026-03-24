import { buildSymbolTable } from './symbol-table';
import { makeCtx } from './test-helpers';

describe('symbol-table', () => {

  describe('variable tracking', () => {
    it('should track explicit int declaration', () => {
      const ctx = makeCtx('int x = 5;');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('x')).toBe(true);
      expect(st.variables.get('x')!.type).toBe('int');
      expect(st.variables.get('x')!.initialized).toBe(true);
    });

    it('should track explicit string declaration', () => {
      const ctx = makeCtx('string name = "Ali";');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('name')).toBe(true);
      expect(st.variables.get('name')!.type).toBe('string');
    });

    it('should track uninitialized declaration', () => {
      const ctx = makeCtx('int x;');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('x')).toBe(true);
      expect(st.variables.get('x')!.initialized).toBe(false);
    });

    it('should track var with new Type()', () => {
      const ctx = makeCtx('var rng = new Random();');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('rng')).toBe(true);
      expect(st.variables.get('rng')!.type).toBe('Random');
    });

    it('should track var with new List<int>()', () => {
      const ctx = makeCtx('var nums = new List<int>();');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('nums')).toBe(true);
      expect(st.variables.get('nums')!.type).toBe('List<int>');
    });

    it('should track var = Console.ReadLine() as string', () => {
      const ctx = makeCtx('var input = Console.ReadLine();');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('input')).toBe(true);
      expect(st.variables.get('input')!.type).toBe('string');
    });

    it('should track var = int.Parse() as int', () => {
      const ctx = makeCtx('var num = int.Parse(s);');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('num')).toBe(true);
      expect(st.variables.get('num')!.type).toBe('int');
    });

    it('should infer int from numeric literal', () => {
      const ctx = makeCtx('var x = 42;');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('x')).toBe(true);
      expect(st.variables.get('x')!.type).toBe('int');
    });

    it('should infer double from decimal literal', () => {
      const ctx = makeCtx('var x = 3.14;');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('x')).toBe(true);
      expect(st.variables.get('x')!.type).toBe('double');
    });

    it('should infer string from string literal', () => {
      const ctx = makeCtx('var s = "hello";');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('s')).toBe(true);
      expect(st.variables.get('s')!.type).toBe('string');
    });

    it('should infer bool from true/false literal', () => {
      const ctx = makeCtx('var b = true;');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('b')).toBe(true);
      expect(st.variables.get('b')!.type).toBe('bool');
    });

    it('should track for loop variable', () => {
      const ctx = makeCtx('for (int i = 0; i < 10; i++) { }');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('i')).toBe(true);
      expect(st.variables.get('i')!.type).toBe('int');
    });

    it('should track foreach variable', () => {
      const ctx = makeCtx('foreach (var item in list) { }');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('item')).toBe(true);
    });
  });

  describe('method tracking', () => {
    it('should track method declaration', () => {
      const ctx = makeCtx('static void Main(string[] args) { }');
      const st = buildSymbolTable(ctx);
      expect(st.methods.has('Main')).toBe(true);
      expect(st.methods.get('Main')![0].returnType).toBe('void');
      expect(st.methods.get('Main')![0].isStatic).toBe(true);
    });

    it('should track method return type', () => {
      const ctx = makeCtx('int Add(int a, int b) { return a + b; }');
      const st = buildSymbolTable(ctx);
      expect(st.methods.has('Add')).toBe(true);
      expect(st.methods.get('Add')![0].returnType).toBe('int');
    });

    it('should register method parameters as variables', () => {
      const ctx = makeCtx('void Greet(string name, int age) { }');
      const st = buildSymbolTable(ctx);
      expect(st.variables.has('name')).toBe(true);
      expect(st.variables.get('name')!.type).toBe('string');
      expect(st.variables.has('age')).toBe(true);
      expect(st.variables.get('age')!.type).toBe('int');
    });
  });

  describe('class tracking', () => {
    it('should detect current class name', () => {
      const ctx = makeCtx('class Program {\n  static void Main() { }\n}');
      const st = buildSymbolTable(ctx);
      expect(st.currentClass).toBe('Program');
    });
  });

  describe('usage tracking', () => {
    it('should track variable usage on different lines', () => {
      const code = 'int x = 5;\nConsole.WriteLine(x);\nx = 10;';
      const ctx = makeCtx(code);
      const st = buildSymbolTable(ctx);
      expect(st.variables.get('x')!.usedLines.length).toBeGreaterThan(0);
    });

    it('should not count declaration line as usage', () => {
      const code = 'int x = 5;';
      const ctx = makeCtx(code);
      const st = buildSymbolTable(ctx);
      expect(st.variables.get('x')!.usedLines.length).toBe(0);
    });
  });
});
