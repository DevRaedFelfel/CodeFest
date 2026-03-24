import { Text } from '@codemirror/state';
import {
  buildContext,
  posOf,
  isInsideString,
  isInsideStringOrComment,
  truncateDiagnostics,
  MAX_DIAGNOSTICS,
} from './diagnostic-helpers';
import { type Diagnostic } from '@codemirror/lint';

describe('diagnostic-helpers', () => {

  describe('buildContext', () => {
    it('should split lines and compute offsets', () => {
      const code = 'line1\nline2\nline3';
      const doc = Text.of(code.split('\n'));
      const ctx = buildContext(code, doc);

      expect(ctx.lines.length).toBe(3);
      expect(ctx.lineOffsets).toEqual([0, 6, 12]);
      expect(ctx.code).toBe(code);
    });

    it('should handle empty document', () => {
      const code = '';
      const doc = Text.of(['']);
      const ctx = buildContext(code, doc);

      expect(ctx.lines.length).toBe(1);
      expect(ctx.lineOffsets).toEqual([0]);
    });

    it('should handle single line', () => {
      const code = 'int x = 5;';
      const doc = Text.of([code]);
      const ctx = buildContext(code, doc);

      expect(ctx.lines.length).toBe(1);
      expect(ctx.lineOffsets).toEqual([0]);
    });
  });

  describe('posOf', () => {
    it('should calculate absolute position from line + col', () => {
      const code = 'abc\ndef\nghi';
      const doc = Text.of(code.split('\n'));
      const ctx = buildContext(code, doc);

      expect(posOf(ctx, 0, 0)).toBe(0);
      expect(posOf(ctx, 0, 2)).toBe(2);
      expect(posOf(ctx, 1, 0)).toBe(4);
      expect(posOf(ctx, 1, 1)).toBe(5);
      expect(posOf(ctx, 2, 0)).toBe(8);
    });
  });

  describe('isInsideString', () => {
    it('should detect position inside double-quoted string', () => {
      const line = 'string s = "hello world";';
      expect(isInsideString(line, 13)).toBe(true);  // inside "hello
      expect(isInsideString(line, 5)).toBe(false);   // before string
    });

    it('should handle escaped quotes', () => {
      const line = 'string s = "he said \\"hi\\"";';
      expect(isInsideString(line, 15)).toBe(true);  // inside string
    });

    it('should return false after closing quote', () => {
      const line = '"hello" + "world"';
      expect(isInsideString(line, 8)).toBe(false);  // between strings
    });
  });

  describe('isInsideStringOrComment', () => {
    it('should detect position inside line comment', () => {
      const code = 'int x = 5; // this is a comment';
      expect(isInsideStringOrComment(code, 15)).toBe(true);
    });

    it('should detect position inside block comment', () => {
      const code = 'int x = /* comment */ 5;';
      expect(isInsideStringOrComment(code, 12)).toBe(true);
      expect(isInsideStringOrComment(code, 22)).toBe(false);
    });

    it('should detect position inside string literal', () => {
      const code = 'Console.WriteLine("hello");';
      expect(isInsideStringOrComment(code, 20)).toBe(true);
      expect(isInsideStringOrComment(code, 5)).toBe(false);
    });

    it('should detect position inside verbatim string', () => {
      const code = 'string s = @"multi\nline";';
      expect(isInsideStringOrComment(code, 15)).toBe(true);
    });

    it('should detect position inside char literal', () => {
      const code = "char c = 'A';";
      expect(isInsideStringOrComment(code, 10)).toBe(true);
      expect(isInsideStringOrComment(code, 5)).toBe(false);
    });
  });

  describe('truncateDiagnostics', () => {
    it('should return as-is when under limit', () => {
      const diags: Diagnostic[] = [
        { from: 0, to: 1, severity: 'error', message: 'err1' },
        { from: 2, to: 3, severity: 'warning', message: 'warn1' },
      ];
      expect(truncateDiagnostics(diags).length).toBe(2);
    });

    it('should cap at MAX_DIAGNOSTICS and prioritize errors', () => {
      const diags: Diagnostic[] = [];
      // Add 30 info, 20 warnings, 10 errors
      for (let i = 0; i < 30; i++) {
        diags.push({ from: i, to: i + 1, severity: 'info', message: `info${i}` });
      }
      for (let i = 0; i < 20; i++) {
        diags.push({ from: i + 30, to: i + 31, severity: 'warning', message: `warn${i}` });
      }
      for (let i = 0; i < 10; i++) {
        diags.push({ from: i + 50, to: i + 51, severity: 'error', message: `err${i}` });
      }

      const result = truncateDiagnostics(diags);
      expect(result.length).toBe(MAX_DIAGNOSTICS);

      // All 10 errors should be included
      const errors = result.filter(d => d.severity === 'error');
      expect(errors.length).toBe(10);

      // All 20 warnings should be included
      const warnings = result.filter(d => d.severity === 'warning');
      expect(warnings.length).toBe(20);

      // Only 20 of 30 info should fit
      const infos = result.filter(d => d.severity === 'info');
      expect(infos.length).toBe(20);
    });
  });
});
