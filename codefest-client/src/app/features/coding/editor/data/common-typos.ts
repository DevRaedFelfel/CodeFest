/**
 * Typo correction dictionary for C# class names, method names, and keywords.
 * Each entry: { pattern, correction, message, severity, isQuickFixReplace }.
 *
 * Phase 1: Top entries. Phase 2 expands the full list from spec §4.3.
 */

export interface TypoEntry {
  /** Regex to match the typo. Must capture the exact text to replace in group 0. */
  pattern: RegExp;
  /** Correct replacement text. */
  correction: string;
  /** Human-readable diagnostic message. */
  message: string;
  /** Diagnostic severity. */
  severity: 'error' | 'warning' | 'info';
}

// ── Class name typos (§4.3.1) ────────────────────────────────────────────

export const CLASS_NAME_TYPOS: TypoEntry[] = [
  // Console
  { pattern: /\bconsole\s*\./g, correction: 'Console.', message: 'C# is case-sensitive. Did you mean `Console`?', severity: 'error' },
  { pattern: /\bCONSOLE\s*\./g, correction: 'Console.', message: 'C# is case-sensitive. Did you mean `Console`?', severity: 'error' },
  { pattern: /\bConsle\s*\./g, correction: 'Console.', message: 'Did you mean `Console`? Check spelling.', severity: 'error' },
  { pattern: /\bConsolo\s*\./g, correction: 'Console.', message: 'Did you mean `Console`? Check spelling.', severity: 'error' },
  { pattern: /\bConole\s*\./g, correction: 'Console.', message: 'Did you mean `Console`? Check spelling.', severity: 'error' },
  { pattern: /\bConsoel\s*\./g, correction: 'Console.', message: 'Did you mean `Console`? Check spelling.', severity: 'error' },
  { pattern: /\bConosle\s*\./g, correction: 'Console.', message: 'Did you mean `Console`? Check spelling.', severity: 'error' },
  // Math
  { pattern: /\bmath\s*\./g, correction: 'Math.', message: 'C# is case-sensitive. Did you mean `Math`?', severity: 'error' },
  // Random
  { pattern: /\brandom\b(?=\s*[\s(])/g, correction: 'Random', message: 'C# is case-sensitive. Did you mean `Random`?', severity: 'error' },
  // Convert
  { pattern: /\bconvert\s*\./g, correction: 'Convert.', message: 'C# is case-sensitive. Did you mean `Convert`?', severity: 'error' },
  // Array
  { pattern: /\barray\s*\./g, correction: 'Array.', message: 'C# is case-sensitive. Did you mean `Array`?', severity: 'error' },
  // DateTime
  { pattern: /\bdatetime\b/gi, correction: 'DateTime', message: 'C# is case-sensitive. Did you mean `DateTime`?', severity: 'error' },

  // Type alias preferences (info severity)
  { pattern: /\bString\b(?!\s*\.)/g, correction: 'string', message: 'In C#, `string` and `String` are equivalent. `string` is preferred.', severity: 'info' },
  { pattern: /\bInt32\b/g, correction: 'int', message: '`Int32` works, but the alias `int` is preferred in C#.', severity: 'info' },
  { pattern: /\bBoolean\b/g, correction: 'bool', message: '`Boolean` works, but `bool` is preferred.', severity: 'info' },
  { pattern: /\bDouble\b(?!\s*\.)/g, correction: 'double', message: '`Double` works, but `double` is preferred.', severity: 'info' },
];

// ── Method name typos (§4.3.2) ───────────────────────────────────────────

export const METHOD_NAME_TYPOS: TypoEntry[] = [
  // Console methods
  { pattern: /\.Writeline\b/g, correction: '.WriteLine', message: 'C# is case-sensitive. Did you mean `WriteLine`?', severity: 'error' },
  { pattern: /\.writeline\b/g, correction: '.WriteLine', message: 'C# is case-sensitive. Did you mean `WriteLine`?', severity: 'error' },
  { pattern: /\.WRITELINE\b/g, correction: '.WriteLine', message: 'C# is case-sensitive. Did you mean `WriteLine`?', severity: 'error' },
  { pattern: /\.writeLine\b/g, correction: '.WriteLine', message: 'C# is case-sensitive. Did you mean `WriteLine`?', severity: 'error' },
  { pattern: /\.Writline\b/g, correction: '.WriteLine', message: 'Did you mean `WriteLine`? Check spelling.', severity: 'error' },
  { pattern: /\.WriteLines\b/g, correction: '.WriteLine', message: 'Did you mean `WriteLine`? (no \'s\')', severity: 'error' },
  { pattern: /\.Readline\b/g, correction: '.ReadLine', message: 'C# is case-sensitive. Did you mean `ReadLine`?', severity: 'error' },
  { pattern: /\.readline\b/g, correction: '.ReadLine', message: 'C# is case-sensitive. Did you mean `ReadLine`?', severity: 'error' },
  { pattern: /\.readLine\b/g, correction: '.ReadLine', message: 'C# is case-sensitive. Did you mean `ReadLine`?', severity: 'error' },
  { pattern: /\.Readine\b/g, correction: '.ReadLine', message: 'Did you mean `ReadLine`? Check spelling.', severity: 'error' },
  // Common member typos
  { pattern: /\.tostring\b/g, correction: '.ToString', message: 'C# is case-sensitive. Did you mean `ToString()`?', severity: 'error' },
  { pattern: /\.Tostring\b/g, correction: '.ToString', message: 'C# is case-sensitive. Did you mean `ToString()`?', severity: 'error' },
  { pattern: /\.toUpper\b/g, correction: '.ToUpper', message: 'C# is case-sensitive. Did you mean `ToUpper()`?', severity: 'error' },
  { pattern: /\.toupper\b/g, correction: '.ToUpper', message: 'C# is case-sensitive. Did you mean `ToUpper()`?', severity: 'error' },
  { pattern: /\.toLower\b/g, correction: '.ToLower', message: 'C# is case-sensitive. Did you mean `ToLower()`?', severity: 'error' },
  { pattern: /\.tolower\b/g, correction: '.ToLower', message: 'C# is case-sensitive. Did you mean `ToLower()`?', severity: 'error' },
  // Spelling errors
  { pattern: /\.lenght\b/gi, correction: '.Length', message: 'Did you mean `Length`? Check spelling.', severity: 'error' },
  { pattern: /\.legth\b/gi, correction: '.Length', message: 'Did you mean `Length`? Check spelling.', severity: 'error' },
  { pattern: /\.Lenght\b/g, correction: '.Length', message: 'Did you mean `Length`? Check spelling.', severity: 'error' },
  // Case-sensitivity on common members
  { pattern: /\.count\b(?!\s*\()/g, correction: '.Count', message: 'C# is case-sensitive. Did you mean `Count`?', severity: 'error' },
  { pattern: /\.indexof\b/gi, correction: '.IndexOf', message: 'C# is case-sensitive. Did you mean `IndexOf()`?', severity: 'error' },
  { pattern: /\.Indexof\b/g, correction: '.IndexOf', message: 'C# is case-sensitive. Did you mean `IndexOf()`?', severity: 'error' },
  { pattern: /\.contains\b/g, correction: '.Contains', message: 'C# is case-sensitive. Did you mean `Contains()`?', severity: 'error' },
  { pattern: /\.add\b/g, correction: '.Add', message: 'C# is case-sensitive. Did you mean `Add()`?', severity: 'error' },
  { pattern: /\.remove\b/g, correction: '.Remove', message: 'C# is case-sensitive. Did you mean `Remove()`?', severity: 'error' },
  { pattern: /\.sort\b/g, correction: '.Sort', message: 'C# is case-sensitive. Did you mean `Sort()`?', severity: 'error' },
  { pattern: /\.reverse\b/g, correction: '.Reverse', message: 'C# is case-sensitive. Did you mean `Reverse()`?', severity: 'error' },
  // Convert methods
  { pattern: /\.Toint32\b/g, correction: '.ToInt32', message: 'Did you mean `ToInt32`?', severity: 'error' },
  { pattern: /\.Todouble\b/g, correction: '.ToDouble', message: 'Did you mean `ToDouble`?', severity: 'error' },
  // JavaScript habits
  { pattern: /\bparseInt\s*\(/g, correction: 'int.Parse(', message: 'C# uses `int.Parse()`, not `parseInt()`. (That\'s JavaScript!)', severity: 'error' },
  { pattern: /\bparseFloat\s*\(/g, correction: 'double.Parse(', message: 'C# uses `double.Parse()`, not `parseFloat()`. (That\'s JavaScript!)', severity: 'error' },
];

// ── Keyword casing errors (§4.3.3) ───────────────────────────────────────

export const KEYWORD_CASING_TYPOS: TypoEntry[] = [
  { pattern: /\bIf\b(?=\s*\()/g, correction: 'if', message: 'C# keywords are lowercase. Did you mean `if`?', severity: 'error' },
  { pattern: /\bElse\b(?=\s*[{\n])/g, correction: 'else', message: 'C# keywords are lowercase. Did you mean `else`?', severity: 'error' },
  { pattern: /\bFor\b(?=\s*\()/g, correction: 'for', message: 'C# keywords are lowercase. Did you mean `for`?', severity: 'error' },
  { pattern: /\bForeach\b(?=\s*\()/g, correction: 'foreach', message: 'C# keywords are lowercase. Did you mean `foreach`?', severity: 'error' },
  { pattern: /\bForEach\b(?=\s*\()/g, correction: 'foreach', message: 'C# keywords are lowercase. Did you mean `foreach`?', severity: 'error' },
  { pattern: /\bWhile\b(?=\s*\()/g, correction: 'while', message: 'C# keywords are lowercase. Did you mean `while`?', severity: 'error' },
  { pattern: /\bReturn\b(?=[\s;])/g, correction: 'return', message: 'C# keywords are lowercase. Did you mean `return`?', severity: 'error' },
  { pattern: /\bVoid\b(?=\s)/g, correction: 'void', message: 'C# keywords are lowercase. Did you mean `void`?', severity: 'error' },
  { pattern: /\bVOID\b(?=\s)/g, correction: 'void', message: 'C# keywords are lowercase. Did you mean `void`?', severity: 'error' },
  { pattern: /\bClass\b(?=\s)/g, correction: 'class', message: 'C# keywords are lowercase. Did you mean `class`?', severity: 'error' },
  { pattern: /\bCLASS\b(?=\s)/g, correction: 'class', message: 'C# keywords are lowercase. Did you mean `class`?', severity: 'error' },
  { pattern: /\bNull\b/g, correction: 'null', message: 'C# keywords are lowercase. Did you mean `null`?', severity: 'error' },
  { pattern: /\bNULL\b/g, correction: 'null', message: 'C# keywords are lowercase. Did you mean `null`?', severity: 'error' },
  { pattern: /\bTrue\b/g, correction: 'true', message: 'C# uses lowercase `true`.', severity: 'error' },
  { pattern: /\bTRUE\b/g, correction: 'true', message: 'C# uses lowercase `true`.', severity: 'error' },
  { pattern: /\bFalse\b/g, correction: 'false', message: 'C# uses lowercase `false`.', severity: 'error' },
  { pattern: /\bFALSE\b/g, correction: 'false', message: 'C# uses lowercase `false`.', severity: 'error' },
  { pattern: /\bNew\b(?=\s+\w)/g, correction: 'new', message: 'C# keywords are lowercase. Did you mean `new`?', severity: 'error' },
  { pattern: /\bNEW\b(?=\s+\w)/g, correction: 'new', message: 'C# keywords are lowercase. Did you mean `new`?', severity: 'error' },
  { pattern: /\bVar\b(?=\s+\w)/g, correction: 'var', message: 'C# keywords are lowercase. Did you mean `var`?', severity: 'error' },
  { pattern: /\bVAR\b(?=\s+\w)/g, correction: 'var', message: 'C# keywords are lowercase. Did you mean `var`?', severity: 'error' },
  { pattern: /\bStatic\b(?=\s)/g, correction: 'static', message: 'C# keywords are lowercase. Did you mean `static`?', severity: 'error' },
  { pattern: /\bSTATIC\b(?=\s)/g, correction: 'static', message: 'C# keywords are lowercase. Did you mean `static`?', severity: 'error' },
  { pattern: /\bPublic\b(?=\s)/g, correction: 'public', message: 'Access modifiers in C# are lowercase.', severity: 'error' },
  { pattern: /\bPrivate\b(?=\s)/g, correction: 'private', message: 'Access modifiers in C# are lowercase.', severity: 'error' },
  { pattern: /\bProtected\b(?=\s)/g, correction: 'protected', message: 'Access modifiers in C# are lowercase.', severity: 'error' },
];

// ── Entry point method casing ────────────────────────────────────────────

export const MAIN_METHOD_TYPOS: TypoEntry[] = [
  { pattern: /\bvoid\s+main\s*\(/g, correction: 'void Main(', message: 'C# is case-sensitive. The entry point method must be `Main`, not `main`.', severity: 'error' },
  { pattern: /\bstatic\s+void\s+main\s*\(/g, correction: 'static void Main(', message: 'C# is case-sensitive. The entry point method must be `Main`, not `main`.', severity: 'error' },
];
