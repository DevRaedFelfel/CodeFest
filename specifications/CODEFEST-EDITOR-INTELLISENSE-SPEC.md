# CodeFest Editor IntelliSense & Syntax Checking Specification

**Project:** CodeFest — Interactive Coding Challenge Platform  
**Scope:** Client-side editor enhancements for CodeMirror 6 (Angular 17+)  
**Course:** Introduction to Programming with C# 2025  
**Philosophy:** 20% effort → 80% value. VS Code-like experience for a curated set of classes.  
**Source of truth:** [`RaedFelfelInstructor/programming2025`](https://github.com/RaedFelfelInstructor/programming2025) — 15 weeks, 90 markdown files analyzed.  
**Enrichment policy:** Every included class exposes its **full public API** (all methods, properties, fields) — not just the subset used in lectures. Students who explore beyond the course get the same discovery experience as VS Code.

---

## 1. Design Principles

1. **Curated classes, full APIs** — We hand-pick *which* classes to include (based on the course + common needs), but for each included class we expose its **complete public interface**. No `System.IO.Compression`, no `System.Reflection`, no `HttpClient` — but `Console`, `Math`, `string`, `List<T>`, etc. get full coverage. Members used in the course are boosted in priority; extra members appear lower in the dropdown.
2. **Client-side only** — No Language Server Protocol, no Roslyn on the server. All IntelliSense runs in the browser via CodeMirror 6 extensions.
3. **Progressive disclosure** — Completions can optionally be gated per challenge/week so students don't see `async/await` in Week 2.
4. **Non-blocking** — Syntax hints are advisory (squiggly underlines, info tooltips). They never prevent code submission — the server-side compiler is the source of truth.

---

## 2. Stack & Dependencies

| Component | Package | Purpose |
|-----------|---------|---------|
| Editor | `@codemirror/view`, `@codemirror/state` | Core editor |
| C# grammar | `@codemirror/lang-csharp` or Lezer C# grammar | Syntax highlighting + parse tree |
| Autocomplete | `@codemirror/autocomplete` | Completion UI and engine |
| Lint | `@codemirror/lint` | Squiggly underline diagnostics |
| Bracket matching | `@codemirror/language` (`bracketMatching`) | Highlight matching `{}`, `()`, `[]` |
| Auto-close | `@codemirror/autocomplete` (`closeBrackets`) | Auto-insert closing `}`, `)`, `]`, `"`, `'` |
| Tooltips | `@codemirror/view` (`hoverTooltip`) | Hover info on types and methods |

---

## 3. Feature Breakdown

### 3.1 Autocomplete — Completion Sources

All completions are registered via CodeMirror's `autocompletion()` extension with custom `CompletionSource` functions. Completions trigger on `.` (member access) and on typing keywords/type names.

#### 3.1.1 C# Keywords (Always Available)

```
// Control flow
if, else, switch, case, default, break, continue, return,
for, foreach, while, do, in

// Declarations
class, interface, abstract, virtual, override, static,
void, public, private, protected, internal,
namespace, using, new, this, base, var, const, readonly,
enum, struct, get, set

// Type checking
is, as, typeof

// Error handling
try, catch, finally, throw

// Literals & operators
null, true, false

// Async (Week 15 only)
async, await
```

**Snippet templates** for keywords (expand on Tab/Enter):

| Trigger | Expands To |
|---------|-----------|
| `if` | `if (${condition})\n{\n    ${cursor}\n}` |
| `ifelse` | `if (${condition})\n{\n    ${cursor}\n}\nelse\n{\n    \n}` |
| `for` | `for (int ${i} = 0; ${i} < ${length}; ${i}++)\n{\n    ${cursor}\n}` |
| `foreach` | `foreach (var ${item} in ${collection})\n{\n    ${cursor}\n}` |
| `while` | `while (${condition})\n{\n    ${cursor}\n}` |
| `dowhile` | `do\n{\n    ${cursor}\n} while (${condition});` |
| `switch` | `switch (${variable})\n{\n    case ${value}:\n        ${cursor}\n        break;\n    default:\n        break;\n}` |
| `try` | `try\n{\n    ${cursor}\n}\ncatch (Exception ex)\n{\n    Console.WriteLine(ex.Message);\n}` |
| `trycf` | `try\n{\n    ${cursor}\n}\ncatch (Exception ex)\n{\n    Console.WriteLine(ex.Message);\n}\nfinally\n{\n    \n}` |
| `cw` | `Console.WriteLine(${cursor});` |
| `cr` | `Console.ReadLine()` |
| `class` | `class ${Name}\n{\n    ${cursor}\n}` |
| `prop` | `public ${Type} ${Name} { get; set; }` |
| `propf` | `private ${type} _${name};\npublic ${Type} ${Name}\n{\n    get { return _${name}; }\n    set { _${name} = value; }\n}` |
| `ctor` | `public ${ClassName}(${parameters})\n{\n    ${cursor}\n}` |
| `main` | `static void Main(string[] args)\n{\n    ${cursor}\n}` |
| `svm` | Same as `main` |

#### 3.1.2 Primitive Types & Built-in Value Types

These complete as top-level type names and in declarations:

| Type | Usage Count in Course | Priority |
|------|----------------------|----------|
| `int` | 1356 | Highest |
| `string` | 1318 | Highest |
| `double` | 632 | High |
| `bool` | 188 | High |
| `decimal` | 207 | High |
| `char` | 32 | Medium |
| `long` | 42 | Medium |
| `float` | 17 | Low |
| `short` | 10 | Low |
| `byte` | 5 | Low |
| `object` | — | Low |
| `void` | 288 | High (return type) |
| `var` | 104 | High |

#### 3.1.3 Console Class — Full API (Top Priority — 1511 uses in course)

Trigger: typing `Console.`

**Methods (sorted by course relevance, then alphabetical):**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `WriteLine` | `void (string value)` | Writes text followed by a new line | ★★★ Course core |
| `WriteLine` | `void (string format, params object[] args)` | Writes formatted text | ★★★ |
| `WriteLine` | `void ()` | Writes an empty line | ★★★ |
| `WriteLine` | `void (int value)` | Writes an integer | ★★★ |
| `WriteLine` | `void (double value)` | Writes a double | ★★★ |
| `WriteLine` | `void (bool value)` | Writes a boolean | ★★★ |
| `WriteLine` | `void (char value)` | Writes a character | ★★ |
| `WriteLine` | `void (decimal value)` | Writes a decimal | ★★ |
| `WriteLine` | `void (long value)` | Writes a long | ★★ |
| `WriteLine` | `void (object value)` | Writes an object's ToString | ★★ |
| `WriteLine` | `void (char[] buffer)` | Writes a char array | ★ |
| `Write` | `void (string value)` | Writes text without a new line | ★★★ Course core |
| `Write` | `void (string format, params object[] args)` | Writes formatted text | ★★★ |
| `Write` | `void (int/double/bool/char/decimal/long/object value)` | Writes value without newline | ★★ |
| `ReadLine` | `string? ()` | Reads a line of input from the user | ★★★ Course core |
| `ReadKey` | `ConsoleKeyInfo ()` | Reads next key press (displayed) | ★★ |
| `ReadKey` | `ConsoleKeyInfo (bool intercept)` | Reads next key press (optionally hidden) | ★★ |
| `Read` | `int ()` | Reads next character as int | ★ |
| `Clear` | `void ()` | Clears the console screen | ★★ |
| `Beep` | `void ()` | Plays a beep sound | ★ |
| `Beep` | `void (int frequency, int duration)` | Plays beep at specified frequency/duration (ms) | ★ |
| `ResetColor` | `void ()` | Resets foreground and background to defaults | ★★ |
| `SetCursorPosition` | `void (int left, int top)` | Sets cursor position in the buffer | ★ |
| `SetIn` | `void (TextReader newIn)` | Redirects standard input | ★ |
| `SetOut` | `void (TextWriter newOut)` | Redirects standard output | ★ |
| `SetError` | `void (TextWriter newError)` | Redirects standard error | ★ |
| `OpenStandardInput` | `Stream ()` | Acquires standard input stream | ★ |
| `OpenStandardOutput` | `Stream ()` | Acquires standard output stream | ★ |
| `OpenStandardError` | `Stream ()` | Acquires standard error stream | ★ |
| `SetBufferSize` | `void (int width, int height)` | Sets buffer dimensions | ★ |
| `SetWindowSize` | `void (int width, int height)` | Sets window dimensions | ★ |
| `SetWindowPosition` | `void (int left, int top)` | Sets window position | ★ |
| `MoveBufferArea` | `void (int srcL, int srcT, int srcW, int srcH, int tgtL, int tgtT)` | Copies buffer area | ★ |
| `GetCursorPosition` | `(int Left, int Top) ()` | Gets current cursor position | ★ |

**Properties:**

| Property | Type | Detail | Boost |
|----------|------|--------|-------|
| `ForegroundColor` | `ConsoleColor` | Gets/sets text color | ★★ |
| `BackgroundColor` | `ConsoleColor` | Gets/sets background color | ★★ |
| `Title` | `string` | Gets/sets console window title | ★ |
| `CursorLeft` | `int` | Gets/sets cursor column position | ★ |
| `CursorTop` | `int` | Gets/sets cursor row position | ★ |
| `CursorVisible` | `bool` | Gets/sets cursor visibility | ★ |
| `CursorSize` | `int` | Gets/sets cursor height in cell | ★ |
| `WindowWidth` | `int` | Gets/sets console window width | ★ |
| `WindowHeight` | `int` | Gets/sets console window height | ★ |
| `WindowLeft` | `int` | Gets/sets window left position | ★ |
| `WindowTop` | `int` | Gets/sets window top position | ★ |
| `BufferWidth` | `int` | Gets/sets buffer width | ★ |
| `BufferHeight` | `int` | Gets/sets buffer height | ★ |
| `LargestWindowWidth` | `int` | Max possible window width | ★ |
| `LargestWindowHeight` | `int` | Max possible window height | ★ |
| `KeyAvailable` | `bool` | True if a key press is waiting | ★ |
| `CapsLock` | `bool` | True if Caps Lock is on | ★ |
| `NumberLock` | `bool` | True if Num Lock is on | ★ |
| `IsInputRedirected` | `bool` | True if stdin is redirected | ★ |
| `IsOutputRedirected` | `bool` | True if stdout is redirected | ★ |
| `IsErrorRedirected` | `bool` | True if stderr is redirected | ★ |
| `In` | `TextReader` | Standard input stream | ★ |
| `Out` | `TextWriter` | Standard output stream | ★ |
| `Error` | `TextWriter` | Standard error stream | ★ |
| `InputEncoding` | `Encoding` | Gets/sets input encoding | ★ |
| `OutputEncoding` | `Encoding` | Gets/sets output encoding | ★ |
| `TreatControlCAsInput` | `bool` | Gets/sets Ctrl+C handling | ★ |

**Events:**

| Event | Detail |
|-------|--------|
| `CancelKeyPress` | Occurs when Ctrl+C or Ctrl+Break is pressed |

**ConsoleColor enum** (for `ForegroundColor`/`BackgroundColor`):

```
Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta,
DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta,
Yellow, White
```

#### 3.1.4 Type Conversion Methods

Trigger: typing `int.`, `double.`, `decimal.`, `Convert.`

**Parse/TryParse methods:**

| Trigger | Members |
|---------|---------|
| `int.` | `Parse(string s)` → `int`, `TryParse(string s, out int result)` → `bool` |
| `double.` | `Parse(string s)` → `double`, `TryParse(string s, out double result)` → `bool` |
| `decimal.` | `Parse(string s)` → `decimal`, `TryParse(string s, out decimal result)` → `bool` |
| `bool.` | `Parse(string s)` → `bool` |

**Convert class — Full API:**

| Trigger | Members |
|---------|---------|
| `Convert.` | `ToInt32(value)` ★★★, `ToInt16(value)`, `ToInt64(value)`, `ToByte(value)` |
| | `ToDouble(value)` ★★★, `ToSingle(value)`, `ToDecimal(value)` ★★ |
| | `ToBoolean(value)` ★★, `ToChar(value)`, `ToString(value)` ★★ |
| | `ToDateTime(value)`, `ToBase64String(byte[])`, `FromBase64String(string)` |
| | `ChangeType(object value, Type conversionType)` |

#### 3.1.5 String Members — Full API

Trigger: after a variable known/inferred to be `string`, or after `"".`

**Instance members (sorted by course relevance):**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Length` | `int` (property) | Number of characters | ★★★ |
| `ToLower()` | `string` | Converts to lowercase | ★★★ |
| `ToUpper()` | `string` | Converts to uppercase | ★★★ |
| `Trim()` | `string` | Removes leading/trailing whitespace | ★★★ |
| `Contains(string)` | `bool` | Checks if string contains substring | ★★★ |
| `Contains(char)` | `bool` | Checks if string contains char | ★★ |
| `IndexOf(string)` | `int` | Position of first occurrence, or -1 | ★★★ |
| `IndexOf(char)` | `int` | Position of first char occurrence | ★★ |
| `IndexOf(string, int startIndex)` | `int` | Search from position | ★★ |
| `Substring(int startIndex)` | `string` | From position to end | ★★★ |
| `Substring(int startIndex, int length)` | `string` | From position for N chars | ★★★ |
| `StartsWith(string)` | `bool` | Checks prefix | ★★ |
| `EndsWith(string)` | `bool` | Checks suffix | ★★ |
| `Replace(string old, string new)` | `string` | Replaces all occurrences | ★★★ |
| `Replace(char old, char new)` | `string` | Replaces all char occurrences | ★★ |
| `Split(char separator)` | `string[]` | Splits into array | ★★ |
| `Split(char[], StringSplitOptions)` | `string[]` | Splits with options | ★ |
| `Split(string separator, StringSplitOptions)` | `string[]` | Splits by string | ★ |
| `Insert(int index, string)` | `string` | Inserts at position | ★★ |
| `Remove(int startIndex)` | `string` | Removes from position to end | ★★ |
| `Remove(int startIndex, int count)` | `string` | Removes N chars from position | ★★ |
| `Equals(string)` | `bool` | Case-sensitive comparison | ★★ |
| `Equals(string, StringComparison)` | `bool` | Comparison with options | ★ |
| `CompareTo(string)` | `int` | Alphabetical comparison | ★★ |
| `ToString()` | `string` | Returns self | ★ |
| `ToCharArray()` | `char[]` | Converts to char array | ★★ |
| `TrimStart()` | `string` | Removes leading whitespace | ★ |
| `TrimStart(char)` | `string` | Removes leading specific char | ★ |
| `TrimEnd()` | `string` | Removes trailing whitespace | ★ |
| `TrimEnd(char)` | `string` | Removes trailing specific char | ★ |
| `PadLeft(int totalWidth)` | `string` | Right-aligns by padding with spaces | ★ |
| `PadLeft(int totalWidth, char)` | `string` | Right-aligns by padding with char | ★ |
| `PadRight(int totalWidth)` | `string` | Left-aligns by padding with spaces | ★ |
| `PadRight(int totalWidth, char)` | `string` | Left-aligns by padding with char | ★ |
| `LastIndexOf(string)` | `int` | Position of last occurrence | ★ |
| `LastIndexOf(char)` | `int` | Position of last char occurrence | ★ |
| `Concat(string)` | `string` | Concatenates (prefer `+` operator) | ★ |
| `CopyTo(int srcIndex, char[] dest, int destIndex, int count)` | `void` | Copies chars to array | ★ |
| `Normalize()` | `string` | Unicode normalization | ★ |
| `GetHashCode()` | `int` | Hash code | ★ |
| `GetType()` | `Type` | Runtime type | ★ |
| `this[int index]` | `char` (indexer) | Gets character at position | ★★ |

**Static string methods** (trigger: `string.`):

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `IsNullOrWhiteSpace(string)` | `bool` | Checks null, empty, or whitespace | ★★★ |
| `IsNullOrEmpty(string)` | `bool` | Checks null or empty | ★★★ |
| `Join(string separator, IEnumerable)` | `string` | Joins elements with separator | ★★ |
| `Join(string separator, string[])` | `string` | Joins array with separator | ★★ |
| `Join(char separator, string[])` | `string` | Joins array with char separator | ★ |
| `Empty` | `string` (field) | The empty string `""` | ★★ |
| `Format(string format, params object[])` | `string` | Composite formatting | ★★ |
| `Concat(string, string)` | `string` | Concatenates two strings | ★ |
| `Concat(params string[])` | `string` | Concatenates multiple strings | ★ |
| `Compare(string, string)` | `int` | Compares two strings | ★ |
| `Compare(string, string, bool ignoreCase)` | `int` | Compares with case option | ★ |
| `Compare(string, string, StringComparison)` | `int` | Compares with comparison type | ★ |
| `Copy(string)` | `string` | Creates a copy (deprecated in .NET 8) | ★ |
| `Equals(string, string)` | `bool` | Static equality check | ★ |
| `Equals(string, string, StringComparison)` | `bool` | Static equality with options | ★ |
| `Intern(string)` | `string` | Retrieves interned reference | ★ |
| `IsInterned(string)` | `string?` | Checks if interned | ★ |

#### 3.1.6 Math Class — Full API

Trigger: `Math.`

**Constants:**

| Member | Type | Value | Boost |
|--------|------|-------|-------|
| `PI` | `double` | 3.14159265358979... | ★★★ |
| `E` | `double` | 2.71828182845904... | ★★ |
| `Tau` | `double` | 6.28318530717958... (2π) | ★ |

**Common methods (course-used, highest boost):**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Pow(double x, double y)` | `double` | x raised to power y | ★★★ |
| `Sqrt(double)` | `double` | Square root | ★★★ |
| `Max(double a, double b)` | `double` | Larger of two values | ★★★ |
| `Max(int a, int b)` | `int` | Larger of two ints | ★★★ |
| `Min(double a, double b)` | `double` | Smaller of two values | ★★★ |
| `Min(int a, int b)` | `int` | Smaller of two ints | ★★★ |
| `Floor(double)` | `double` | Rounds toward negative infinity | ★★★ |
| `Ceiling(double)` | `double` | Rounds toward positive infinity | ★★★ |
| `Abs(double)` | `double` | Absolute value | ★★★ |
| `Abs(int)` | `int` | Absolute value of int | ★★★ |
| `Round(double)` | `double` | Rounds to nearest integer | ★★★ |
| `Round(double, int digits)` | `double` | Rounds to N decimal places | ★★★ |
| `Round(double, MidpointRounding)` | `double` | Rounds with specified rounding mode | ★★ |

**Rounding & truncation:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Truncate(double)` | `double` | Removes fractional part | ★★ |
| `Truncate(decimal)` | `decimal` | Removes fractional part | ★★ |
| `Floor(decimal)` | `decimal` | Rounds decimal down | ★ |
| `Ceiling(decimal)` | `decimal` | Rounds decimal up | ★ |
| `Round(decimal)` | `decimal` | Rounds decimal | ★ |
| `Round(decimal, int)` | `decimal` | Rounds decimal to N places | ★ |

**Trigonometric:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Sin(double)` | `double` | Sine (radians) | ★★ |
| `Cos(double)` | `double` | Cosine (radians) | ★★ |
| `Tan(double)` | `double` | Tangent (radians) | ★★ |
| `Asin(double)` | `double` | Arcsine → radians | ★ |
| `Acos(double)` | `double` | Arccosine → radians | ★ |
| `Atan(double)` | `double` | Arctangent → radians | ★ |
| `Atan2(double y, double x)` | `double` | Angle from coordinates | ★ |
| `Sinh(double)` | `double` | Hyperbolic sine | ★ |
| `Cosh(double)` | `double` | Hyperbolic cosine | ★ |
| `Tanh(double)` | `double` | Hyperbolic tangent | ★ |

**Logarithmic & exponential:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Log(double)` | `double` | Natural logarithm (base e) | ★★ |
| `Log(double, double newBase)` | `double` | Logarithm with specified base | ★ |
| `Log10(double)` | `double` | Base-10 logarithm | ★★ |
| `Log2(double)` | `double` | Base-2 logarithm | ★ |
| `Exp(double)` | `double` | e raised to specified power | ★ |

**Sign & clamping:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Sign(double)` | `int` | Returns -1, 0, or 1 | ★★ |
| `Sign(int)` | `int` | Returns -1, 0, or 1 | ★★ |
| `Clamp(double value, double min, double max)` | `double` | Clamps to range | ★★ |
| `Clamp(int value, int min, int max)` | `int` | Clamps int to range | ★★ |

**Bit manipulation & other:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `DivRem(int a, int b, out int remainder)` | `int` | Division with remainder | ★ |
| `IEEERemainder(double x, double y)` | `double` | IEEE 754 remainder | ★ |
| `BigMul(int a, int b)` | `long` | Full 64-bit product of two ints | ★ |
| `ScaleB(double x, int n)` | `double` | x × 2^n | ★ |
| `BitDecrement(double)` | `double` | Next smaller double | ★ |
| `BitIncrement(double)` | `double` | Next larger double | ★ |
| `CopySign(double magnitude, double sign)` | `double` | Copies sign to magnitude | ★ |
| `FusedMultiplyAdd(double x, double y, double z)` | `double` | (x × y) + z in one operation | ★ |
| `MaxMagnitude(double x, double y)` | `double` | Larger absolute value | ★ |
| `MinMagnitude(double x, double y)` | `double` | Smaller absolute value | ★ |

#### 3.1.7 Collections — `List<T>` — Full API

Trigger: after a variable of type `List<>`, or when typing `new List`

**Constructor completions:**
- `new List<int>()`
- `new List<string>()`
- `new List<double>()`
- `new List<T>(int capacity)` — pre-allocates
- `new List<T>(IEnumerable<T> collection)` — copies from existing

**Instance members (sorted by course relevance):**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Add(T item)` | `void` | Adds item to end | ★★★ |
| `Count` | `int` (property) | Number of elements | ★★★ |
| `Remove(T item)` | `bool` | Removes first occurrence | ★★★ |
| `RemoveAt(int index)` | `void` | Removes at index | ★★★ |
| `Clear()` | `void` | Removes all items | ★★★ |
| `Contains(T item)` | `bool` | Checks if item exists | ★★★ |
| `IndexOf(T item)` | `int` | Returns index or -1 | ★★★ |
| `Sort()` | `void` | Sorts in place (default comparer) | ★★★ |
| `Reverse()` | `void` | Reverses in place | ★★★ |
| `ToArray()` | `T[]` | Converts to array | ★★★ |
| `Exists(Predicate<T>)` | `bool` | True if any element matches | ★★ |
| `Find(Predicate<T>)` | `T` | First element matching predicate | ★★ |
| `Insert(int index, T item)` | `void` | Inserts at position | ★★ |
| `this[int index]` | `T` (indexer) | Gets/sets element at index | ★★★ |
| `AddRange(IEnumerable<T>)` | `void` | Adds multiple items | ★★ |
| `InsertRange(int index, IEnumerable<T>)` | `void` | Inserts multiple at position | ★ |
| `RemoveAll(Predicate<T>)` | `int` | Removes all matching, returns count | ★★ |
| `RemoveRange(int index, int count)` | `void` | Removes range of elements | ★ |
| `FindAll(Predicate<T>)` | `List<T>` | All elements matching predicate | ★★ |
| `FindIndex(Predicate<T>)` | `int` | Index of first match | ★★ |
| `FindLast(Predicate<T>)` | `T` | Last element matching predicate | ★ |
| `FindLastIndex(Predicate<T>)` | `int` | Index of last match | ★ |
| `Sort(Comparison<T>)` | `void` | Sorts with custom comparison | ★★ |
| `Sort(IComparer<T>)` | `void` | Sorts with comparer | ★ |
| `Sort(int index, int count, IComparer<T>)` | `void` | Sorts a range | ★ |
| `BinarySearch(T item)` | `int` | Searches sorted list | ★ |
| `BinarySearch(T item, IComparer<T>)` | `int` | Searches with comparer | ★ |
| `Capacity` | `int` (property) | Gets/sets internal array size | ★ |
| `TrimExcess()` | `void` | Reduces capacity to count | ★ |
| `CopyTo(T[] array)` | `void` | Copies to array | ★ |
| `CopyTo(T[] array, int arrayIndex)` | `void` | Copies to array at index | ★ |
| `CopyTo(int index, T[] array, int arrayIndex, int count)` | `void` | Copies range | ★ |
| `GetRange(int index, int count)` | `List<T>` | Returns sub-list | ★★ |
| `IndexOf(T item, int index)` | `int` | Searches from position | ★ |
| `LastIndexOf(T item)` | `int` | Index of last occurrence | ★ |
| `Reverse(int index, int count)` | `void` | Reverses a range | ★ |
| `TrueForAll(Predicate<T>)` | `bool` | True if all elements match | ★ |
| `ForEach(Action<T>)` | `void` | Executes action on each element | ★★ |
| `ConvertAll<TOutput>(Converter<T, TOutput>)` | `List<TOutput>` | Converts all elements | ★ |
| `AsReadOnly()` | `ReadOnlyCollection<T>` | Returns read-only wrapper | ★ |
| `GetEnumerator()` | `List<T>.Enumerator` | For iteration | ★ |
| `ToString()` | `string` | String representation | ★ |

#### 3.1.8 Collections — `Dictionary<TKey, TValue>` — Full API

Trigger: after a `Dictionary` variable

**Instance members:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Add(TKey key, TValue value)` | `void` | Adds key-value pair (throws if exists) | ★★★ |
| `Remove(TKey key)` | `bool` | Removes by key | ★★★ |
| `ContainsKey(TKey key)` | `bool` | Checks if key exists | ★★★ |
| `ContainsValue(TValue value)` | `bool` | Checks if value exists | ★★ |
| `TryGetValue(TKey, out TValue)` | `bool` | Safe lookup | ★★★ |
| `TryAdd(TKey key, TValue value)` | `bool` | Adds if key doesn't exist | ★★ |
| `Count` | `int` (property) | Number of pairs | ★★★ |
| `Keys` | `Dictionary.KeyCollection` (property) | All keys | ★★★ |
| `Values` | `Dictionary.ValueCollection` (property) | All values | ★★★ |
| `Clear()` | `void` | Removes all pairs | ★★ |
| `this[TKey key]` | `TValue` (indexer) | Gets/sets value by key | ★★★ |
| `GetValueOrDefault(TKey)` | `TValue` | Returns value or default | ★★ |
| `GetValueOrDefault(TKey, TValue defaultValue)` | `TValue` | Returns value or specified default | ★★ |
| `EnsureCapacity(int capacity)` | `int` | Pre-allocates space | ★ |
| `TrimExcess()` | `void` | Reduces internal capacity | ★ |
| `TrimExcess(int capacity)` | `void` | Sets specific capacity | ★ |
| `GetEnumerator()` | `Enumerator` | For iteration | ★ |

#### 3.1.9 Collections — `Stack<T>` and `Queue<T>` — Full API

**Stack<T> members:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Push(T item)` | `void` | Pushes onto top | ★★★ |
| `Pop()` | `T` | Removes and returns top (throws if empty) | ★★★ |
| `Peek()` | `T` | Returns top without removing | ★★★ |
| `Count` | `int` (property) | Number of elements | ★★★ |
| `Clear()` | `void` | Removes all elements | ★★ |
| `Contains(T item)` | `bool` | Checks if item exists | ★★ |
| `TryPop(out T result)` | `bool` | Safe pop | ★★ |
| `TryPeek(out T result)` | `bool` | Safe peek | ★★ |
| `ToArray()` | `T[]` | Copies to array (top first) | ★ |
| `TrimExcess()` | `void` | Reduces capacity | ★ |
| `EnsureCapacity(int)` | `int` | Pre-allocates | ★ |
| `GetEnumerator()` | `Enumerator` | For iteration | ★ |

**Queue<T> members:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Enqueue(T item)` | `void` | Adds to end | ★★★ |
| `Dequeue()` | `T` | Removes and returns front (throws if empty) | ★★★ |
| `Peek()` | `T` | Returns front without removing | ★★★ |
| `Count` | `int` (property) | Number of elements | ★★★ |
| `Clear()` | `void` | Removes all elements | ★★ |
| `Contains(T item)` | `bool` | Checks if item exists | ★★ |
| `TryDequeue(out T result)` | `bool` | Safe dequeue | ★★ |
| `TryPeek(out T result)` | `bool` | Safe peek | ★★ |
| `ToArray()` | `T[]` | Copies to array (front first) | ★ |
| `TrimExcess()` | `void` | Reduces capacity | ★ |
| `EnsureCapacity(int)` | `int` | Pre-allocates | ★ |
| `GetEnumerator()` | `Enumerator` | For iteration | ★ |

**HashSet<T> members** (bonus — not heavily used in course but commonly needed):

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Add(T item)` | `bool` | Adds item (returns false if exists) | ★★ |
| `Remove(T item)` | `bool` | Removes item | ★★ |
| `Contains(T item)` | `bool` | O(1) lookup | ★★ |
| `Count` | `int` (property) | Number of elements | ★★ |
| `Clear()` | `void` | Removes all | ★ |
| `UnionWith(IEnumerable<T>)` | `void` | Adds all from other | ★ |
| `IntersectWith(IEnumerable<T>)` | `void` | Keeps only common | ★ |
| `ExceptWith(IEnumerable<T>)` | `void` | Removes all in other | ★ |
| `IsSubsetOf(IEnumerable<T>)` | `bool` | Subset check | ★ |
| `IsSupersetOf(IEnumerable<T>)` | `bool` | Superset check | ★ |
| `Overlaps(IEnumerable<T>)` | `bool` | Any common elements | ★ |
| `SetEquals(IEnumerable<T>)` | `bool` | Same elements | ★ |
| `SymmetricExceptWith(IEnumerable<T>)` | `void` | XOR of sets | ★ |
| `TryGetValue(T, out T)` | `bool` | Gets actual stored value | ★ |
| `ToArray()` | `T[]` | Converts to array | ★ |

#### 3.1.10 Array Members — Full API

Trigger: after a variable of type `T[]`

**Instance members:**

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Length` | `int` (property) | Total number of elements | ★★★ |
| `GetLength(int dimension)` | `int` | Length of specific dimension | ★★ |
| `Rank` | `int` (property) | Number of dimensions | ★ |
| `GetLowerBound(int dimension)` | `int` | Lower bound of dimension | ★ |
| `GetUpperBound(int dimension)` | `int` | Upper bound of dimension | ★ |
| `Clone()` | `object` | Shallow copy | ★ |
| `CopyTo(Array dest, int index)` | `void` | Copies to array | ★ |
| `GetValue(int index)` | `object` | Gets element | ★ |
| `SetValue(object value, int index)` | `void` | Sets element | ★ |
| `GetEnumerator()` | `IEnumerator` | For iteration | ★ |

**Static Array methods** (trigger: `Array.`):

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Sort(Array)` | `void` | Sorts array in place | ★★★ |
| `Sort<T>(T[], Comparison<T>)` | `void` | Sorts with custom comparison | ★★ |
| `Reverse(Array)` | `void` | Reverses array | ★★★ |
| `Copy(Array src, Array dest, int length)` | `void` | Copies elements | ★★ |
| `Copy(Array src, int srcIdx, Array dest, int destIdx, int length)` | `void` | Copies range | ★ |
| `IndexOf(Array, object)` | `int` | Finds first index | ★★ |
| `LastIndexOf(Array, object)` | `int` | Finds last index | ★ |
| `Find<T>(T[], Predicate<T>)` | `T` | Finds first match | ★★ |
| `FindAll<T>(T[], Predicate<T>)` | `T[]` | Finds all matches | ★★ |
| `FindIndex<T>(T[], Predicate<T>)` | `int` | Index of first match | ★★ |
| `Exists<T>(T[], Predicate<T>)` | `bool` | Any match exists | ★ |
| `TrueForAll<T>(T[], Predicate<T>)` | `bool` | All match | ★ |
| `ForEach<T>(T[], Action<T>)` | `void` | Executes on each | ★ |
| `ConvertAll<TIn, TOut>(TIn[], Converter<TIn, TOut>)` | `TOut[]` | Converts all | ★ |
| `Resize<T>(ref T[], int newSize)` | `void` | Resizes array | ★ |
| `Clear(Array, int index, int length)` | `void` | Zeros out range | ★ |
| `Fill<T>(T[], T value)` | `void` | Fills with value | ★★ |
| `BinarySearch(Array, object)` | `int` | Searches sorted array | ★ |
| `Empty<T>()` | `T[]` | Returns empty array | ★ |
| `CreateInstance(Type, int)` | `Array` | Creates typed array | ★ |

#### 3.1.11 LINQ Extension Methods — Full API (Week 14+)

Trigger: after any `IEnumerable<T>` / `List<T>` / array, when followed by `.`  
Gating: only active if challenge is from Week 14 or later, or if `using System.Linq;` is present.

**Filtering & projection:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Where(Func<T, bool>)` | `IEnumerable<T>` | Filters elements | ★★★ |
| `Where(Func<T, int, bool>)` | `IEnumerable<T>` | Filters with index | ★ |
| `Select(Func<T, TResult>)` | `IEnumerable<TResult>` | Transforms elements | ★★★ |
| `Select(Func<T, int, TResult>)` | `IEnumerable<TResult>` | Transforms with index | ★ |
| `SelectMany(Func<T, IEnumerable<TResult>>)` | `IEnumerable<TResult>` | Flattens nested collections | ★ |
| `OfType<TResult>()` | `IEnumerable<TResult>` | Filters by type | ★ |
| `Cast<TResult>()` | `IEnumerable<TResult>` | Casts all elements | ★ |

**Ordering:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `OrderBy(Func<T, TKey>)` | `IOrderedEnumerable<T>` | Sorts ascending | ★★★ |
| `OrderByDescending(Func<T, TKey>)` | `IOrderedEnumerable<T>` | Sorts descending | ★★★ |
| `ThenBy(Func<T, TKey>)` | `IOrderedEnumerable<T>` | Secondary ascending sort | ★★ |
| `ThenByDescending(Func<T, TKey>)` | `IOrderedEnumerable<T>` | Secondary descending sort | ★ |
| `Reverse()` | `IEnumerable<T>` | Reverses order | ★ |
| `Order()` | `IOrderedEnumerable<T>` | Sorts by element (.NET 7+) | ★ |
| `OrderDescending()` | `IOrderedEnumerable<T>` | Sorts descending by element (.NET 7+) | ★ |

**Grouping & joining:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `GroupBy(Func<T, TKey>)` | `IEnumerable<IGrouping<TKey, T>>` | Groups elements | ★★★ |
| `GroupBy(Func<T, TKey>, Func<T, TElement>)` | `IEnumerable<IGrouping<TKey, TElement>>` | Groups with projection | ★★ |
| `Join(inner, outerKey, innerKey, resultSelector)` | `IEnumerable<TResult>` | Inner join | ★ |
| `GroupJoin(inner, outerKey, innerKey, resultSelector)` | `IEnumerable<TResult>` | Group join | ★ |
| `Zip(IEnumerable<TSecond>)` | `IEnumerable<(T, TSecond)>` | Pairs elements | ★ |
| `Zip(IEnumerable<TSecond>, Func<T, TSecond, TResult>)` | `IEnumerable<TResult>` | Pairs with projection | ★ |

**Element selection:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `First()` | `T` | First element (throws if empty) | ★★★ |
| `FirstOrDefault()` | `T?` | First element or default | ★★★ |
| `FirstOrDefault(T defaultValue)` | `T` | First or specified default | ★ |
| `First(Func<T, bool>)` | `T` | First matching predicate | ★★ |
| `FirstOrDefault(Func<T, bool>)` | `T?` | First matching or default | ★★ |
| `Last()` | `T` | Last element | ★★ |
| `LastOrDefault()` | `T?` | Last element or default | ★★ |
| `Last(Func<T, bool>)` | `T` | Last matching predicate | ★ |
| `Single()` | `T` | Exactly one element (throws otherwise) | ★ |
| `SingleOrDefault()` | `T?` | One element or default | ★ |
| `ElementAt(int index)` | `T` | Element at position | ★ |
| `ElementAtOrDefault(int index)` | `T?` | Element at position or default | ★ |
| `DefaultIfEmpty()` | `IEnumerable<T>` | Returns default if empty | ★ |

**Quantifiers & aggregation:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Any()` | `bool` | True if any elements | ★★★ |
| `Any(Func<T, bool>)` | `bool` | True if any match | ★★★ |
| `All(Func<T, bool>)` | `bool` | True if all match | ★★★ |
| `Count()` | `int` | Number of elements | ★★★ |
| `Count(Func<T, bool>)` | `int` | Number matching predicate | ★★ |
| `LongCount()` | `long` | Number of elements (long) | ★ |
| `Sum()` | `numeric` | Sum of elements | ★★★ |
| `Sum(Func<T, numeric>)` | `numeric` | Sum of projected values | ★★ |
| `Average()` | `double` | Average of elements | ★★★ |
| `Average(Func<T, numeric>)` | `double` | Average of projected values | ★★ |
| `Min()` | `T` | Minimum value | ★★★ |
| `Min(Func<T, TResult>)` | `TResult` | Min of projected values | ★★ |
| `MinBy(Func<T, TKey>)` | `T` | Element with min key (.NET 6+) | ★ |
| `Max()` | `T` | Maximum value | ★★★ |
| `Max(Func<T, TResult>)` | `TResult` | Max of projected values | ★★ |
| `MaxBy(Func<T, TKey>)` | `T` | Element with max key (.NET 6+) | ★ |
| `Aggregate(Func<T, T, T>)` | `T` | Accumulates values | ★ |
| `Aggregate(TSeed, Func<TSeed, T, TSeed>)` | `TSeed` | Accumulates with seed | ★ |
| `Contains(T value)` | `bool` | Checks for element | ★★ |
| `SequenceEqual(IEnumerable<T>)` | `bool` | Compares two sequences | ★ |

**Partitioning & set:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Distinct()` | `IEnumerable<T>` | Removes duplicates | ★★★ |
| `DistinctBy(Func<T, TKey>)` | `IEnumerable<T>` | Distinct by key (.NET 6+) | ★ |
| `Take(int n)` | `IEnumerable<T>` | First n elements | ★★ |
| `Take(Range range)` | `IEnumerable<T>` | Elements by range (.NET 6+) | ★ |
| `TakeLast(int n)` | `IEnumerable<T>` | Last n elements | ★ |
| `TakeWhile(Func<T, bool>)` | `IEnumerable<T>` | Takes while predicate true | ★ |
| `Skip(int n)` | `IEnumerable<T>` | Skip first n | ★★ |
| `SkipLast(int n)` | `IEnumerable<T>` | Skip last n | ★ |
| `SkipWhile(Func<T, bool>)` | `IEnumerable<T>` | Skips while predicate true | ★ |
| `Concat(IEnumerable<T>)` | `IEnumerable<T>` | Appends sequence | ★ |
| `Union(IEnumerable<T>)` | `IEnumerable<T>` | Set union | ★ |
| `Intersect(IEnumerable<T>)` | `IEnumerable<T>` | Set intersection | ★ |
| `Except(IEnumerable<T>)` | `IEnumerable<T>` | Set difference | ★ |
| `Chunk(int size)` | `IEnumerable<T[]>` | Splits into chunks (.NET 6+) | ★ |
| `Prepend(T element)` | `IEnumerable<T>` | Adds to beginning | ★ |
| `Append(T element)` | `IEnumerable<T>` | Adds to end | ★ |

**Conversion:**

| Method | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `ToList()` | `List<T>` | Converts to List | ★★★ |
| `ToArray()` | `T[]` | Converts to array | ★★★ |
| `ToDictionary(Func<T, TKey>)` | `Dictionary<TKey, T>` | Converts to dictionary | ★★ |
| `ToDictionary(Func<T, TKey>, Func<T, TValue>)` | `Dictionary<TKey, TValue>` | With value selector | ★★ |
| `ToHashSet()` | `HashSet<T>` | Converts to HashSet | ★ |
| `ToLookup(Func<T, TKey>)` | `ILookup<TKey, T>` | Groups into lookup | ★ |
| `AsEnumerable()` | `IEnumerable<T>` | Returns as IEnumerable | ★ |

#### 3.1.12 Exception Types

Trigger: after `throw new `, or after `catch (`

| Exception | Usage |
|-----------|-------|
| `Exception` | General-purpose |
| `ArgumentException` | Invalid argument |
| `ArgumentNullException` | Null argument |
| `ArgumentOutOfRangeException` | Out-of-range argument |
| `InvalidOperationException` | Invalid state for operation |
| `FormatException` | Parse/conversion failure |
| `IndexOutOfRangeException` | Array/list out of bounds |
| `DivideByZeroException` | Division by zero |
| `NullReferenceException` | Null dereference |
| `IOException` | File I/O failure |
| `NotImplementedException` | Placeholder |
| `OverflowException` | Numeric overflow |

#### 3.1.13 Other System Classes — Full APIs

**Random — Full API** (trigger: after `Random` variable, or `new Random()`):

| Member | Signature | Detail | Boost |
|--------|-----------|--------|-------|
| `Next()` | `int` | Non-negative random integer | ★★★ |
| `Next(int maxValue)` | `int` | Random int in [0, max) | ★★★ |
| `Next(int minValue, int maxValue)` | `int` | Random int in [min, max) | ★★★ |
| `NextDouble()` | `double` | Random double in [0.0, 1.0) | ★★ |
| `NextSingle()` | `float` | Random float in [0.0, 1.0) | ★ |
| `NextInt64()` | `long` | Non-negative random long | ★ |
| `NextInt64(long maxValue)` | `long` | Random long in [0, max) | ★ |
| `NextInt64(long minValue, long maxValue)` | `long` | Random long in [min, max) | ★ |
| `NextBytes(byte[])` | `void` | Fills array with random bytes | ★ |
| `NextBytes(Span<byte>)` | `void` | Fills span with random bytes | ★ |
| **Static:** `Random.Shared` | `Random` (property) | Thread-safe shared instance | ★★ |

**DateTime — Full API** (trigger: `DateTime.` or after `DateTime` variable):

*Static members:*

| Member | Type | Detail | Boost |
|--------|------|--------|-------|
| `Now` | `DateTime` | Current local date and time | ★★★ |
| `Today` | `DateTime` | Current date (midnight) | ★★★ |
| `UtcNow` | `DateTime` | Current UTC date and time | ★★ |
| `MinValue` | `DateTime` | Smallest possible value | ★ |
| `MaxValue` | `DateTime` | Largest possible value | ★ |
| `UnixEpoch` | `DateTime` | Jan 1, 1970 UTC | ★ |
| `Parse(string)` | `DateTime` | Parses date string | ★★ |
| `TryParse(string, out DateTime)` | `bool` | Safe parse | ★★ |
| `ParseExact(string, string format, IFormatProvider)` | `DateTime` | Parses with exact format | ★ |
| `IsLeapYear(int year)` | `bool` | Checks leap year | ★ |
| `DaysInMonth(int year, int month)` | `int` | Days in specified month | ★ |

*Instance members:*

| Member | Type | Detail | Boost |
|--------|------|--------|-------|
| `Year` | `int` | Year component | ★★★ |
| `Month` | `int` | Month (1-12) | ★★★ |
| `Day` | `int` | Day (1-31) | ★★★ |
| `Hour` | `int` | Hour (0-23) | ★★ |
| `Minute` | `int` | Minute (0-59) | ★★ |
| `Second` | `int` | Second (0-59) | ★★ |
| `Millisecond` | `int` | Millisecond (0-999) | ★ |
| `DayOfWeek` | `DayOfWeek` | Day of the week | ★★ |
| `DayOfYear` | `int` | Day of year (1-366) | ★ |
| `Date` | `DateTime` | Date part only (midnight) | ★ |
| `TimeOfDay` | `TimeSpan` | Time part only | ★ |
| `Ticks` | `long` | 100-nanosecond intervals | ★ |
| `Kind` | `DateTimeKind` | Local, Utc, or Unspecified | ★ |
| `ToString()` | `string` | Default format | ★★★ |
| `ToString(string format)` | `string` | Custom format (e.g., "yyyy-MM-dd") | ★★★ |
| `ToShortDateString()` | `string` | Short date format | ★★ |
| `ToLongDateString()` | `string` | Long date format | ★ |
| `ToShortTimeString()` | `string` | Short time format | ★★ |
| `ToLongTimeString()` | `string` | Long time format | ★ |
| `AddDays(double)` | `DateTime` | Adds days | ★★ |
| `AddHours(double)` | `DateTime` | Adds hours | ★★ |
| `AddMinutes(double)` | `DateTime` | Adds minutes | ★ |
| `AddSeconds(double)` | `DateTime` | Adds seconds | ★ |
| `AddMilliseconds(double)` | `DateTime` | Adds milliseconds | ★ |
| `AddMonths(int)` | `DateTime` | Adds months | ★★ |
| `AddYears(int)` | `DateTime` | Adds years | ★★ |
| `AddTicks(long)` | `DateTime` | Adds ticks | ★ |
| `Subtract(DateTime)` | `TimeSpan` | Difference between dates | ★★ |
| `Subtract(TimeSpan)` | `DateTime` | Subtracts duration | ★ |
| `CompareTo(DateTime)` | `int` | Compares dates | ★ |
| `Equals(DateTime)` | `bool` | Equality check | ★ |
| `ToUniversalTime()` | `DateTime` | Converts to UTC | ★ |
| `ToLocalTime()` | `DateTime` | Converts to local | ★ |
| `ToFileTime()` | `long` | Windows file time | ★ |
| `GetHashCode()` | `int` | Hash code | ★ |

**TimeSpan — Full API** (trigger: `TimeSpan.` or after `TimeSpan` variable):

*Static members:*

| Member | Detail | Boost |
|--------|--------|-------|
| `FromDays(double)` | Creates TimeSpan from days | ★★ |
| `FromHours(double)` | Creates from hours | ★★ |
| `FromMinutes(double)` | Creates from minutes | ★★ |
| `FromSeconds(double)` | Creates from seconds | ★★ |
| `FromMilliseconds(double)` | Creates from ms | ★ |
| `Parse(string)` | Parses "hh:mm:ss" | ★ |
| `TryParse(string, out TimeSpan)` | Safe parse | ★ |
| `Zero` | Zero duration | ★ |
| `MinValue` / `MaxValue` | Bounds | ★ |

*Instance members:*

| Member | Detail | Boost |
|--------|--------|-------|
| `Days`, `Hours`, `Minutes`, `Seconds`, `Milliseconds` | Components | ★★ |
| `TotalDays`, `TotalHours`, `TotalMinutes`, `TotalSeconds`, `TotalMilliseconds` | Total in unit | ★★ |
| `Ticks` | Total ticks | ★ |
| `Add(TimeSpan)`, `Subtract(TimeSpan)` | Arithmetic | ★ |
| `Negate()`, `Duration()` | Negation / absolute | ★ |
| `ToString()`, `ToString(string format)` | Formatting | ★ |

**Environment — Full API** (trigger: `Environment.`):

| Member | Type | Detail | Boost |
|--------|------|--------|-------|
| `NewLine` | `string` | Platform line terminator | ★★ |
| `Exit(int exitCode)` | `void` | Terminates the process | ★★ |
| `MachineName` | `string` | Computer name | ★ |
| `UserName` | `string` | Current user name | ★ |
| `OSVersion` | `OperatingSystem` | OS version info | ★ |
| `Is64BitOperatingSystem` | `bool` | 64-bit OS check | ★ |
| `Is64BitProcess` | `bool` | 64-bit process check | ★ |
| `ProcessorCount` | `int` | Number of processors | ★ |
| `CurrentDirectory` | `string` | Current working directory | ★ |
| `CommandLine` | `string` | Command line string | ★ |
| `TickCount` | `int` | Milliseconds since boot | ★ |
| `TickCount64` | `long` | Milliseconds since boot (long) | ★ |
| `Version` | `Version` | .NET runtime version | ★ |
| `GetEnvironmentVariable(string)` | `string?` | Gets env variable | ★ |
| `SetEnvironmentVariable(string, string?)` | `void` | Sets env variable | ★ |
| `GetFolderPath(SpecialFolder)` | `string` | Gets special folder path | ★ |
| `GetCommandLineArgs()` | `string[]` | Command line arguments | ★ |
| `FailFast(string)` | `void` | Immediate termination with message | ★ |
| `StackTrace` | `string` | Current stack trace | ★ |

#### 3.1.14 Enum Helpers

| Trigger | Members |
|---------|---------|
| `Enum.` | `IsDefined(Type, object)`, `GetValues(Type)`, `Parse(Type, string)` |

#### 3.1.15 Nullable Operators (Week 13+)

Provide completions/hints for:
- `??` (null-coalescing)
- `?.` (null-conditional)
- `??=` (null-coalescing assignment)
- `.HasValue` and `.Value` on nullable types

---

### 3.2 Syntax Checking (Client-Side Linting)

These are lightweight, regex/AST-based checks run on the CodeMirror parse tree. They produce `Diagnostic` objects rendered as squiggly underlines.

#### 3.2.1 Structural Checks (High Value)

| Check | Severity | Implementation |
|-------|----------|----------------|
| Unmatched `{` `}` | Error | CodeMirror `bracketMatching` + custom linter counting braces |
| Unmatched `(` `)` | Error | Same bracket analysis |
| Unmatched `[` `]` | Error | Same bracket analysis |
| Missing semicolon after statement | Warning | Regex: line ends with identifier/`)` but no `;`, `{`, `}` and next line is not `{` or `.` |
| Unterminated string literal | Error | Regex: odd number of `"` on a line (excluding `@""` and `$""`) |

#### 3.2.2 Common Beginner Mistakes (High Value)

| Check | Pattern | Message |
|-------|---------|---------|
| `=` in condition | `if (x = 5)` | "Did you mean `==`? Use `==` for comparison." |
| `==` in assignment | `x == 5;` as a statement | "Did you mean `=`? Use `=` for assignment." |
| Missing `()` on method call | `Console.ReadLine;` | "Did you mean `Console.ReadLine()`? Methods need parentheses." |
| `Console.Writeline` | Case mismatch | "C# is case-sensitive. Did you mean `Console.WriteLine`?" |
| `Console.Readline` | Case mismatch | "C# is case-sensitive. Did you mean `Console.ReadLine`?" |
| `console.` | Lowercase class | "C# is case-sensitive. Did you mean `Console`?" |
| `String` vs `string` | — | Info hint: "In C#, `string` and `String` are equivalent. `string` is preferred." |
| `Main` not `static` | Missing `static` on `Main` | "The `Main` method must be `static`." |
| `void main` | Lowercase | "C# is case-sensitive. Did you mean `Main`?" |

#### 3.2.3 Type Hint Checks (Medium Value)

| Check | Pattern | Message |
|-------|---------|---------|
| `int.Parse` on non-string | Direct call pattern | "Hint: `int.Parse()` expects a `string` argument." |
| `foreach` without `in` | `foreach (var x collection)` | "Missing `in` keyword in foreach loop." |
| Empty `catch` block | `catch { }` or `catch (Exception) { }` | "Warning: Empty catch block silently swallows errors." |
| `throw ex;` in catch | Re-throw with variable | "Hint: `throw;` preserves the original stack trace. Use `throw;` instead of `throw ex;`." |

---

### 3.3 Bracket & Quote Auto-Closing

Use CodeMirror's built-in `closeBrackets()` extension with these pairs:

```typescript
closeBrackets({
  brackets: ['(', '[', '{', '"', "'"],
  before: ')]}:;>'
})
```

Additionally, auto-insert:
- `{}` with cursor indented on new line after: `class`, `if`, `else`, `for`, `foreach`, `while`, `do`, `switch`, `try`, `catch`, `finally`, method signatures
- Closing `>` after `<` in generic contexts like `List<`, `Dictionary<`

---

### 3.4 Hover Tooltips

When the user hovers over a known identifier, show a tooltip with:

| Hovered Text | Tooltip Content |
|-------------|-----------------|
| `Console.WriteLine` | `void Console.WriteLine(string value)` — Writes text followed by a new line |
| `int.Parse` | `int int.Parse(string s)` — Converts string to integer. Throws FormatException if invalid. |
| `int.TryParse` | `bool int.TryParse(string s, out int result)` — Safely converts string to integer. Returns false if invalid. |
| Any keyword | Brief description: e.g., `foreach` → "Iterates over each element in a collection" |
| Exception type | Brief description of when it's thrown |

Implementation: use `hoverTooltip()` extension, match against the completion dictionary.

---

### 3.5 Challenge-Aware Features (Optional Enhancement)

If the challenge metadata includes `weekNumber` or tags:

| Week Range | What's Active |
|-----------|---------------|
| 1–2 | Keywords, `Console.*`, primitive types, `Convert.*`, `Parse` |
| 3 | + `if/else`, `switch`, ternary, logical operators |
| 4 | + `for`, `while`, `do-while`, `foreach`, `break`, `continue` |
| 5 | + Method snippets (`static void`, return types, parameters, overloading) |
| 6 | + `List<T>`, arrays, `Array.Sort`, `.Length`, `.Count`, `.Add` |
| 7–8 | + `class`, `new`, `this`, properties, constructors, access modifiers |
| 9 | + `base`, `virtual`, `override`, inheritance keywords |
| 10 | + `abstract`, `as`, `is`, type casting |
| 11 | + `interface`, composition patterns |
| 12 | + `try/catch/finally`, `throw`, all Exception types |
| 13 | + `enum`, `Nullable`, `??`, `?.`, `Dictionary<>`, `Stack<>`, `Queue<>` |
| 14 | + All LINQ methods, lambda `=>` syntax |
| 15 | + `async`, `await`, `static` class members, full feature set |

When a student types something from a later week, don't block it — just don't actively suggest it. This keeps the editor helpful without being restrictive.

---

## 4. Data Model — Completion Registry

```typescript
// completion-registry.ts

interface CompletionEntry {
  label: string;           // What appears in dropdown: "WriteLine"
  type: string;            // CodeMirror type: "method", "property", "keyword", "class", "type", "snippet"
  detail?: string;         // Short signature: "void Console.WriteLine(string)"
  info?: string;           // Longer description for documentation panel
  boost?: number;          // Priority boost (higher = appears first)
  section?: string;        // Group header: "Console", "Math", "LINQ"
  minWeek?: number;        // Earliest week this is relevant (for gating)
  triggerContext?: string;  // When to show: "Console.", "Math.", "string.", "List.", "after-throw", "after-catch"
  snippet?: string;        // Snippet template with ${} placeholders
}
```

The registry is a static JSON/TypeScript file (~600-700 entries total). It can be loaded once at app init. Each entry includes a `boost` field (★★★ = 100, ★★ = 50, ★ = 10) to ensure course-critical completions appear first while still exposing the full API below.

---

## 5. Architecture — Angular Integration

```
src/app/
├── editor/
│   ├── editor.component.ts          // Hosts CodeMirror 6 instance
│   ├── extensions/
│   │   ├── csharp-completions.ts     // CompletionSource using registry
│   │   ├── csharp-snippets.ts        // Snippet definitions
│   │   ├── csharp-linter.ts          // Diagnostic checks (section 3.2)
│   │   ├── csharp-hover.ts           // Hover tooltip provider
│   │   └── index.ts                  // Bundles all extensions
│   └── data/
│       └── completion-registry.ts    // The static completion database
```

**Editor component setup:**

```typescript
import { csharpCompletions } from './extensions/csharp-completions';
import { csharpLinter } from './extensions/csharp-linter';
import { csharpHover } from './extensions/csharp-hover';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching } from '@codemirror/language';
import { linter } from '@codemirror/lint';

const extensions = [
  csharp(),                          // Language support (syntax highlighting)
  autocompletion({ override: [csharpCompletions(weekNumber)] }),
  closeBrackets(),
  bracketMatching(),
  linter(csharpLinter),
  csharpHover(),
  keymap.of([...closeBracketsKeymap]),
];
```

---

## 6. Implementation Priority

### Phase 1 — Ship First (1-2 days)

- [ ] Keyword completions (section 3.1.1)
- [ ] `Console.` completions (section 3.1.3)
- [ ] Type name completions (section 3.1.2)
- [ ] `int.Parse`, `Convert.To*` completions (section 3.1.4)
- [ ] Bracket matching and auto-closing (section 3.3)
- [ ] Top 3 snippet templates: `cw`, `for`, `if` (section 3.1.1)

### Phase 2 — Student Quality of Life (1-2 days)

- [ ] All snippet templates (section 3.1.1)
- [ ] String method completions (section 3.1.5)
- [ ] `Math.` completions (section 3.1.6)
- [ ] `List<T>` completions (section 3.1.7)
- [ ] Common beginner mistake linting (section 3.2.2)
- [ ] Missing semicolon / unmatched brace warnings (section 3.2.1)

### Phase 3 — Polish (1-2 days)

- [ ] Hover tooltips (section 3.4)
- [ ] `Dictionary`, `Stack`, `Queue` completions (sections 3.1.8-3.1.9)
- [ ] LINQ completions (section 3.1.11)
- [ ] Exception type completions (section 3.1.12)
- [ ] `Random`, `DateTime` completions (section 3.1.13)
- [ ] Enum and nullable completions (sections 3.1.14-3.1.15)
- [ ] Week-based progressive gating (section 3.5)

---

## 7. What We're Deliberately NOT Building

| Feature | Why Not |
|---------|---------|
| Full semantic type inference | Requires Roslyn; 80% effort for 10% value in console apps |
| Cross-file resolution | Students write single-file console apps |
| LSP server | Massive infrastructure; client-side is sufficient for this scope |
| NuGet package completions | Not used in the course |
| Refactoring (rename, extract) | Out of scope for a challenge platform |
| Signature overload cycling | Nice-to-have but complex; static detail text is enough |
| Error correction suggestions | The compiler output on submit gives this already |
| `System.IO.File` completions | Sandboxed environment; file I/O not available |

---

## 8. Surgical Claude CLI Prompt (For Implementation Phase)

When you're ready to build, use this prompt with Claude CLI pointing at your CodeFest project:

```
Read ONLY these files from my project:
1. The Angular editor component (find it via: find src -name "*editor*" -name "*.ts")  
2. Any existing CodeMirror configuration or extension files
3. The challenge model/interface TypeScript files
4. package.json (to see current @codemirror packages installed)

Then read the spec file: CODEFEST-EDITOR-INTELLISENSE-SPEC.md

Implement Phase 1 from the spec:
- Create src/app/editor/data/completion-registry.ts with the static completion database
- Create src/app/editor/extensions/csharp-completions.ts with a CompletionSource
- Create src/app/editor/extensions/csharp-snippets.ts  
- Wire them into the existing editor component
- Add closeBrackets() and bracketMatching() to the extensions array
- Do NOT install new packages without asking — check what's already in package.json

Show me the files before writing them.
```

This targets ~4 files and package.json instead of scanning the whole repo — minimal token cost.

---

## Appendix A: Complete Namespace Scope

The editor should recognize these `using` statements and their associated types:

| Namespace | What It Unlocks |
|-----------|----------------|
| (implicit / top-level) | `Console`, primitive types, `Math`, `Convert`, `Random`, `DateTime`, `TimeSpan`, `Environment`, `Exception` types, `Array` |
| `System` | Same as above (explicit) |
| `System.Collections.Generic` | `List<T>`, `Dictionary<TKey,TValue>`, `Stack<T>`, `Queue<T>`, `HashSet<T>`, `LinkedList<T>`, `SortedList<TKey,TValue>`, `SortedDictionary<TKey,TValue>`, `SortedSet<T>` |
| `System.Linq` | All LINQ extension methods (full Enumerable API) |
| `System.Threading.Tasks` | `Task`, `Task<T>`, `Task.Run`, `Task.Delay` (Week 15 only) |

**Classes included with full public API:** Console, Math, Random, DateTime, TimeSpan, Environment, Convert, string (instance + static), Array (instance + static), List\<T\>, Dictionary\<TKey,TValue\>, Stack\<T\>, Queue\<T\>, HashSet\<T\>, all LINQ Enumerable methods, all Exception types.

**Classes NOT included** (out of scope for intro programming): HttpClient, File/Directory/Path (sandboxed), Stream/StreamReader/StreamWriter, Regex, Task (beyond basics), Reflection, Serialization, Networking, Span\<T\>/Memory\<T\>.

---

## Appendix B: Course Content Analysis Summary

Data extracted by scanning all 90 markdown files in the repository:

**Top method calls:** Console.WriteLine (1218×), Console.Write (163×), Console.ReadLine (130×), .Parse (78×), .Add (59×), .ToList (45×), .Where (39×), .TryParse (28×), .OrderBy (24×), .Select (22×), .ToString (16×), .ToLower (15×), .Sort (14×), .IsNullOrWhiteSpace (14×), .Average (14×), .Any (14×), .Count (13×), .Contains (11×), .Trim (10×)

**Keyword frequency:** public (972×), class (863×), for (760×), if (606×), new (575×), get (477×), set (439×), return (393×), this (293×), void (288×), static (285×), base (225×), using (211×), override (197×), foreach (171×), abstract (139×), break (134×), private (130×), while (125×), switch (85×), try (92×), catch (113×), throw (85×), interface (93×), virtual (72×), enum (45×), async (23×), await (23×)
