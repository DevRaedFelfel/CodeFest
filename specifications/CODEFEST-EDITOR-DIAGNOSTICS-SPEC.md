# CodeFest Editor Diagnostics & Error Detection Specification

**Project:** CodeFest — Interactive Coding Challenge Platform  
**Scope:** Client-side syntax error detection for CodeMirror 6 (Angular 17+)  
**Course:** Introduction to Programming with C# 2025  
**Companion to:** `CODEFEST-EDITOR-INTELLISENSE-SPEC.md` (autocomplete & hover tooltips)  
**Philosophy:** 20% effort → 80% value. Catch the errors Visual Studio would underline in red — without Roslyn.  
**Constraint:** Single-file C# console apps. No cross-file resolution, no full semantic analysis.  
**Source of truth for error patterns:** 15 weeks of student submissions + common beginner mistakes documented in [`RaedFelfelInstructor/programming2025`](https://github.com/RaedFelfelInstructor/programming2025).

---

## 1. Design Principles

1. **Visual Studio parity for beginners** — We replicate the red/yellow squiggly underline experience for the errors that hit intro students 90% of the time. If VS would catch it at edit-time without running the compiler, we catch it too.
2. **Client-side only** — All detection runs in the browser via CodeMirror 6's `@codemirror/lint` extension. No Roslyn, no Language Server Protocol, no server round-trips.
3. **Never block submission** — Diagnostics are advisory. Red underlines and warning icons inform the student but never prevent the "Run" or "Submit" button. The server-side compiler remains the source of truth.
4. **Quick-fix suggestions** — Every diagnostic includes a human-readable message and, where possible, a concrete fix suggestion (e.g., "Did you mean `==`?"). Quick-fixes that can be auto-applied get an "Apply fix" action button in the diagnostic tooltip.
5. **Lightweight type tracking** — We maintain a simple symbol table built from declarations in the current file (`int x`, `string name`, `List<int> numbers`). This is NOT full Roslyn-level type inference — it covers explicit declarations, `var` with simple initializers, and method parameters. Enough to catch "variable not declared" and basic type mismatches.
6. **Progressive severity** — Errors that would definitely fail compilation (missing semicolons, unmatched braces) are `Error` severity. Likely mistakes (assignment in condition) are `Warning`. Style/best-practice hints (empty catch block) are `Info`.

---

## 2. Stack & Dependencies

| Component | Package | Purpose |
|-----------|---------|---------|
| Lint engine | `@codemirror/lint` | `linter()` extension, `Diagnostic` type, gutter marks |
| Parse tree | `@lezer/common`, Lezer C# grammar | AST traversal for structural checks |
| Editor state | `@codemirror/state` | Access to document text, cursor, transactions |
| View | `@codemirror/view` | `Decoration` for inline markers, `hoverTooltip` for fix previews |

**No additional packages required** — all detection logic is custom TypeScript using the parse tree already provided by the C# language support from the IntelliSense spec.

---

## 3. Architecture

### 3.1 File Structure

Extends the architecture from the IntelliSense spec:

```
src/app/editor/
├── extensions/
│   ├── csharp-linter.ts              // Main linter entry — orchestrates all rules
│   ├── diagnostics/
│   │   ├── index.ts                  // Exports all diagnostic rule sets
│   │   ├── structural-rules.ts       // Braces, parens, brackets, semicolons (§4.1)
│   │   ├── string-literal-rules.ts   // Unclosed strings, interpolation errors (§4.2)
│   │   ├── typo-rules.ts             // Case-sensitivity, common misspellings (§4.3)
│   │   ├── assignment-rules.ts       // = vs ==, uninitialized vars (§4.4)
│   │   ├── type-rules.ts             // Type mismatch, wrong Parse args (§4.5)
│   │   ├── method-rules.ts           // Missing parens, wrong arg count (§4.6)
│   │   ├── control-flow-rules.ts     // Missing in, unreachable code, empty blocks (§4.7)
│   │   ├── class-rules.ts            // Constructor, static, access modifier issues (§4.8)
│   │   └── style-rules.ts            // Best practices, hints (§4.9)
│   ├── symbol-table.ts               // Lightweight variable/type tracker (§5)
│   └── diagnostic-helpers.ts         // Shared utilities, message formatting
├── data/
│   ├── completion-registry.ts        // (from IntelliSense spec)
│   ├── known-types.ts                // Map of type names → member signatures
│   └── common-typos.ts               // Typo → correction dictionary
```

### 3.2 Linter Entry Point

```typescript
// csharp-linter.ts
import { linter, Diagnostic } from '@codemirror/lint';
import { structuralRules } from './diagnostics/structural-rules';
import { stringLiteralRules } from './diagnostics/string-literal-rules';
import { typoRules } from './diagnostics/typo-rules';
import { assignmentRules } from './diagnostics/assignment-rules';
import { typeRules } from './diagnostics/type-rules';
import { methodRules } from './diagnostics/method-rules';
import { controlFlowRules } from './diagnostics/control-flow-rules';
import { classRules } from './diagnostics/class-rules';
import { styleRules } from './diagnostics/style-rules';
import { buildSymbolTable } from './symbol-table';

export const csharpLinter = linter((view) => {
  const doc = view.state.doc;
  const tree = syntaxTree(view.state);
  const symbols = buildSymbolTable(doc, tree);

  const diagnostics: Diagnostic[] = [
    ...structuralRules(doc, tree),
    ...stringLiteralRules(doc, tree),
    ...typoRules(doc, tree),
    ...assignmentRules(doc, tree, symbols),
    ...typeRules(doc, tree, symbols),
    ...methodRules(doc, tree, symbols),
    ...controlFlowRules(doc, tree),
    ...classRules(doc, tree),
    ...styleRules(doc, tree),
  ];

  return diagnostics;
}, {
  delay: 400  // ms debounce — don't lint on every keystroke
});
```

### 3.3 Diagnostic Data Model

```typescript
// diagnostic-helpers.ts
import { Diagnostic, Action } from '@codemirror/lint';

type Severity = 'error' | 'warning' | 'info';

interface DiagnosticRule {
  id: string;              // Unique rule ID: "CS0001", "CF001", etc.
  severity: Severity;
  message: string;         // Human-readable: "Missing semicolon at end of statement."
  suggestion?: string;     // Quick-fix text: "Add `;`"
  replacement?: string;    // Auto-fix replacement text (if applicable)
}

// Helper to create a diagnostic with optional auto-fix action
function makeDiagnostic(
  from: number,
  to: number,
  rule: DiagnosticRule,
  actions?: Action[]
): Diagnostic {
  return {
    from,
    to,
    severity: rule.severity,
    message: rule.message,
    source: `CodeFest [${rule.id}]`,
    actions: actions ?? [],
  };
}
```

---

## 4. Diagnostic Rules — Complete Catalog

### 4.1 Structural Rules — Braces, Parentheses, Brackets, Semicolons

These are the highest-value rules. Every beginner struggles with matching delimiters.

#### 4.1.1 Unmatched Delimiters

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF001 | Unmatched `{` | Error | Count `{` vs `}` globally + walk tree for unclosed `Block` nodes | "Opening brace `{` on line {N} has no matching closing brace `}`." | Insert `}` at end of likely scope (indentation-based heuristic) |
| CF002 | Extra `}` | Error | Closing `}` with no matching opener in tree | "Unexpected closing brace `}`. No matching opening brace found." | Remove the extra `}` |
| CF003 | Unmatched `(` | Error | Walk tree for unclosed `ParenthesizedExpression` / `ArgumentList` | "Opening parenthesis `(` has no matching `)`." | Insert `)` at end of expression |
| CF004 | Extra `)` | Error | Closing `)` with no opener | "Unexpected `)`. No matching opening parenthesis found." | Remove the extra `)` |
| CF005 | Unmatched `[` | Error | Walk tree for unclosed index/attribute expressions | "Opening bracket `[` has no matching `]`." | Insert `]` |
| CF006 | Extra `]` | Error | Closing `]` with no opener | "Unexpected `]`. No matching opening bracket found." | Remove the extra `]` |
| CF007 | Unmatched `<` in generics | Warning | After `List`, `Dictionary`, `Stack`, `Queue`, `HashSet` — `<` without `>` | "Generic type `<` has no matching `>`. Did you forget to close the type parameter?" | Insert `>` |

**Detection strategy:** Use both the Lezer parse tree (look for `⚠` error nodes) AND a bracket-counting pass as fallback. The tree gives precise positions; the counting pass catches cases where the tree is too broken to be useful.

```typescript
// Bracket counting algorithm (pseudocode)
function findUnmatchedBraces(doc: Text): Diagnostic[] {
  const stack: { char: string; pos: number; line: number }[] = [];
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < doc.length; i++) {
    const ch = doc.sliceString(i, i + 1);
    if (isInsideStringOrComment(i, doc)) continue;  // Skip strings/comments

    if (ch === '{' || ch === '(' || ch === '[') {
      stack.push({ char: ch, pos: i, line: doc.lineAt(i).number });
    } else if (ch === '}' || ch === ')' || ch === ']') {
      const expected = matchingOpen(ch);
      if (stack.length > 0 && stack[stack.length - 1].char === expected) {
        stack.pop();
      } else {
        diagnostics.push(/* extra closer at position i */);
      }
    }
  }
  // Remaining items in stack = unclosed openers
  for (const unclosed of stack) {
    diagnostics.push(/* unclosed opener at unclosed.pos */);
  }
  return diagnostics;
}
```

#### 4.1.2 Missing Semicolons

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF010 | Missing `;` after statement | Error | Line ends with identifier, `)`, literal, `]`, `++`, `--` but no `;` — and next non-empty line does NOT start with `.`, `{`, `?`, `:`, `&&`, `||`, `+`, `-`, `*`, `/` (continuation) | "Missing semicolon `;` at end of statement." | Insert `;` at end of line |
| CF011 | Missing `;` after `return` expr | Error | `return` followed by expression but line has no `;` | "Missing semicolon after `return` statement." | Insert `;` |
| CF012 | Missing `;` after `break`/`continue` | Error | `break` or `continue` keyword without `;` on same line | "Missing semicolon after `{keyword}`." | Insert `;` |
| CF013 | Missing `;` after `throw` | Error | `throw` (with or without expression) missing `;` | "Missing semicolon after `throw` statement." | Insert `;` |
| CF014 | Double semicolon `;;` | Warning | Two consecutive semicolons (not inside `for`) | "Double semicolon `;;`. Did you add an extra one?" | Remove one `;` |

**Lines to EXCLUDE from semicolon checks** (these legitimately don't end with `;`):

- Lines ending with `{` or `}`
- Lines ending with `//` comments
- Lines that are blank/whitespace only
- Lines that are `class`, `if`, `else`, `for`, `foreach`, `while`, `do`, `switch`, `try`, `catch`, `finally`, `namespace`, `using` declarations (before their block)
- Lines inside multi-line string literals (`@""` / `$@""`)
- Lines that are attribute decorators (`[...]`)
- `case` and `default:` labels
- Lines ending with `,` (multi-line argument lists, array initializers)
- Lines ending with `=>` (lambda continuations)
- Lines ending with `(` or `[` (multi-line calls)

#### 4.1.3 Mismatched Delimiters (Cross-Type)

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF020 | `( ... }` | Error | Opener `(` closed by `}` | "Mismatched delimiters: opened with `(` but closed with `}`. Did you mean `)`?" | Replace `}` with `)` |
| CF021 | `{ ... )` | Error | Opener `{` closed by `)` | "Mismatched delimiters: opened with `{` but closed with `)`. Did you mean `}`?" | Replace `)` with `}` |
| CF022 | `[ ... )` or `[ ... }` | Error | Opener `[` closed by wrong delimiter | "Mismatched delimiters: opened with `[` but closed with `{closer}`. Did you mean `]`?" | Replace with `]` |

---

### 4.2 String Literal Rules

#### 4.2.1 Unclosed String Literals

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF030 | Unterminated regular string | Error | Line contains `"` that opens a string but no closing `"` (accounting for `\"` escapes). Does NOT apply to `@""` verbatim strings or lines ending with `"` + concatenation on next line. | "Unterminated string literal. Missing closing `\"`." | Insert `"` at end of string content |
| CF031 | Unterminated verbatim string | Error | `@"` without a matching `""` close (verbatim strings use `""` for embedded quotes). Scan forward — may span multiple lines. | "Unterminated verbatim string. Close it with `\"`." | Insert `"` |
| CF032 | Unterminated char literal | Error | `'` opened but not closed on same line, or more than one character between `' '` (excluding `\n`, `\t`, `\\`, `\'`, `\0`, `\r`) | "Unterminated or invalid character literal." | Insert `'` |
| CF033 | Empty char literal `''` | Error | Two consecutive single quotes with nothing between | "Empty character literal. A `char` must contain exactly one character, e.g., `'A'`." | — |

#### 4.2.2 String Interpolation Errors

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF035 | `{}` usage in non-interpolated string | Warning | `{variable}` pattern inside `"..."` (not `$"..."`) | "This looks like string interpolation, but the string is missing the `$` prefix. Did you mean `$\"{variable}\"`?" | Add `$` before the opening `"` |
| CF036 | Unmatched `{` in interpolated string | Error | Inside `$"..."`, an opening `{` without closing `}` | "Unclosed `{` in interpolated string. Add `}` to close the expression." | Insert `}` |
| CF037 | Empty `{}` in interpolated string | Warning | `$"...{}..."` — braces with nothing inside | "Empty expression `{}` in interpolated string. Put an expression inside, e.g., `{name}`." | — |
| CF038 | Literal brace in interpolation without escape | Info | `$"...{...{..."` — nested `{` that's probably meant as literal | "To include a literal `{` in an interpolated string, use `{{`." | Replace `{` with `{{` |

---

### 4.3 Typo & Case-Sensitivity Rules

C# is case-sensitive. This is the #1 source of confusion for beginners coming from web/scripting backgrounds.

#### 4.3.1 Known Class Name Typos

| Rule ID | Typed | Correct | Severity | Message | Quick Fix |
|---------|-------|---------|----------|---------|-----------|
| CF040 | `console` | `Console` | Error | "C# is case-sensitive. Did you mean `Console`?" | Replace with `Console` |
| CF041 | `CONSOLE` | `Console` | Error | Same | Replace with `Console` |
| CF042 | `Consle` | `Console` | Error | "Did you mean `Console`? Check spelling." | Replace with `Console` |
| CF043 | `Consolo` | `Console` | Error | Same | Replace with `Console` |
| CF044 | `math` | `Math` | Error | "C# is case-sensitive. Did you mean `Math`?" | Replace with `Math` |
| CF045 | `Math` (correct) | — | — | *(no error)* | — |
| CF046 | `random` (as class) | `Random` | Error | "C# is case-sensitive. Did you mean `Random`?" | Replace with `Random` |
| CF047 | `convert` | `Convert` | Error | "C# is case-sensitive. Did you mean `Convert`?" | Replace with `Convert` |
| CF048 | `String` (as type) | `string` | Info | "In C#, `string` and `String` are equivalent. The lowercase `string` is preferred." | Replace with `string` |
| CF049 | `Int32` | `int` | Info | "`Int32` works, but the alias `int` is preferred in C#." | Replace with `int` |
| CF050 | `Boolean` | `bool` | Info | "`Boolean` works, but `bool` is preferred." | Replace with `bool` |
| CF051 | `Double` | `double` | Info | "`Double` works, but `double` is preferred." | Replace with `double` |
| CF052 | `array` (as class) | `Array` | Error | "C# is case-sensitive. Did you mean `Array`?" | Replace with `Array` |
| CF053 | `datetime` | `DateTime` | Error | "C# is case-sensitive. Did you mean `DateTime`?" | Replace with `DateTime` |
| CF054 | `Datetime` | `DateTime` | Error | "C# is case-sensitive. Did you mean `DateTime`?" | Replace with `DateTime` |

#### 4.3.2 Known Method Name Typos

| Rule ID | Typed | Correct | Context | Severity | Message |
|---------|-------|---------|---------|----------|---------|
| CF060 | `Writeline` | `WriteLine` | `Console.` | Error | "C# is case-sensitive. Did you mean `WriteLine`?" |
| CF061 | `writeline` | `WriteLine` | `Console.` | Error | Same |
| CF062 | `WRITELINE` | `WriteLine` | `Console.` | Error | Same |
| CF063 | `Writline` | `WriteLine` | `Console.` | Error | "Did you mean `WriteLine`? Check spelling." |
| CF064 | `WriteLines` | `WriteLine` | `Console.` | Error | "Did you mean `WriteLine`? (no 's')" |
| CF065 | `Readline` | `ReadLine` | `Console.` | Error | "C# is case-sensitive. Did you mean `ReadLine`?" |
| CF066 | `readline` | `ReadLine` | `Console.` | Error | Same |
| CF067 | `Readine` | `ReadLine` | `Console.` | Error | "Did you mean `ReadLine`? Check spelling." |
| CF068 | `tostring` | `ToString` | any `.` | Error | "C# is case-sensitive. Did you mean `ToString()`?" |
| CF069 | `toUpper` | `ToUpper` | string `.` | Error | "C# is case-sensitive. Did you mean `ToUpper()`?" |
| CF070 | `toupper` | `ToUpper` | string `.` | Error | Same |
| CF071 | `toLower` | `ToLower` | string `.` | Error | Same pattern |
| CF072 | `tolower` | `ToLower` | string `.` | Error | Same |
| CF073 | `Parseint` | `Parse` | `int.` | Error | "Did you mean `int.Parse()`?" |
| CF074 | `parseInt` | `Parse` | `int.` | Error | "C# uses `int.Parse()`, not `parseInt()`. (That's JavaScript!)" |
| CF075 | `toInt` | `Convert.ToInt32` | — | Warning | "C# doesn't have `toInt()`. Use `int.Parse()` or `Convert.ToInt32()`." |
| CF076 | `lenght` | `Length` | any `.` | Error | "Did you mean `Length`? Check spelling." |
| CF077 | `legth` | `Length` | any `.` | Error | Same |
| CF078 | `Lenght` | `Length` | any `.` | Error | Same |
| CF079 | `count` | `Count` | collection `.` | Error | "C# is case-sensitive. Did you mean `Count`?" |
| CF080 | `indexof` | `IndexOf` | string/list `.` | Error | "C# is case-sensitive. Did you mean `IndexOf()`?" |
| CF081 | `Indexof` | `IndexOf` | string/list `.` | Error | Same |
| CF082 | `contains` | `Contains` | string/list `.` | Error | "C# is case-sensitive. Did you mean `Contains()`?" |
| CF083 | `add` | `Add` | list `.` | Error | "C# is case-sensitive. Did you mean `Add()`?" |
| CF084 | `remove` | `Remove` | list `.` | Error | "C# is case-sensitive. Did you mean `Remove()`?" |
| CF085 | `sort` | `Sort` | list/array `.` | Error | "C# is case-sensitive. Did you mean `Sort()`?" |
| CF086 | `reverse` | `Reverse` | list/array `.` | Error | "C# is case-sensitive. Did you mean `Reverse()`?" |
| CF087 | `Foreach` | `ForEach` | list `.` | Error | "C# is case-sensitive. Did you mean `ForEach()`?" |
| CF088 | `Toint32` | `ToInt32` | `Convert.` | Error | "Did you mean `ToInt32`?" |
| CF089 | `Todouble` | `ToDouble` | `Convert.` | Error | "Did you mean `ToDouble`?" |

**Detection strategy:** Build a dictionary mapping `lowercased(memberName)` → correct spelling for all members in the completion registry. On each `.member` access, normalize to lowercase and look up. If found and casing differs, flag it. Additionally maintain a static Levenshtein-distance table for common misspellings (max distance 2).

```typescript
// common-typos.ts — static typo correction dictionary
export const TYPO_CORRECTIONS: Record<string, string> = {
  // Class names
  'consle': 'Console', 'consolo': 'Console', 'conole': 'Console',
  // Method names
  'writline': 'WriteLine', 'writelines': 'WriteLine', 'readine': 'ReadLine',
  'lenght': 'Length', 'legth': 'Length', 'parseint': 'int.Parse',
  'tostring': 'ToString', 'indexof': 'IndexOf',
  // ... etc.
};
```

#### 4.3.3 Keyword Casing Errors

| Rule ID | Typed | Correct | Severity | Message |
|---------|-------|---------|----------|---------|
| CF090 | `If` | `if` | Error | "C# keywords are lowercase. Did you mean `if`?" |
| CF091 | `Else` | `else` | Error | "C# keywords are lowercase. Did you mean `else`?" |
| CF092 | `For` | `for` | Error | "C# keywords are lowercase. Did you mean `for`?" |
| CF093 | `Foreach` or `ForEach` (as keyword) | `foreach` | Error | "C# keywords are lowercase. Did you mean `foreach`?" |
| CF094 | `While` | `while` | Error | "C# keywords are lowercase. Did you mean `while`?" |
| CF095 | `Return` | `return` | Error | "C# keywords are lowercase. Did you mean `return`?" |
| CF096 | `Void` or `VOID` | `void` | Error | "C# keywords are lowercase. Did you mean `void`?" |
| CF097 | `Class` or `CLASS` | `class` | Error | "C# keywords are lowercase. Did you mean `class`?" |
| CF098 | `Null` or `NULL` | `null` | Error | "C# keywords are lowercase. Did you mean `null`?" |
| CF099 | `True` or `TRUE` | `true` | Error | "C# uses lowercase `true`." |
| CF100 | `False` or `FALSE` | `false` | Error | "C# uses lowercase `false`." |
| CF101 | `New` or `NEW` | `new` | Error | "C# keywords are lowercase. Did you mean `new`?" |
| CF102 | `Var` or `VAR` | `var` | Error | "C# keywords are lowercase. Did you mean `var`?" |
| CF103 | `Static` or `STATIC` | `static` | Error | "C# keywords are lowercase. Did you mean `static`?" |
| CF104 | `public` / `private` / `protected` (wrong case) | lowercase | Error | "Access modifiers in C# are lowercase." |
| CF105 | `Main` (correct) | — | — | *(no error — Main is a method name, not a keyword)* |
| CF106 | `main` (as method name) | `Main` | Error | "C# is case-sensitive. The entry point method must be `Main`, not `main`." |

---

### 4.4 Assignment & Comparison Rules

#### 4.4.1 Assignment vs. Comparison Confusion

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF110 | `=` inside `if` condition | Warning | `if (x = 5)` — single `=` inside `if (`, `while (`, `for (...;` condition part | "Did you mean `==`? A single `=` is assignment, `==` is comparison." | Replace `=` with `==` |
| CF111 | `=` inside `while` condition | Warning | Same pattern for `while (x = ...)` | Same message | Replace `=` with `==` |
| CF112 | `==` as statement | Warning | `x == 5;` — comparison as standalone statement (result unused) | "Did you mean `=`? `==` compares but doesn't assign. Use `=` for assignment." | Replace `==` with `=` |
| CF113 | `!=` as statement | Warning | `x != 5;` — same pattern | "This comparison does nothing on its own. Did you mean to use it in an `if` statement?" | — |

#### 4.4.2 Uninitialized Variable Usage

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF120 | Use before assignment | Error | Variable declared (`int x;`) but used before any assignment to it on all reachable paths | "Variable `{name}` is used but may not have been assigned a value." | — |
| CF121 | `var` without initializer | Error | `var x;` — `var` requires an initializer expression | "`var` requires an initializer. Use an explicit type like `int x;` or assign a value: `var x = 0;`" | — |
| CF122 | Declared but never used | Info | Variable declared and assigned but never referenced again | "Variable `{name}` is declared but never used." | Remove declaration |
| CF123 | Duplicate variable name | Error | Same variable name declared twice in same scope | "A variable named `{name}` is already declared in this scope." | — |
| CF124 | Assignment to itself | Warning | `x = x;` — identical left and right sides | "Variable `{name}` is assigned to itself. This has no effect." | — |

**Detection strategy for CF120:** Walk declarations top-to-bottom. For each declaration without initializer, track whether an assignment occurs before any usage. For simple linear code (no branches), this is a straightforward forward scan. For code with `if/else`, conservatively flag if ANY branch path reaches usage without assignment. Do NOT attempt full control-flow graph analysis — that's Roslyn territory.

```typescript
// Simplified uninitialized variable detection
interface VarInfo {
  name: string;
  declPos: number;
  type: string;
  initialized: boolean;
  usedAt: number[];  // positions where referenced
}

function checkUninitializedVars(doc: Text, tree: Tree): Diagnostic[] {
  const vars = findDeclarations(doc, tree);
  const diagnostics: Diagnostic[] = [];

  for (const v of vars) {
    if (!v.initialized && v.usedAt.length > 0) {
      // Check if there's an assignment between declaration and first use
      const firstUse = Math.min(...v.usedAt);
      if (!hasAssignmentBetween(v.name, v.declPos, firstUse, doc)) {
        diagnostics.push(/* CF120 at firstUse */);
      }
    }
  }
  return diagnostics;
}
```

---

### 4.5 Type Mismatch Rules

These require the lightweight symbol table (§5) to track declared types.

#### 4.5.1 Assignment Type Mismatches

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF130 | `int x = "hello";` | Error | String literal assigned to `int` variable | "Cannot assign a `string` to variable `{name}` of type `int`." | — |
| CF131 | `string s = 42;` | Error | Numeric literal assigned to `string` variable | "Cannot assign an `int` to variable `{name}` of type `string`. Use `42.ToString()` or `\"42\"`." | Wrap in `.ToString()` |
| CF132 | `int x = true;` | Error | Boolean assigned to numeric type | "Cannot assign a `bool` to variable `{name}` of type `int`." | — |
| CF133 | `bool b = 0;` | Error | Numeric assigned to `bool` | "Cannot assign an `int` to a `bool`. In C#, use `true` or `false` (not `0`/`1` like C/C++)." | — |
| CF134 | `string s = Console.ReadLine(); int x = s;` | Error | `string` variable assigned to `int` | "Cannot assign `string` to `int`. Use `int.Parse({name})` or `Convert.ToInt32({name})`." | Wrap in `int.Parse()` |
| CF135 | `int x = Console.ReadLine();` | Error | `Console.ReadLine()` returns `string?`, not `int` | "`Console.ReadLine()` returns a `string`. Use `int.Parse(Console.ReadLine())` to convert." | Wrap in `int.Parse()` |
| CF136 | `double d = Console.ReadLine();` | Error | Same for double | "`Console.ReadLine()` returns a `string`. Use `double.Parse(Console.ReadLine())` to convert." | Wrap in `double.Parse()` |

#### 4.5.2 Return Type Mismatches

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF140 | `int Foo() { return "hello"; }` | Error | Return type of method is `int`, but returning a string literal | "Cannot return `string` from a method declared to return `int`." | — |
| CF141 | `void Foo() { return 5; }` | Error | `void` method returning a value | "Cannot return a value from a `void` method." | Change to `return;` or change return type |
| CF142 | `int Foo() { }` (no return) | Warning | Non-void method with no `return` statement | "Method `{name}` is declared to return `{type}` but has no `return` statement." | — |
| CF143 | `int Foo() { if (...) return 5; }` | Warning | Not all code paths return a value | "Not all code paths return a value in method `{name}`." | — |

#### 4.5.3 Condition Type Errors

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF150 | `if (x)` where x is `int` | Error | Non-boolean expression in condition context | "`if` condition must be a `bool` expression. `int` is not implicitly convertible to `bool` in C#. Did you mean `if (x != 0)`?" | Wrap in `!= 0` |
| CF151 | `if ("hello")` | Error | String literal in condition | "`if` condition must be a `bool`. Strings are not booleans in C#. Did you mean `if (s != null)` or `if (s.Length > 0)`?" | — |
| CF152 | `while (1)` | Error | Numeric literal in loop condition | "`while` condition must be a `bool`. Did you mean `while (true)`?" | Replace `1` with `true` |

#### 4.5.4 Parse Method Argument Errors

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF155 | `int.Parse(42)` | Error | Numeric literal passed to `Parse` | "`int.Parse()` expects a `string` argument, not an `int`. You already have an `int`!" | Remove `.Parse()` wrapper |
| CF156 | `int.Parse(x)` where x is `int` | Warning | Known-int variable passed to `Parse` | "`int.Parse()` expects a `string`. `{name}` is already an `int`." | Remove `.Parse()` wrapper |
| CF157 | `Convert.ToInt32()` with no args | Error | No argument | "`Convert.ToInt32()` requires an argument." | — |

---

### 4.6 Method Call Rules

#### 4.6.1 Missing Parentheses on Method Calls

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF160 | `Console.ReadLine;` | Error | Known method name without `()` used as statement | "Did you mean `Console.ReadLine()`? Methods need parentheses `()` to be called." | Add `()` |
| CF161 | `Console.WriteLine;` | Error | Same | "Did you mean `Console.WriteLine()`?" | Add `()` |
| CF162 | `myList.Add;` | Error | Same for known methods | "Did you mean `.Add()`? Methods need parentheses." | Add `()` |
| CF163 | `myList.Sort;` | Error | Same | "Did you mean `.Sort()`?" | Add `()` |
| CF164 | `myList.Clear;` | Error | Same | "Did you mean `.Clear()`?" | Add `()` |
| CF165 | `myList.Count()` | Warning | Property accessed with `()` | "`Count` is a property, not a method. Remove the parentheses: use `.Count` instead of `.Count()`." | Remove `()` |
| CF166 | `myArray.Length()` | Warning | Same | "`Length` is a property, not a method. Use `.Length` instead of `.Length()`." | Remove `()` |
| CF167 | `myString.Length()` | Warning | Same | Same | Remove `()` |

**Detection strategy:** Maintain two sets from the completion registry — `KNOWN_METHODS` (things that need `()`) and `KNOWN_PROPERTIES` (things that don't). After a `.member` access, check if it's in the wrong set based on the presence/absence of `(`.

#### 4.6.2 Wrong Argument Count

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF170 | `Console.WriteLine("a", "b", "c")` with no format | Warning | 3+ string args without format placeholder in first arg | "Hint: The first argument to `Console.WriteLine` should be a format string like `\"{0} {1}\"` when using multiple arguments." | — |
| CF171 | `Math.Pow(5)` | Error | Known method called with wrong number of args | "`Math.Pow()` requires 2 arguments: `Math.Pow(base, exponent)`." | — |
| CF172 | `Math.Sqrt()` | Error | No arguments | "`Math.Sqrt()` requires 1 argument." | — |
| CF173 | `Math.Max(1, 2, 3)` | Error | Too many arguments | "`Math.Max()` takes exactly 2 arguments. For 3+ values, nest calls: `Math.Max(Math.Max(1, 2), 3)`." | — |
| CF174 | `Console.ReadLine("prompt")` | Warning | Args passed to ReadLine | "`Console.ReadLine()` takes no arguments. To show a prompt first, use `Console.Write(\"prompt\")` on the previous line." | — |
| CF175 | `myList.Add()` | Error | No arguments to Add | "`.Add()` requires an argument — the item to add." | — |
| CF176 | `myList.Add(1, 2)` | Error | Too many args | "`.Add()` takes exactly 1 argument. To add multiple items, call `.Add()` for each one, or use `.AddRange()`." | — |

**Detection strategy:** For known methods from the completion registry, store the valid argument count ranges (min/max). Count comma-separated items inside `()` after the method name (skipping nested parentheses). Compare with expected range.

---

### 4.7 Control Flow Rules

#### 4.7.1 Structural Control Flow Errors

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF180 | `foreach` without `in` | Error | `foreach (var x collection)` — variable and iterable without `in` keyword | "Missing `in` keyword in `foreach` loop. Syntax: `foreach (var item in collection)`." | Insert `in` |
| CF181 | `else` without `if` | Error | `else` / `else if` with no preceding `if` block | "`else` without a matching `if`." | — |
| CF182 | `catch` without `try` | Error | `catch` with no preceding `try` | "`catch` without a matching `try`." | — |
| CF183 | `finally` without `try` | Error | Same | "`finally` without a matching `try`." | — |
| CF184 | `case` outside `switch` | Error | `case` label not inside a `switch` body | "`case` can only appear inside a `switch` statement." | — |
| CF185 | `break` outside loop/switch | Warning | `break` not inside `for`/`while`/`do`/`foreach`/`switch` | "`break` can only be used inside a loop or `switch` statement." | — |
| CF186 | `continue` outside loop | Warning | `continue` not inside a loop | "`continue` can only be used inside a loop (`for`, `while`, `foreach`, `do-while`)." | — |
| CF187 | `switch` without `case` | Warning | `switch (...) { }` with no `case` labels | "`switch` block has no `case` labels." | — |
| CF188 | `case` without `break`/`return` | Warning | `case` block that falls through to next `case` (has statements but no `break`/`return`/`throw`/`goto`) | "Missing `break` at end of `case` block. C# does not allow fall-through." | Add `break;` |

#### 4.7.2 Unreachable Code

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF190 | Code after `return` | Warning | Statements after `return x;` in same block (before next `}`) | "Unreachable code detected after `return` statement." | Remove or move code |
| CF191 | Code after `break` | Warning | Same after `break;` | "Unreachable code detected after `break`." | — |
| CF192 | Code after `continue` | Warning | Same after `continue;` | "Unreachable code detected after `continue`." | — |
| CF193 | Code after `throw` | Warning | Same after `throw ...;` | "Unreachable code detected after `throw`." | — |
| CF194 | `while (false) { ... }` | Info | Condition is literal `false` | "Loop body will never execute — condition is always `false`." | — |
| CF195 | `if (false) { ... }` | Info | Condition is literal `false` | "Block will never execute — condition is always `false`." | — |
| CF196 | `if (true) { ... } else { ... }` | Info | Else is unreachable | "The `else` block will never execute — condition is always `true`." | — |

#### 4.7.3 Empty Blocks and Suspicious Patterns

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF200 | `if (condition);` | Warning | Semicolon directly after `if (...)` before `{` or statement | "Suspicious semicolon after `if`. This executes an empty statement, then runs the next block unconditionally." | Remove `;` |
| CF201 | `for (...);` | Warning | Same for `for` | "Suspicious semicolon after `for`. The loop body is empty." | Remove `;` |
| CF202 | `while (condition);` | Warning | Same for `while` (unless it's `do-while`) | "Suspicious semicolon after `while`. The loop body is empty." | Remove `;` |
| CF203 | `foreach (...);` | Warning | Same for `foreach` | "Suspicious semicolon after `foreach`. The loop body is empty." | Remove `;` |
| CF204 | Empty `catch` block | Warning | `catch { }` or `catch (Exception) { }` with no statements inside | "Empty `catch` block silently swallows errors. At minimum, log the exception." | Insert `Console.WriteLine(ex.Message);` |
| CF205 | `throw ex;` in catch | Info | `catch (Exception ex) { ... throw ex; ... }` | "Use `throw;` instead of `throw ex;` to preserve the original stack trace." | Replace `throw ex;` with `throw;` |

---

### 4.8 Class & Method Declaration Rules

#### 4.8.1 Declaration Structure Errors

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF210 | `Main` without `static` | Error | Method named `Main` that doesn't have `static` modifier | "The `Main` method must be declared `static`." | Add `static` |
| CF211 | `void main(...)` | Error | Lowercase `main` as method name | "C# is case-sensitive. The entry point must be `Main`, not `main`." | Replace with `Main` |
| CF212 | `static void main(...)` | Error | Same with static | Same | Replace with `Main` |
| CF213 | Multiple `Main` methods | Warning | More than one `static void Main` or `static int Main` | "Multiple `Main` methods found. A program should have exactly one entry point." | — |
| CF214 | `public class` inside another class (unintended nesting) | Warning | Class declaration inside another class body | "Class `{inner}` is nested inside class `{outer}`. Did you mean to close `{outer}` first?" | — |
| CF215 | Method without return type | Error | Identifier followed by `(` that looks like a method but has no type before name (excluding constructors) | "Method `{name}` is missing a return type. Add `void`, `int`, `string`, etc." | — |
| CF216 | Constructor with return type | Warning | `void ClassName(...)` or `int ClassName(...)` where name matches enclosing class | "Constructors don't have a return type. Remove `{type}` from `{type} {ClassName}()`." | Remove return type |
| CF217 | `abstract` method with body | Error | Method marked `abstract` with `{ }` block | "`abstract` methods cannot have a body. Remove the body or remove `abstract`." | — |
| CF218 | `virtual` method without body | Error | `virtual` method with `;` instead of body | "`virtual` methods must have a body. Use `abstract` for bodyless methods." | — |
| CF219 | `override` without `virtual`/`abstract` base | Info | `override` on method that doesn't seem to match a base method (heuristic — if no `base` class visible) | "The `override` modifier requires a `virtual` or `abstract` method in a base class." | — |

#### 4.8.2 Access Modifier Issues

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF220 | Duplicate access modifiers | Error | `public public`, `public private`, etc. | "Duplicate or conflicting access modifiers." | Remove duplicate |
| CF221 | `private` on top-level class | Warning | `private class` at namespace level | "Top-level classes cannot be `private`. Did you mean `internal` or `public`?" | Replace with `internal` |
| CF222 | Access modifier on local variable | Error | `public int x = 5;` inside a method body | "Access modifiers (`public`, `private`) cannot be used on local variables." | Remove modifier |

#### 4.8.3 Property Errors

| Rule ID | Check | Severity | Detection | Message | Quick Fix |
|---------|-------|----------|-----------|---------|-----------|
| CF230 | `get` / `set` without property context | Error | `get` or `set` used outside a property body | "`get` and `set` are only valid inside a property declaration." | — |
| CF231 | Property with `()` | Error | `public int Name() { get; set; }` — parentheses on auto-property | "Properties don't use parentheses. Remove `()`: `public int Name { get; set; }`" | Remove `()` |
| CF232 | Field-like property (no get/set) | Info | `public int Name { }` — empty braces | "Property `{name}` has no `get` or `set` accessor. Add `{ get; set; }`." | Add `get; set;` |

---

### 4.9 Style & Best Practice Rules

These are `Info` severity — green/blue underlines, not red. Non-critical but educational.

| Rule ID | Check | Severity | Message |
|---------|-------|----------|---------|
| CF240 | `if (condition) return true; else return false;` | Info | "This can be simplified to `return condition;`" |
| CF241 | `x == true` or `x == false` | Info | "Redundant comparison. Use `x` or `!x` directly." |
| CF242 | `x != null` where `x` is non-nullable value type | Info | "Value types like `int` can never be `null`. This check is unnecessary." |
| CF243 | String concatenation in loop | Info | "Building strings in a loop with `+` is slow. Consider using `StringBuilder` or `string.Join()`." |
| CF244 | Magic numbers | Info | "Consider defining `{number}` as a named constant for clarity." (only for numbers > 1 digit, not 0/1/2) |
| CF245 | `using System;` when not needed | Info | "With C# top-level statements and implicit usings, `using System;` is often unnecessary." |
| CF246 | Variable name is a C# keyword | Error | "Cannot use `{word}` as a variable name — it is a C# keyword." |
| CF247 | `Console.ReadLine().ToLower()` without null check | Info | "`Console.ReadLine()` can return `null`. Consider using `Console.ReadLine()?.ToLower()` or adding a null check." |
| CF248 | Comparison with `""` instead of `string.IsNullOrEmpty` | Info | "Consider using `string.IsNullOrEmpty({var})` instead of `{var} == \"\"` — it also handles `null`." |
| CF249 | Very long method (>50 lines) | Info | "This method is quite long ({N} lines). Consider breaking it into smaller methods." |
| CF250 | Deeply nested code (>4 levels) | Info | "This code is deeply nested ({N} levels). Consider simplifying with early returns or extracting methods." |
| CF251 | `using` not at top of file | Warning | "`using` statements should be at the top of the file." |
| CF252 | Missing `using System.Linq;` when LINQ methods used | Warning | "LINQ methods like `.Where()` require `using System.Linq;` at the top of the file." |

---

## 5. Lightweight Symbol Table

The symbol table is the engine behind type mismatch checks (§4.5), uninitialized variable detection (§4.4.2), and some method call checks (§4.6). It is NOT a full semantic analyzer — it's a single-pass, single-file, best-effort tracker.

### 5.1 What It Tracks

```typescript
// symbol-table.ts

interface Symbol {
  name: string;
  kind: 'variable' | 'parameter' | 'field' | 'property' | 'method';
  type: string;          // "int", "string", "double", "bool", "List<int>", etc.
  declaredAt: number;     // Document offset of declaration
  scopeDepth: number;     // 0 = top-level/class, 1 = method, 2+ = nested blocks
  initialized: boolean;   // Was it assigned a value at declaration?
  usages: number[];       // Offsets where referenced
}

interface MethodInfo {
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  isStatic: boolean;
  declaredAt: number;
}

interface SymbolTable {
  variables: Symbol[];
  methods: MethodInfo[];
  currentClass: string | null;
}
```

### 5.2 What It Resolves

| Declaration Pattern | Resolved Type |
|-------------------|---------------|
| `int x = 5;` | `int` |
| `string name = "Ali";` | `string` |
| `double[] scores = new double[10];` | `double[]` |
| `List<int> nums = new List<int>();` | `List<int>` |
| `var x = 5;` | `int` (from literal) |
| `var s = "hello";` | `string` (from literal) |
| `var b = true;` | `bool` (from literal) |
| `var d = 3.14;` | `double` (from literal) |
| `var line = Console.ReadLine();` | `string` (known return type) |
| `var result = int.Parse(s);` | `int` (known return type) |
| `var rng = new Random();` | `Random` (from `new T()`) |
| `var dt = DateTime.Now;` | `DateTime` (known property type) |
| `var x = Foo();` | `unknown` (user-defined method — skip checks) |
| `var x = a + b;` | `unknown` (complex expression — skip checks) |

### 5.3 What It Does NOT Resolve

- Generic type parameter inference beyond simple `new List<T>()` patterns
- Method overload resolution (which `Console.WriteLine` overload was called)
- Expression type evaluation beyond single literals and known API returns
- Cross-method data flow (e.g., tracking a variable modified in another method)
- Implicit conversions (e.g., `int` → `double` is valid but we may flag it)

**Rule of thumb:** If the symbol table can't resolve a type, it marks it as `"unknown"` and all type-checking rules skip that variable. No false positives from guessing.

---

## 6. Quick-Fix Actions

CodeMirror's `Diagnostic` type supports an `actions` array. Each action has a label and an `apply` function that modifies the editor state.

### 6.1 Action Types

```typescript
interface QuickFixAction {
  name: string;      // Button label: "Fix: Add `;`"
  apply: (view: EditorView, from: number, to: number) => void;
}
```

### 6.2 Supported Quick-Fix Categories

| Category | Example | Action Label | Apply Logic |
|----------|---------|-------------|-------------|
| Insert character | Missing `;` | "Add `;`" | Insert `;` at `to` position |
| Replace text | `Writeline` → `WriteLine` | "Fix: `WriteLine`" | Replace `from..to` with corrected text |
| Remove text | Extra `}`, double `;;` | "Remove" | Delete `from..to` |
| Wrap expression | `Console.ReadLine()` assigned to `int` | "Wrap in `int.Parse()`" | Wrap the expression |
| Add prefix | `"Hello {name}"` → `$"Hello {name}"` | "Add `$` prefix" | Insert `$` before `"` |
| Remove modifier | `public int x = 5;` inside method | "Remove `public`" | Delete the modifier and whitespace |

### 6.3 Quick-Fix Button Behavior

- Clicking the action button in the diagnostic tooltip applies the fix immediately
- The editor should re-lint after the fix is applied (debounced, handled by CodeMirror)
- If a fix changes the document in a way that creates a NEW diagnostic, that's fine — the student sees the new issue naturally
- Fixes are always single-step (no multi-step wizards)

---

## 7. Performance Guidelines

| Guideline | Detail |
|-----------|--------|
| Debounce | Lint runs 400ms after last keystroke, not on every character |
| Max diagnostics | Cap at 50 diagnostics per lint pass — students don't need 200 errors |
| Priority order | Run structural rules first (§4.1), then string rules (§4.2), then typos (§4.3). If structural errors break the parse tree badly, skip deeper semantic checks |
| Tree reuse | Use CodeMirror's incremental parse — the tree is already maintained; don't re-parse |
| Short-circuit | If the document is empty or < 3 characters, return `[]` immediately |
| String scanning | For regex-based checks, pre-filter lines that could match before running expensive patterns |
| Symbol table cache | Rebuild symbol table only when the document changes, not on every lint call |

---

## 8. Diagnostic Severity Visual Guide

| Severity | Underline Color | Gutter Icon | Use Case |
|----------|---------------|-------------|----------|
| `error` | Red squiggly | 🔴 | Would definitely fail compilation: missing `;`, unmatched `{`, undeclared variable |
| `warning` | Yellow squiggly | 🟡 | Likely mistake but could be intentional: `=` in condition, empty catch, unreachable code |
| `info` | Blue/green dotted | 💡 | Style hints, simplification suggestions, best practices |

---

## 9. Implementation Priority

### Phase 1 — Ship First (1–2 days)

- [ ] **Structural rules** (§4.1): Unmatched `{}`, `()`, `[]`; missing semicolons; mismatched delimiters
- [ ] **String literal rules** (§4.2.1): Unclosed `"`, `'`, `@"` strings
- [ ] **Top 10 typo rules** (§4.3.1–4.3.2): `console`→`Console`, `Writeline`→`WriteLine`, `Readline`→`ReadLine`, `lenght`→`Length`
- [ ] **Assignment vs comparison** (§4.4.1): `=` vs `==` confusion
- [ ] Quick-fix actions for all Phase 1 rules
- [ ] Diagnostic severity styling (red/yellow/blue underlines + gutter icons)

### Phase 2 — Student Quality of Life (1–2 days)

- [ ] **Full typo dictionary** (§4.3): All class name, method name, keyword casing errors
- [ ] **Method call rules** (§4.6): Missing `()` on methods, `()` on properties, wrong arg count
- [ ] **Control flow rules** (§4.7.1): `foreach` without `in`, `else` without `if`, `case` without `break`
- [ ] **Suspicious patterns** (§4.7.3): `if (condition);`, empty catch, `throw ex;`
- [ ] **String interpolation** (§4.2.2): Missing `$` prefix, unclosed `{}`
- [ ] **Lightweight symbol table** (§5): Declaration extraction for types tracked by explicit declaration

### Phase 3 — Polish (1–2 days)

- [ ] **Uninitialized variables** (§4.4.2): Use before assignment, `var` without initializer, unused variables
- [ ] **Type mismatch rules** (§4.5): Assignment mismatches, `Console.ReadLine()` to `int`, return type mismatches
- [ ] **Condition type checks** (§4.5.3): Non-boolean in `if`/`while`
- [ ] **Class & method rules** (§4.8): `Main` without `static`, access modifier issues, constructor errors
- [ ] **Unreachable code** (§4.7.2): Code after `return`/`break`/`throw`
- [ ] **Style rules** (§4.9): Redundant comparisons, magic numbers, long methods
- [ ] **Parse argument checks** (§4.5.4): `int.Parse(42)`, wrong type passed to known methods

---

## 10. What We're Deliberately NOT Building

| Feature | Why Not |
|---------|---------|
| Full Roslyn-level type inference | Requires a real C# compiler; 80% effort for 10% value |
| Generic type argument inference | `var x = list.First()` → inferring `T` from `List<T>` is complex |
| Overload resolution | Deciding which `Console.WriteLine` overload matches args requires Roslyn |
| Implicit conversion tracking | `int` → `double` is valid in C# but tracking all conversion paths is Roslyn work |
| Namespace resolution | Students write single-file programs; we assume standard implicit usings |
| Null-flow analysis | C# 8+ nullable reference types require sophisticated flow analysis |
| Expression type evaluation | `a + b * c` — inferring the result type of complex expressions |
| Pattern matching analysis | `is`, `switch expressions` — too complex for beginner-focused tooling |
| Async/await validation | `await` without `async`, missing `Task` return — only 2 lectures; low ROI |
| User-defined type member checking | If student defines `class Dog { }`, we don't track `Dog.Bark()` calls |

---

## 11. Testing Strategy

### 11.1 Unit Test Structure

Each rule set gets its own test file matching `*.spec.ts`. Tests provide a code string, run the linter, and assert on diagnostics returned.

```typescript
// structural-rules.spec.ts (example)
describe('CF001 - Unmatched {', () => {
  it('should flag unclosed brace', () => {
    const code = `class Foo {\n  void Bar() {\n    if (true) {\n  }\n}`;
    const diags = runLinter(code);
    expect(diags).toContainDiagnostic('CF001');
  });

  it('should not flag balanced braces', () => {
    const code = `class Foo {\n  void Bar() {\n    if (true) {\n    }\n  }\n}`;
    const diags = runLinter(code);
    expect(diags).not.toContainDiagnostic('CF001');
  });
});
```

### 11.2 Snapshot Tests

For each rule, maintain a pair of files:
- `input.cs` — Code with the specific error
- `expected.json` — Expected diagnostics (rule ID, line, severity)

### 11.3 Common False-Positive Test Cases

| Scenario | Must NOT flag |
|----------|-------------|
| Multi-line method calls | Missing `;` on line ending with `,` |
| Verbatim strings spanning lines | Unmatched `"` on single line |
| LINQ chain across lines | Missing `;` on intermediate `.Where(...)` lines |
| Lambda bodies | `=>` expression without `{}` block |
| `for (;;)` | Double `;` inside `for` header |
| Object/collection initializers | `new List<int> { 1, 2, 3 }` — no `;` after items |
| Conditional ternary across lines | `? value1 : value2` on separate lines |
| `do { } while (condition);` | `while` here is NOT a loop start — don't flag missing `{` |
| Attribute syntax `[Serializable]` | Not an unmatched `[` |
| String with escaped quotes `"He said \"hi\""` | Not an unterminated string |
| Interpolated string with format `$"{value:N2}"` | `:` is not an error inside `{}` |

---

## 12. Surgical Claude CLI Prompt (For Implementation Phase)

```
Read ONLY these files from my project:
1. The Angular editor component: find src -name "*editor*" -name "*.ts"
2. The existing csharp-linter.ts if it exists: find src -name "*linter*"
3. The completion-registry.ts (for known method/property names): find src -name "*registry*" -o -name "*known-types*"
4. package.json (for @codemirror packages)

Then read both spec files:
- CODEFEST-EDITOR-INTELLISENSE-SPEC.md
- CODEFEST-EDITOR-DIAGNOSTICS-SPEC.md

Implement Phase 1 from the Diagnostics spec:
- Create src/app/editor/extensions/diagnostics/ folder
- Create structural-rules.ts (§4.1)
- Create string-literal-rules.ts (§4.2.1)
- Create typo-rules.ts (§4.3 — top 10 entries only)
- Create assignment-rules.ts (§4.4.1)
- Create diagnostic-helpers.ts (shared utility)
- Update csharp-linter.ts to orchestrate all rule sets
- Wire quick-fix actions into each diagnostic
- Do NOT install new packages — all deps should already be there

Show me the files before writing them.
```

---

## Appendix A: Rule ID Reference

| Range | Category | Section |
|-------|----------|---------|
| CF001–CF007 | Unmatched delimiters | §4.1.1 |
| CF010–CF014 | Missing semicolons | §4.1.2 |
| CF020–CF022 | Mismatched delimiters | §4.1.3 |
| CF030–CF038 | String & interpolation errors | §4.2 |
| CF040–CF054 | Class name typos/casing | §4.3.1 |
| CF060–CF089 | Method name typos/casing | §4.3.2 |
| CF090–CF106 | Keyword casing | §4.3.3 |
| CF110–CF113 | Assignment vs comparison | §4.4.1 |
| CF120–CF124 | Uninitialized / unused variables | §4.4.2 |
| CF130–CF157 | Type mismatches | §4.5 |
| CF160–CF176 | Method call errors | §4.6 |
| CF180–CF205 | Control flow errors | §4.7 |
| CF210–CF232 | Class & declaration errors | §4.8 |
| CF240–CF252 | Style & best practices | §4.9 |

**Total: ~130 rules** covering the errors that hit intro C# students 90% of the time.
