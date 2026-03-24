/**
 * Static completion registry for C# IntelliSense.
 * Boost values: ★★★ = 100, ★★ = 50, ★ = 10
 */

export interface CompletionEntry {
  label: string;
  type: string; // "method" | "property" | "keyword" | "class" | "type" | "snippet" | "enum" | "constant" | "field" | "event"
  detail?: string;
  info?: string;
  boost?: number;
  section?: string;
  minWeek?: number;
  triggerContext?: string; // "Console." | "Math." | "string." | "string-instance" | "List." | "Array." | "Dictionary." | "Stack." | "Queue." | "HashSet." | "Convert." | "int." | "double." | "decimal." | "bool." | "Random." | "DateTime." | "DateTime-instance" | "TimeSpan." | "TimeSpan-instance" | "Environment." | "Enum." | "after-throw" | "after-catch" | "ConsoleColor."
  snippet?: string;
}

// ── 3.1.1 C# Keywords ──────────────────────────────────────────────────

const keywords: CompletionEntry[] = [
  // Control flow
  { label: 'if', type: 'keyword', detail: 'if statement', boost: 90, info: 'Executes a block if a condition is true' },
  { label: 'else', type: 'keyword', detail: 'else clause', boost: 90, info: 'Executes a block if the preceding if condition is false' },
  { label: 'switch', type: 'keyword', detail: 'switch statement', boost: 80, info: 'Selects a block to execute from multiple choices' },
  { label: 'case', type: 'keyword', detail: 'case label', boost: 80, info: 'Defines a branch in a switch statement' },
  { label: 'default', type: 'keyword', detail: 'default label', boost: 70, info: 'Default branch in a switch statement' },
  { label: 'break', type: 'keyword', detail: 'break statement', boost: 80, info: 'Exits the current loop or switch' },
  { label: 'continue', type: 'keyword', detail: 'continue statement', boost: 70, info: 'Skips to the next iteration of the loop' },
  { label: 'return', type: 'keyword', detail: 'return statement', boost: 90, info: 'Returns a value from a method' },
  { label: 'for', type: 'keyword', detail: 'for loop', boost: 90, minWeek: 4, info: 'Repeats a block a specific number of times' },
  { label: 'foreach', type: 'keyword', detail: 'foreach loop', boost: 85, minWeek: 4, info: 'Iterates over each element in a collection' },
  { label: 'while', type: 'keyword', detail: 'while loop', boost: 85, minWeek: 4, info: 'Repeats a block while a condition is true' },
  { label: 'do', type: 'keyword', detail: 'do-while loop', boost: 70, minWeek: 4, info: 'Executes a block at least once, then repeats while a condition is true' },
  { label: 'in', type: 'keyword', detail: 'in keyword', boost: 50, info: 'Used in foreach to iterate over a collection' },

  // Declarations
  { label: 'class', type: 'keyword', detail: 'class declaration', boost: 80, minWeek: 7, info: 'Defines a new class type' },
  { label: 'interface', type: 'keyword', detail: 'interface declaration', boost: 60, minWeek: 11, info: 'Defines a contract that classes can implement' },
  { label: 'abstract', type: 'keyword', detail: 'abstract modifier', boost: 50, minWeek: 10, info: 'Indicates a class or member must be implemented by derived classes' },
  { label: 'virtual', type: 'keyword', detail: 'virtual modifier', boost: 50, minWeek: 9, info: 'Allows a method to be overridden in derived classes' },
  { label: 'override', type: 'keyword', detail: 'override modifier', boost: 50, minWeek: 9, info: 'Overrides a virtual member from a base class' },
  { label: 'static', type: 'keyword', detail: 'static modifier', boost: 70, info: 'Declares a member that belongs to the type itself' },
  { label: 'void', type: 'keyword', detail: 'void return type', boost: 80, info: 'Specifies that a method does not return a value' },
  { label: 'public', type: 'keyword', detail: 'public access', boost: 80, info: 'Member is accessible from anywhere' },
  { label: 'private', type: 'keyword', detail: 'private access', boost: 70, info: 'Member is accessible only within the containing class' },
  { label: 'protected', type: 'keyword', detail: 'protected access', boost: 50, info: 'Member is accessible within the class and derived classes' },
  { label: 'internal', type: 'keyword', detail: 'internal access', boost: 30, info: 'Member is accessible within the same assembly' },
  { label: 'namespace', type: 'keyword', detail: 'namespace declaration', boost: 40, info: 'Organizes code into logical groups' },
  { label: 'using', type: 'keyword', detail: 'using directive', boost: 60, info: 'Imports a namespace or defines a scope for IDisposable' },
  { label: 'new', type: 'keyword', detail: 'new operator', boost: 90, info: 'Creates a new instance of a type' },
  { label: 'this', type: 'keyword', detail: 'this reference', boost: 60, minWeek: 7, info: 'Refers to the current instance of the class' },
  { label: 'base', type: 'keyword', detail: 'base reference', boost: 50, minWeek: 9, info: 'Refers to the base class of the current class' },
  { label: 'var', type: 'keyword', detail: 'implicitly typed variable', boost: 80, info: 'Declares a variable with inferred type' },
  { label: 'const', type: 'keyword', detail: 'constant declaration', boost: 60, info: 'Declares a compile-time constant' },
  { label: 'readonly', type: 'keyword', detail: 'readonly modifier', boost: 40, info: 'Field can only be assigned in declaration or constructor' },
  { label: 'enum', type: 'keyword', detail: 'enum declaration', boost: 50, minWeek: 13, info: 'Defines a set of named constants' },
  { label: 'struct', type: 'keyword', detail: 'struct declaration', boost: 30, info: 'Defines a value type' },
  { label: 'get', type: 'keyword', detail: 'property getter', boost: 50, info: 'Defines the get accessor of a property' },
  { label: 'set', type: 'keyword', detail: 'property setter', boost: 50, info: 'Defines the set accessor of a property' },

  // Type checking
  { label: 'is', type: 'keyword', detail: 'type check', boost: 50, minWeek: 10, info: 'Checks if an object is of a given type' },
  { label: 'as', type: 'keyword', detail: 'type cast', boost: 50, minWeek: 10, info: 'Casts an object to a type, returns null if invalid' },
  { label: 'typeof', type: 'keyword', detail: 'typeof operator', boost: 40, info: 'Gets the System.Type of a type' },

  // Error handling
  { label: 'try', type: 'keyword', detail: 'try block', boost: 70, minWeek: 12, info: 'Defines a block to attempt that might throw exceptions' },
  { label: 'catch', type: 'keyword', detail: 'catch block', boost: 70, minWeek: 12, info: 'Handles exceptions thrown in the try block' },
  { label: 'finally', type: 'keyword', detail: 'finally block', boost: 50, minWeek: 12, info: 'Code that always executes after try/catch' },
  { label: 'throw', type: 'keyword', detail: 'throw statement', boost: 60, minWeek: 12, info: 'Throws an exception' },

  // Literals & operators
  { label: 'null', type: 'keyword', detail: 'null literal', boost: 70, info: 'Represents a null reference' },
  { label: 'true', type: 'keyword', detail: 'boolean literal', boost: 70, info: 'Boolean true value' },
  { label: 'false', type: 'keyword', detail: 'boolean literal', boost: 70, info: 'Boolean false value' },

  // Async
  { label: 'async', type: 'keyword', detail: 'async modifier', boost: 30, minWeek: 15, info: 'Marks a method as asynchronous' },
  { label: 'await', type: 'keyword', detail: 'await operator', boost: 30, minWeek: 15, info: 'Waits for an asynchronous operation to complete' },
];

// ── 3.1.2 Primitive Types ───────────────────────────────────────────────

const primitiveTypes: CompletionEntry[] = [
  { label: 'int', type: 'type', detail: 'System.Int32', boost: 100, info: '32-bit signed integer' },
  { label: 'string', type: 'type', detail: 'System.String', boost: 100, info: 'Sequence of Unicode characters' },
  { label: 'double', type: 'type', detail: 'System.Double', boost: 90, info: '64-bit floating-point number' },
  { label: 'bool', type: 'type', detail: 'System.Boolean', boost: 80, info: 'True or false value' },
  { label: 'decimal', type: 'type', detail: 'System.Decimal', boost: 80, info: '128-bit precise decimal number' },
  { label: 'char', type: 'type', detail: 'System.Char', boost: 50, info: 'Single Unicode character' },
  { label: 'long', type: 'type', detail: 'System.Int64', boost: 50, info: '64-bit signed integer' },
  { label: 'float', type: 'type', detail: 'System.Single', boost: 30, info: '32-bit floating-point number' },
  { label: 'short', type: 'type', detail: 'System.Int16', boost: 20, info: '16-bit signed integer' },
  { label: 'byte', type: 'type', detail: 'System.Byte', boost: 10, info: '8-bit unsigned integer' },
  { label: 'object', type: 'type', detail: 'System.Object', boost: 10, info: 'Base type for all C# types' },
];

// ── 3.1.3 Console Class ────────────────────────────────────────────────

const consoleMethods: CompletionEntry[] = [
  // Methods
  { label: 'WriteLine', type: 'method', detail: 'void Console.WriteLine(string value)', info: 'Writes text followed by a new line', boost: 100, section: 'Console', triggerContext: 'Console.' },
  { label: 'Write', type: 'method', detail: 'void Console.Write(string value)', info: 'Writes text without a new line', boost: 100, section: 'Console', triggerContext: 'Console.' },
  { label: 'ReadLine', type: 'method', detail: 'string? Console.ReadLine()', info: 'Reads a line of input from the user', boost: 100, section: 'Console', triggerContext: 'Console.' },
  { label: 'ReadKey', type: 'method', detail: 'ConsoleKeyInfo Console.ReadKey()', info: 'Reads next key press', boost: 50, section: 'Console', triggerContext: 'Console.' },
  { label: 'ReadKey', type: 'method', detail: 'ConsoleKeyInfo Console.ReadKey(bool intercept)', info: 'Reads next key press (optionally hidden)', boost: 50, section: 'Console', triggerContext: 'Console.' },
  { label: 'Read', type: 'method', detail: 'int Console.Read()', info: 'Reads next character as int', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'Clear', type: 'method', detail: 'void Console.Clear()', info: 'Clears the console screen', boost: 50, section: 'Console', triggerContext: 'Console.' },
  { label: 'Beep', type: 'method', detail: 'void Console.Beep()', info: 'Plays a beep sound', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'ResetColor', type: 'method', detail: 'void Console.ResetColor()', info: 'Resets foreground and background colors to defaults', boost: 50, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetCursorPosition', type: 'method', detail: 'void Console.SetCursorPosition(int left, int top)', info: 'Sets cursor position in the buffer', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetIn', type: 'method', detail: 'void Console.SetIn(TextReader newIn)', info: 'Redirects standard input', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetOut', type: 'method', detail: 'void Console.SetOut(TextWriter newOut)', info: 'Redirects standard output', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetError', type: 'method', detail: 'void Console.SetError(TextWriter newError)', info: 'Redirects standard error', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'OpenStandardInput', type: 'method', detail: 'Stream Console.OpenStandardInput()', info: 'Acquires standard input stream', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'OpenStandardOutput', type: 'method', detail: 'Stream Console.OpenStandardOutput()', info: 'Acquires standard output stream', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'OpenStandardError', type: 'method', detail: 'Stream Console.OpenStandardError()', info: 'Acquires standard error stream', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetBufferSize', type: 'method', detail: 'void Console.SetBufferSize(int width, int height)', info: 'Sets buffer dimensions', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetWindowSize', type: 'method', detail: 'void Console.SetWindowSize(int width, int height)', info: 'Sets window dimensions', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'SetWindowPosition', type: 'method', detail: 'void Console.SetWindowPosition(int left, int top)', info: 'Sets window position', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'MoveBufferArea', type: 'method', detail: 'void Console.MoveBufferArea(int srcL, int srcT, int srcW, int srcH, int tgtL, int tgtT)', info: 'Copies buffer area', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'GetCursorPosition', type: 'method', detail: '(int Left, int Top) Console.GetCursorPosition()', info: 'Gets current cursor position', boost: 10, section: 'Console', triggerContext: 'Console.' },

  // Properties
  { label: 'ForegroundColor', type: 'property', detail: 'ConsoleColor Console.ForegroundColor', info: 'Gets/sets text color', boost: 50, section: 'Console', triggerContext: 'Console.' },
  { label: 'BackgroundColor', type: 'property', detail: 'ConsoleColor Console.BackgroundColor', info: 'Gets/sets background color', boost: 50, section: 'Console', triggerContext: 'Console.' },
  { label: 'Title', type: 'property', detail: 'string Console.Title', info: 'Gets/sets console window title', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'CursorLeft', type: 'property', detail: 'int Console.CursorLeft', info: 'Gets/sets cursor column position', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'CursorTop', type: 'property', detail: 'int Console.CursorTop', info: 'Gets/sets cursor row position', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'CursorVisible', type: 'property', detail: 'bool Console.CursorVisible', info: 'Gets/sets cursor visibility', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'CursorSize', type: 'property', detail: 'int Console.CursorSize', info: 'Gets/sets cursor height in cell', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'WindowWidth', type: 'property', detail: 'int Console.WindowWidth', info: 'Gets/sets console window width', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'WindowHeight', type: 'property', detail: 'int Console.WindowHeight', info: 'Gets/sets console window height', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'WindowLeft', type: 'property', detail: 'int Console.WindowLeft', info: 'Gets/sets window left position', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'WindowTop', type: 'property', detail: 'int Console.WindowTop', info: 'Gets/sets window top position', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'BufferWidth', type: 'property', detail: 'int Console.BufferWidth', info: 'Gets/sets buffer width', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'BufferHeight', type: 'property', detail: 'int Console.BufferHeight', info: 'Gets/sets buffer height', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'LargestWindowWidth', type: 'property', detail: 'int Console.LargestWindowWidth', info: 'Max possible window width', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'LargestWindowHeight', type: 'property', detail: 'int Console.LargestWindowHeight', info: 'Max possible window height', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'KeyAvailable', type: 'property', detail: 'bool Console.KeyAvailable', info: 'True if a key press is waiting', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'CapsLock', type: 'property', detail: 'bool Console.CapsLock', info: 'True if Caps Lock is on', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'NumberLock', type: 'property', detail: 'bool Console.NumberLock', info: 'True if Num Lock is on', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'IsInputRedirected', type: 'property', detail: 'bool Console.IsInputRedirected', info: 'True if stdin is redirected', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'IsOutputRedirected', type: 'property', detail: 'bool Console.IsOutputRedirected', info: 'True if stdout is redirected', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'IsErrorRedirected', type: 'property', detail: 'bool Console.IsErrorRedirected', info: 'True if stderr is redirected', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'In', type: 'property', detail: 'TextReader Console.In', info: 'Standard input stream', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'Out', type: 'property', detail: 'TextWriter Console.Out', info: 'Standard output stream', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'Error', type: 'property', detail: 'TextWriter Console.Error', info: 'Standard error stream', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'InputEncoding', type: 'property', detail: 'Encoding Console.InputEncoding', info: 'Gets/sets input encoding', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'OutputEncoding', type: 'property', detail: 'Encoding Console.OutputEncoding', info: 'Gets/sets output encoding', boost: 10, section: 'Console', triggerContext: 'Console.' },
  { label: 'TreatControlCAsInput', type: 'property', detail: 'bool Console.TreatControlCAsInput', info: 'Gets/sets Ctrl+C handling', boost: 10, section: 'Console', triggerContext: 'Console.' },

  // Events
  { label: 'CancelKeyPress', type: 'event', detail: 'event Console.CancelKeyPress', info: 'Occurs when Ctrl+C or Ctrl+Break is pressed', boost: 10, section: 'Console', triggerContext: 'Console.' },
];

// ── ConsoleColor enum ───────────────────────────────────────────────────

const consoleColorMembers: CompletionEntry[] = [
  'Black', 'DarkBlue', 'DarkGreen', 'DarkCyan', 'DarkRed', 'DarkMagenta',
  'DarkYellow', 'Gray', 'DarkGray', 'Blue', 'Green', 'Cyan', 'Red', 'Magenta',
  'Yellow', 'White',
].map(c => ({
  label: c, type: 'enum' as const, detail: `ConsoleColor.${c}`, boost: 50,
  section: 'ConsoleColor', triggerContext: 'ConsoleColor.' as const,
}));

// ── 3.1.4 Type Conversion ──────────────────────────────────────────────

const intParseMethods: CompletionEntry[] = [
  { label: 'Parse', type: 'method', detail: 'int int.Parse(string s)', info: 'Converts string to integer. Throws FormatException if invalid.', boost: 100, section: 'int', triggerContext: 'int.' },
  { label: 'TryParse', type: 'method', detail: 'bool int.TryParse(string s, out int result)', info: 'Safely converts string to integer. Returns false if invalid.', boost: 100, section: 'int', triggerContext: 'int.' },
  { label: 'MaxValue', type: 'constant', detail: 'const int int.MaxValue', info: '2,147,483,647', boost: 50, section: 'int', triggerContext: 'int.' },
  { label: 'MinValue', type: 'constant', detail: 'const int int.MinValue', info: '-2,147,483,648', boost: 50, section: 'int', triggerContext: 'int.' },
];

const doubleParseMethods: CompletionEntry[] = [
  { label: 'Parse', type: 'method', detail: 'double double.Parse(string s)', info: 'Converts string to double', boost: 100, section: 'double', triggerContext: 'double.' },
  { label: 'TryParse', type: 'method', detail: 'bool double.TryParse(string s, out double result)', info: 'Safely converts string to double', boost: 100, section: 'double', triggerContext: 'double.' },
  { label: 'MaxValue', type: 'constant', detail: 'const double double.MaxValue', boost: 10, section: 'double', triggerContext: 'double.' },
  { label: 'MinValue', type: 'constant', detail: 'const double double.MinValue', boost: 10, section: 'double', triggerContext: 'double.' },
  { label: 'NaN', type: 'constant', detail: 'const double double.NaN', info: 'Not a Number', boost: 10, section: 'double', triggerContext: 'double.' },
  { label: 'PositiveInfinity', type: 'constant', detail: 'const double double.PositiveInfinity', boost: 10, section: 'double', triggerContext: 'double.' },
  { label: 'NegativeInfinity', type: 'constant', detail: 'const double double.NegativeInfinity', boost: 10, section: 'double', triggerContext: 'double.' },
];

const decimalParseMethods: CompletionEntry[] = [
  { label: 'Parse', type: 'method', detail: 'decimal decimal.Parse(string s)', info: 'Converts string to decimal', boost: 100, section: 'decimal', triggerContext: 'decimal.' },
  { label: 'TryParse', type: 'method', detail: 'bool decimal.TryParse(string s, out decimal result)', info: 'Safely converts string to decimal', boost: 100, section: 'decimal', triggerContext: 'decimal.' },
  { label: 'MaxValue', type: 'constant', detail: 'const decimal decimal.MaxValue', boost: 10, section: 'decimal', triggerContext: 'decimal.' },
  { label: 'MinValue', type: 'constant', detail: 'const decimal decimal.MinValue', boost: 10, section: 'decimal', triggerContext: 'decimal.' },
];

const boolParseMethods: CompletionEntry[] = [
  { label: 'Parse', type: 'method', detail: 'bool bool.Parse(string s)', info: 'Converts string to bool', boost: 100, section: 'bool', triggerContext: 'bool.' },
  { label: 'TrueString', type: 'constant', detail: 'const string bool.TrueString', info: '"True"', boost: 10, section: 'bool', triggerContext: 'bool.' },
  { label: 'FalseString', type: 'constant', detail: 'const string bool.FalseString', info: '"False"', boost: 10, section: 'bool', triggerContext: 'bool.' },
];

const convertMethods: CompletionEntry[] = [
  { label: 'ToInt32', type: 'method', detail: 'int Convert.ToInt32(object value)', info: 'Converts value to 32-bit integer', boost: 100, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToDouble', type: 'method', detail: 'double Convert.ToDouble(object value)', info: 'Converts value to double', boost: 100, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToBoolean', type: 'method', detail: 'bool Convert.ToBoolean(object value)', info: 'Converts value to boolean', boost: 50, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToString', type: 'method', detail: 'string Convert.ToString(object value)', info: 'Converts value to string', boost: 50, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToDecimal', type: 'method', detail: 'decimal Convert.ToDecimal(object value)', info: 'Converts value to decimal', boost: 50, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToInt16', type: 'method', detail: 'short Convert.ToInt16(object value)', info: 'Converts value to 16-bit integer', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToInt64', type: 'method', detail: 'long Convert.ToInt64(object value)', info: 'Converts value to 64-bit integer', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToByte', type: 'method', detail: 'byte Convert.ToByte(object value)', info: 'Converts value to byte', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToSingle', type: 'method', detail: 'float Convert.ToSingle(object value)', info: 'Converts value to float', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToChar', type: 'method', detail: 'char Convert.ToChar(object value)', info: 'Converts value to char', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToDateTime', type: 'method', detail: 'DateTime Convert.ToDateTime(object value)', info: 'Converts value to DateTime', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ToBase64String', type: 'method', detail: 'string Convert.ToBase64String(byte[] inArray)', info: 'Converts byte array to Base64 string', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'FromBase64String', type: 'method', detail: 'byte[] Convert.FromBase64String(string s)', info: 'Converts Base64 string to byte array', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
  { label: 'ChangeType', type: 'method', detail: 'object Convert.ChangeType(object value, Type conversionType)', info: 'Converts to specified type', boost: 10, section: 'Convert', triggerContext: 'Convert.' },
];

// ── 3.1.5 String Members ───────────────────────────────────────────────

const stringInstanceMembers: CompletionEntry[] = [
  { label: 'Length', type: 'property', detail: 'int string.Length', info: 'Number of characters', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'ToLower', type: 'method', detail: 'string string.ToLower()', info: 'Converts to lowercase', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'ToUpper', type: 'method', detail: 'string string.ToUpper()', info: 'Converts to uppercase', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'Trim', type: 'method', detail: 'string string.Trim()', info: 'Removes leading/trailing whitespace', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'Contains', type: 'method', detail: 'bool string.Contains(string value)', info: 'Checks if string contains substring', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'IndexOf', type: 'method', detail: 'int string.IndexOf(string value)', info: 'Position of first occurrence, or -1', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'Substring', type: 'method', detail: 'string string.Substring(int startIndex)', info: 'From position to end', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'StartsWith', type: 'method', detail: 'bool string.StartsWith(string value)', info: 'Checks prefix', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'EndsWith', type: 'method', detail: 'bool string.EndsWith(string value)', info: 'Checks suffix', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'Replace', type: 'method', detail: 'string string.Replace(string oldValue, string newValue)', info: 'Replaces all occurrences', boost: 100, section: 'string', triggerContext: 'string-instance' },
  { label: 'Split', type: 'method', detail: 'string[] string.Split(char separator)', info: 'Splits into array', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'Insert', type: 'method', detail: 'string string.Insert(int index, string value)', info: 'Inserts at position', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'Remove', type: 'method', detail: 'string string.Remove(int startIndex)', info: 'Removes from position to end', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'Equals', type: 'method', detail: 'bool string.Equals(string value)', info: 'Case-sensitive comparison', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'CompareTo', type: 'method', detail: 'int string.CompareTo(string value)', info: 'Alphabetical comparison', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'ToString', type: 'method', detail: 'string string.ToString()', info: 'Returns self', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'ToCharArray', type: 'method', detail: 'char[] string.ToCharArray()', info: 'Converts to char array', boost: 50, section: 'string', triggerContext: 'string-instance' },
  { label: 'TrimStart', type: 'method', detail: 'string string.TrimStart()', info: 'Removes leading whitespace', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'TrimEnd', type: 'method', detail: 'string string.TrimEnd()', info: 'Removes trailing whitespace', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'PadLeft', type: 'method', detail: 'string string.PadLeft(int totalWidth)', info: 'Right-aligns by padding with spaces', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'PadRight', type: 'method', detail: 'string string.PadRight(int totalWidth)', info: 'Left-aligns by padding with spaces', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'LastIndexOf', type: 'method', detail: 'int string.LastIndexOf(string value)', info: 'Position of last occurrence', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'GetHashCode', type: 'method', detail: 'int string.GetHashCode()', info: 'Hash code', boost: 10, section: 'string', triggerContext: 'string-instance' },
  { label: 'GetType', type: 'method', detail: 'Type string.GetType()', info: 'Runtime type', boost: 10, section: 'string', triggerContext: 'string-instance' },
];

const stringStaticMembers: CompletionEntry[] = [
  { label: 'IsNullOrWhiteSpace', type: 'method', detail: 'bool string.IsNullOrWhiteSpace(string value)', info: 'Checks null, empty, or whitespace', boost: 100, section: 'string', triggerContext: 'string.' },
  { label: 'IsNullOrEmpty', type: 'method', detail: 'bool string.IsNullOrEmpty(string value)', info: 'Checks null or empty', boost: 100, section: 'string', triggerContext: 'string.' },
  { label: 'Join', type: 'method', detail: 'string string.Join(string separator, IEnumerable values)', info: 'Joins elements with separator', boost: 50, section: 'string', triggerContext: 'string.' },
  { label: 'Empty', type: 'field', detail: 'string string.Empty', info: 'The empty string ""', boost: 50, section: 'string', triggerContext: 'string.' },
  { label: 'Format', type: 'method', detail: 'string string.Format(string format, params object[] args)', info: 'Composite formatting', boost: 50, section: 'string', triggerContext: 'string.' },
  { label: 'Concat', type: 'method', detail: 'string string.Concat(string str0, string str1)', info: 'Concatenates strings', boost: 10, section: 'string', triggerContext: 'string.' },
  { label: 'Compare', type: 'method', detail: 'int string.Compare(string strA, string strB)', info: 'Compares two strings', boost: 10, section: 'string', triggerContext: 'string.' },
  { label: 'Equals', type: 'method', detail: 'bool string.Equals(string a, string b)', info: 'Static equality check', boost: 10, section: 'string', triggerContext: 'string.' },
  { label: 'Copy', type: 'method', detail: 'string string.Copy(string str)', info: 'Creates a copy (deprecated)', boost: 10, section: 'string', triggerContext: 'string.' },
  { label: 'Intern', type: 'method', detail: 'string string.Intern(string str)', info: 'Retrieves interned reference', boost: 10, section: 'string', triggerContext: 'string.' },
  { label: 'IsInterned', type: 'method', detail: 'string? string.IsInterned(string str)', info: 'Checks if interned', boost: 10, section: 'string', triggerContext: 'string.' },
];

// ── 3.1.6 Math Class ───────────────────────────────────────────────────

const mathMembers: CompletionEntry[] = [
  // Constants
  { label: 'PI', type: 'constant', detail: 'double Math.PI', info: '3.14159265358979...', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'E', type: 'constant', detail: 'double Math.E', info: '2.71828182845904...', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Tau', type: 'constant', detail: 'double Math.Tau', info: '6.28318530717958... (2π)', boost: 10, section: 'Math', triggerContext: 'Math.' },

  // Common
  { label: 'Pow', type: 'method', detail: 'double Math.Pow(double x, double y)', info: 'x raised to power y', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Sqrt', type: 'method', detail: 'double Math.Sqrt(double d)', info: 'Square root', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Max', type: 'method', detail: 'double Math.Max(double val1, double val2)', info: 'Larger of two values', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Min', type: 'method', detail: 'double Math.Min(double val1, double val2)', info: 'Smaller of two values', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Floor', type: 'method', detail: 'double Math.Floor(double d)', info: 'Rounds toward negative infinity', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Ceiling', type: 'method', detail: 'double Math.Ceiling(double d)', info: 'Rounds toward positive infinity', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Abs', type: 'method', detail: 'double Math.Abs(double value)', info: 'Absolute value', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Round', type: 'method', detail: 'double Math.Round(double value)', info: 'Rounds to nearest integer', boost: 100, section: 'Math', triggerContext: 'Math.' },
  { label: 'Truncate', type: 'method', detail: 'double Math.Truncate(double d)', info: 'Removes fractional part', boost: 50, section: 'Math', triggerContext: 'Math.' },

  // Trigonometric
  { label: 'Sin', type: 'method', detail: 'double Math.Sin(double a)', info: 'Sine (radians)', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Cos', type: 'method', detail: 'double Math.Cos(double d)', info: 'Cosine (radians)', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Tan', type: 'method', detail: 'double Math.Tan(double a)', info: 'Tangent (radians)', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Asin', type: 'method', detail: 'double Math.Asin(double d)', info: 'Arcsine → radians', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Acos', type: 'method', detail: 'double Math.Acos(double d)', info: 'Arccosine → radians', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Atan', type: 'method', detail: 'double Math.Atan(double d)', info: 'Arctangent → radians', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Atan2', type: 'method', detail: 'double Math.Atan2(double y, double x)', info: 'Angle from coordinates', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Sinh', type: 'method', detail: 'double Math.Sinh(double value)', info: 'Hyperbolic sine', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Cosh', type: 'method', detail: 'double Math.Cosh(double value)', info: 'Hyperbolic cosine', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Tanh', type: 'method', detail: 'double Math.Tanh(double value)', info: 'Hyperbolic tangent', boost: 10, section: 'Math', triggerContext: 'Math.' },

  // Logarithmic
  { label: 'Log', type: 'method', detail: 'double Math.Log(double d)', info: 'Natural logarithm (base e)', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Log10', type: 'method', detail: 'double Math.Log10(double d)', info: 'Base-10 logarithm', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Log2', type: 'method', detail: 'double Math.Log2(double x)', info: 'Base-2 logarithm', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'Exp', type: 'method', detail: 'double Math.Exp(double d)', info: 'e raised to specified power', boost: 10, section: 'Math', triggerContext: 'Math.' },

  // Sign & clamping
  { label: 'Sign', type: 'method', detail: 'int Math.Sign(double value)', info: 'Returns -1, 0, or 1', boost: 50, section: 'Math', triggerContext: 'Math.' },
  { label: 'Clamp', type: 'method', detail: 'double Math.Clamp(double value, double min, double max)', info: 'Clamps to range', boost: 50, section: 'Math', triggerContext: 'Math.' },

  // Other
  { label: 'DivRem', type: 'method', detail: 'int Math.DivRem(int a, int b, out int remainder)', info: 'Division with remainder', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'BigMul', type: 'method', detail: 'long Math.BigMul(int a, int b)', info: 'Full 64-bit product of two ints', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'IEEERemainder', type: 'method', detail: 'double Math.IEEERemainder(double x, double y)', info: 'IEEE 754 remainder', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'ScaleB', type: 'method', detail: 'double Math.ScaleB(double x, int n)', info: 'x × 2^n', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'CopySign', type: 'method', detail: 'double Math.CopySign(double magnitude, double sign)', info: 'Copies sign to magnitude', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'FusedMultiplyAdd', type: 'method', detail: 'double Math.FusedMultiplyAdd(double x, double y, double z)', info: '(x × y) + z in one operation', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'MaxMagnitude', type: 'method', detail: 'double Math.MaxMagnitude(double x, double y)', info: 'Larger absolute value', boost: 10, section: 'Math', triggerContext: 'Math.' },
  { label: 'MinMagnitude', type: 'method', detail: 'double Math.MinMagnitude(double x, double y)', info: 'Smaller absolute value', boost: 10, section: 'Math', triggerContext: 'Math.' },
];

// ── 3.1.7 List<T> ──────────────────────────────────────────────────────

const listMembers: CompletionEntry[] = [
  { label: 'Add', type: 'method', detail: 'void List<T>.Add(T item)', info: 'Adds item to end', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Count', type: 'property', detail: 'int List<T>.Count', info: 'Number of elements', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Remove', type: 'method', detail: 'bool List<T>.Remove(T item)', info: 'Removes first occurrence', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'RemoveAt', type: 'method', detail: 'void List<T>.RemoveAt(int index)', info: 'Removes at index', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Clear', type: 'method', detail: 'void List<T>.Clear()', info: 'Removes all items', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Contains', type: 'method', detail: 'bool List<T>.Contains(T item)', info: 'Checks if item exists', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'IndexOf', type: 'method', detail: 'int List<T>.IndexOf(T item)', info: 'Returns index or -1', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Sort', type: 'method', detail: 'void List<T>.Sort()', info: 'Sorts in place (default comparer)', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Reverse', type: 'method', detail: 'void List<T>.Reverse()', info: 'Reverses in place', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'ToArray', type: 'method', detail: 'T[] List<T>.ToArray()', info: 'Converts to array', boost: 100, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Exists', type: 'method', detail: 'bool List<T>.Exists(Predicate<T> match)', info: 'True if any element matches', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Find', type: 'method', detail: 'T List<T>.Find(Predicate<T> match)', info: 'First element matching predicate', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Insert', type: 'method', detail: 'void List<T>.Insert(int index, T item)', info: 'Inserts at position', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'AddRange', type: 'method', detail: 'void List<T>.AddRange(IEnumerable<T> collection)', info: 'Adds multiple items', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'RemoveAll', type: 'method', detail: 'int List<T>.RemoveAll(Predicate<T> match)', info: 'Removes all matching, returns count', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'FindAll', type: 'method', detail: 'List<T> List<T>.FindAll(Predicate<T> match)', info: 'All elements matching predicate', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'FindIndex', type: 'method', detail: 'int List<T>.FindIndex(Predicate<T> match)', info: 'Index of first match', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'FindLast', type: 'method', detail: 'T List<T>.FindLast(Predicate<T> match)', info: 'Last element matching predicate', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'FindLastIndex', type: 'method', detail: 'int List<T>.FindLastIndex(Predicate<T> match)', info: 'Index of last match', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'GetRange', type: 'method', detail: 'List<T> List<T>.GetRange(int index, int count)', info: 'Returns sub-list', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'LastIndexOf', type: 'method', detail: 'int List<T>.LastIndexOf(T item)', info: 'Index of last occurrence', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'ForEach', type: 'method', detail: 'void List<T>.ForEach(Action<T> action)', info: 'Executes action on each element', boost: 50, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'ConvertAll', type: 'method', detail: 'List<TOutput> List<T>.ConvertAll<TOutput>(Converter<T, TOutput>)', info: 'Converts all elements', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'TrueForAll', type: 'method', detail: 'bool List<T>.TrueForAll(Predicate<T> match)', info: 'True if all elements match', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'Capacity', type: 'property', detail: 'int List<T>.Capacity', info: 'Gets/sets internal array size', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'TrimExcess', type: 'method', detail: 'void List<T>.TrimExcess()', info: 'Reduces capacity to count', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'CopyTo', type: 'method', detail: 'void List<T>.CopyTo(T[] array)', info: 'Copies to array', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'AsReadOnly', type: 'method', detail: 'ReadOnlyCollection<T> List<T>.AsReadOnly()', info: 'Returns read-only wrapper', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'BinarySearch', type: 'method', detail: 'int List<T>.BinarySearch(T item)', info: 'Searches sorted list', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'RemoveRange', type: 'method', detail: 'void List<T>.RemoveRange(int index, int count)', info: 'Removes range of elements', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
  { label: 'InsertRange', type: 'method', detail: 'void List<T>.InsertRange(int index, IEnumerable<T> collection)', info: 'Inserts multiple at position', boost: 10, section: 'List<T>', triggerContext: 'List.', minWeek: 6 },
];

// ── 3.1.8 Dictionary<TKey, TValue> ─────────────────────────────────────

const dictionaryMembers: CompletionEntry[] = [
  { label: 'Add', type: 'method', detail: 'void Dictionary.Add(TKey key, TValue value)', info: 'Adds key-value pair (throws if exists)', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'Remove', type: 'method', detail: 'bool Dictionary.Remove(TKey key)', info: 'Removes by key', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'ContainsKey', type: 'method', detail: 'bool Dictionary.ContainsKey(TKey key)', info: 'Checks if key exists', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'ContainsValue', type: 'method', detail: 'bool Dictionary.ContainsValue(TValue value)', info: 'Checks if value exists', boost: 50, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'TryGetValue', type: 'method', detail: 'bool Dictionary.TryGetValue(TKey key, out TValue value)', info: 'Safe lookup', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'TryAdd', type: 'method', detail: 'bool Dictionary.TryAdd(TKey key, TValue value)', info: 'Adds if key doesn\'t exist', boost: 50, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'Count', type: 'property', detail: 'int Dictionary.Count', info: 'Number of pairs', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'Keys', type: 'property', detail: 'KeyCollection Dictionary.Keys', info: 'All keys', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'Values', type: 'property', detail: 'ValueCollection Dictionary.Values', info: 'All values', boost: 100, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'Clear', type: 'method', detail: 'void Dictionary.Clear()', info: 'Removes all pairs', boost: 50, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'GetValueOrDefault', type: 'method', detail: 'TValue Dictionary.GetValueOrDefault(TKey key)', info: 'Returns value or default', boost: 50, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'EnsureCapacity', type: 'method', detail: 'int Dictionary.EnsureCapacity(int capacity)', info: 'Pre-allocates space', boost: 10, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
  { label: 'TrimExcess', type: 'method', detail: 'void Dictionary.TrimExcess()', info: 'Reduces internal capacity', boost: 10, section: 'Dictionary', triggerContext: 'Dictionary.', minWeek: 13 },
];

// ── 3.1.9 Stack<T> and Queue<T> ────────────────────────────────────────

const stackMembers: CompletionEntry[] = [
  { label: 'Push', type: 'method', detail: 'void Stack<T>.Push(T item)', info: 'Pushes onto top', boost: 100, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'Pop', type: 'method', detail: 'T Stack<T>.Pop()', info: 'Removes and returns top (throws if empty)', boost: 100, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'Peek', type: 'method', detail: 'T Stack<T>.Peek()', info: 'Returns top without removing', boost: 100, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'Count', type: 'property', detail: 'int Stack<T>.Count', info: 'Number of elements', boost: 100, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'Clear', type: 'method', detail: 'void Stack<T>.Clear()', info: 'Removes all elements', boost: 50, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'Contains', type: 'method', detail: 'bool Stack<T>.Contains(T item)', info: 'Checks if item exists', boost: 50, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'TryPop', type: 'method', detail: 'bool Stack<T>.TryPop(out T result)', info: 'Safe pop', boost: 50, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'TryPeek', type: 'method', detail: 'bool Stack<T>.TryPeek(out T result)', info: 'Safe peek', boost: 50, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'ToArray', type: 'method', detail: 'T[] Stack<T>.ToArray()', info: 'Copies to array (top first)', boost: 10, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
  { label: 'TrimExcess', type: 'method', detail: 'void Stack<T>.TrimExcess()', info: 'Reduces capacity', boost: 10, section: 'Stack<T>', triggerContext: 'Stack.', minWeek: 13 },
];

const queueMembers: CompletionEntry[] = [
  { label: 'Enqueue', type: 'method', detail: 'void Queue<T>.Enqueue(T item)', info: 'Adds to end', boost: 100, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'Dequeue', type: 'method', detail: 'T Queue<T>.Dequeue()', info: 'Removes and returns front (throws if empty)', boost: 100, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'Peek', type: 'method', detail: 'T Queue<T>.Peek()', info: 'Returns front without removing', boost: 100, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'Count', type: 'property', detail: 'int Queue<T>.Count', info: 'Number of elements', boost: 100, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'Clear', type: 'method', detail: 'void Queue<T>.Clear()', info: 'Removes all elements', boost: 50, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'Contains', type: 'method', detail: 'bool Queue<T>.Contains(T item)', info: 'Checks if item exists', boost: 50, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'TryDequeue', type: 'method', detail: 'bool Queue<T>.TryDequeue(out T result)', info: 'Safe dequeue', boost: 50, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'TryPeek', type: 'method', detail: 'bool Queue<T>.TryPeek(out T result)', info: 'Safe peek', boost: 50, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'ToArray', type: 'method', detail: 'T[] Queue<T>.ToArray()', info: 'Copies to array (front first)', boost: 10, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
  { label: 'TrimExcess', type: 'method', detail: 'void Queue<T>.TrimExcess()', info: 'Reduces capacity', boost: 10, section: 'Queue<T>', triggerContext: 'Queue.', minWeek: 13 },
];

const hashSetMembers: CompletionEntry[] = [
  { label: 'Add', type: 'method', detail: 'bool HashSet<T>.Add(T item)', info: 'Adds item (returns false if exists)', boost: 50, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'Remove', type: 'method', detail: 'bool HashSet<T>.Remove(T item)', info: 'Removes item', boost: 50, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'Contains', type: 'method', detail: 'bool HashSet<T>.Contains(T item)', info: 'O(1) lookup', boost: 50, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'Count', type: 'property', detail: 'int HashSet<T>.Count', info: 'Number of elements', boost: 50, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'Clear', type: 'method', detail: 'void HashSet<T>.Clear()', info: 'Removes all', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'UnionWith', type: 'method', detail: 'void HashSet<T>.UnionWith(IEnumerable<T> other)', info: 'Adds all from other', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'IntersectWith', type: 'method', detail: 'void HashSet<T>.IntersectWith(IEnumerable<T> other)', info: 'Keeps only common', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'ExceptWith', type: 'method', detail: 'void HashSet<T>.ExceptWith(IEnumerable<T> other)', info: 'Removes all in other', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'IsSubsetOf', type: 'method', detail: 'bool HashSet<T>.IsSubsetOf(IEnumerable<T> other)', info: 'Subset check', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'IsSupersetOf', type: 'method', detail: 'bool HashSet<T>.IsSupersetOf(IEnumerable<T> other)', info: 'Superset check', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'Overlaps', type: 'method', detail: 'bool HashSet<T>.Overlaps(IEnumerable<T> other)', info: 'Any common elements', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'SetEquals', type: 'method', detail: 'bool HashSet<T>.SetEquals(IEnumerable<T> other)', info: 'Same elements', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
  { label: 'ToArray', type: 'method', detail: 'T[] HashSet<T>.ToArray()', info: 'Converts to array', boost: 10, section: 'HashSet<T>', triggerContext: 'HashSet.', minWeek: 13 },
];

// ── 3.1.10 Array Members ───────────────────────────────────────────────

const arrayInstanceMembers: CompletionEntry[] = [
  { label: 'Length', type: 'property', detail: 'int Array.Length', info: 'Total number of elements', boost: 100, section: 'Array', triggerContext: 'Array-instance', minWeek: 6 },
  { label: 'GetLength', type: 'method', detail: 'int Array.GetLength(int dimension)', info: 'Length of specific dimension', boost: 50, section: 'Array', triggerContext: 'Array-instance', minWeek: 6 },
  { label: 'Rank', type: 'property', detail: 'int Array.Rank', info: 'Number of dimensions', boost: 10, section: 'Array', triggerContext: 'Array-instance', minWeek: 6 },
  { label: 'Clone', type: 'method', detail: 'object Array.Clone()', info: 'Shallow copy', boost: 10, section: 'Array', triggerContext: 'Array-instance', minWeek: 6 },
  { label: 'CopyTo', type: 'method', detail: 'void Array.CopyTo(Array dest, int index)', info: 'Copies to array', boost: 10, section: 'Array', triggerContext: 'Array-instance', minWeek: 6 },
];

const arrayStaticMembers: CompletionEntry[] = [
  { label: 'Sort', type: 'method', detail: 'void Array.Sort(Array array)', info: 'Sorts array in place', boost: 100, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Reverse', type: 'method', detail: 'void Array.Reverse(Array array)', info: 'Reverses array', boost: 100, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Copy', type: 'method', detail: 'void Array.Copy(Array src, Array dest, int length)', info: 'Copies elements', boost: 50, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'IndexOf', type: 'method', detail: 'int Array.IndexOf(Array array, object value)', info: 'Finds first index', boost: 50, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'LastIndexOf', type: 'method', detail: 'int Array.LastIndexOf(Array array, object value)', info: 'Finds last index', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Find', type: 'method', detail: 'T Array.Find<T>(T[] array, Predicate<T> match)', info: 'Finds first match', boost: 50, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'FindAll', type: 'method', detail: 'T[] Array.FindAll<T>(T[] array, Predicate<T> match)', info: 'Finds all matches', boost: 50, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'FindIndex', type: 'method', detail: 'int Array.FindIndex<T>(T[] array, Predicate<T> match)', info: 'Index of first match', boost: 50, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Exists', type: 'method', detail: 'bool Array.Exists<T>(T[] array, Predicate<T> match)', info: 'Any match exists', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'TrueForAll', type: 'method', detail: 'bool Array.TrueForAll<T>(T[] array, Predicate<T> match)', info: 'All match', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'ForEach', type: 'method', detail: 'void Array.ForEach<T>(T[] array, Action<T> action)', info: 'Executes on each', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Resize', type: 'method', detail: 'void Array.Resize<T>(ref T[] array, int newSize)', info: 'Resizes array', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Clear', type: 'method', detail: 'void Array.Clear(Array array, int index, int length)', info: 'Zeros out range', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Fill', type: 'method', detail: 'void Array.Fill<T>(T[] array, T value)', info: 'Fills with value', boost: 50, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'BinarySearch', type: 'method', detail: 'int Array.BinarySearch(Array array, object value)', info: 'Searches sorted array', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'Empty', type: 'method', detail: 'T[] Array.Empty<T>()', info: 'Returns empty array', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
  { label: 'ConvertAll', type: 'method', detail: 'TOut[] Array.ConvertAll<TIn, TOut>(TIn[] array, Converter<TIn, TOut> converter)', info: 'Converts all', boost: 10, section: 'Array', triggerContext: 'Array.', minWeek: 6 },
];

// ── 3.1.11 LINQ Extension Methods ──────────────────────────────────────

const linqMembers: CompletionEntry[] = [
  // Filtering & projection
  { label: 'Where', type: 'method', detail: 'IEnumerable<T> Where(Func<T, bool> predicate)', info: 'Filters elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Select', type: 'method', detail: 'IEnumerable<TResult> Select(Func<T, TResult> selector)', info: 'Transforms elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'SelectMany', type: 'method', detail: 'IEnumerable<TResult> SelectMany(Func<T, IEnumerable<TResult>>)', info: 'Flattens nested collections', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'OfType', type: 'method', detail: 'IEnumerable<TResult> OfType<TResult>()', info: 'Filters by type', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Cast', type: 'method', detail: 'IEnumerable<TResult> Cast<TResult>()', info: 'Casts all elements', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },

  // Ordering
  { label: 'OrderBy', type: 'method', detail: 'IOrderedEnumerable<T> OrderBy(Func<T, TKey> keySelector)', info: 'Sorts ascending', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'OrderByDescending', type: 'method', detail: 'IOrderedEnumerable<T> OrderByDescending(Func<T, TKey> keySelector)', info: 'Sorts descending', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'ThenBy', type: 'method', detail: 'IOrderedEnumerable<T> ThenBy(Func<T, TKey> keySelector)', info: 'Secondary ascending sort', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'ThenByDescending', type: 'method', detail: 'IOrderedEnumerable<T> ThenByDescending(Func<T, TKey> keySelector)', info: 'Secondary descending sort', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Reverse', type: 'method', detail: 'IEnumerable<T> Reverse()', info: 'Reverses order', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },

  // Grouping & joining
  { label: 'GroupBy', type: 'method', detail: 'IEnumerable<IGrouping<TKey, T>> GroupBy(Func<T, TKey>)', info: 'Groups elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Join', type: 'method', detail: 'IEnumerable<TResult> Join(...)', info: 'Inner join', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'GroupJoin', type: 'method', detail: 'IEnumerable<TResult> GroupJoin(...)', info: 'Group join', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Zip', type: 'method', detail: 'IEnumerable<(T, TSecond)> Zip(IEnumerable<TSecond>)', info: 'Pairs elements', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },

  // Element selection
  { label: 'First', type: 'method', detail: 'T First()', info: 'First element (throws if empty)', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'FirstOrDefault', type: 'method', detail: 'T? FirstOrDefault()', info: 'First element or default', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Last', type: 'method', detail: 'T Last()', info: 'Last element', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'LastOrDefault', type: 'method', detail: 'T? LastOrDefault()', info: 'Last element or default', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Single', type: 'method', detail: 'T Single()', info: 'Exactly one element (throws otherwise)', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'SingleOrDefault', type: 'method', detail: 'T? SingleOrDefault()', info: 'One element or default', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'ElementAt', type: 'method', detail: 'T ElementAt(int index)', info: 'Element at position', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'DefaultIfEmpty', type: 'method', detail: 'IEnumerable<T> DefaultIfEmpty()', info: 'Returns default if empty', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },

  // Quantifiers & aggregation
  { label: 'Any', type: 'method', detail: 'bool Any()', info: 'True if any elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'All', type: 'method', detail: 'bool All(Func<T, bool> predicate)', info: 'True if all match', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Count', type: 'method', detail: 'int Count()', info: 'Number of elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Sum', type: 'method', detail: 'numeric Sum()', info: 'Sum of elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Average', type: 'method', detail: 'double Average()', info: 'Average of elements', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Min', type: 'method', detail: 'T Min()', info: 'Minimum value', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Max', type: 'method', detail: 'T Max()', info: 'Maximum value', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'MinBy', type: 'method', detail: 'T MinBy(Func<T, TKey> keySelector)', info: 'Element with min key', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'MaxBy', type: 'method', detail: 'T MaxBy(Func<T, TKey> keySelector)', info: 'Element with max key', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Aggregate', type: 'method', detail: 'T Aggregate(Func<T, T, T> func)', info: 'Accumulates values', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Contains', type: 'method', detail: 'bool Contains(T value)', info: 'Checks for element', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'SequenceEqual', type: 'method', detail: 'bool SequenceEqual(IEnumerable<T> second)', info: 'Compares two sequences', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },

  // Partitioning & set
  { label: 'Distinct', type: 'method', detail: 'IEnumerable<T> Distinct()', info: 'Removes duplicates', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'DistinctBy', type: 'method', detail: 'IEnumerable<T> DistinctBy(Func<T, TKey> keySelector)', info: 'Distinct by key', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Take', type: 'method', detail: 'IEnumerable<T> Take(int count)', info: 'First n elements', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'TakeLast', type: 'method', detail: 'IEnumerable<T> TakeLast(int count)', info: 'Last n elements', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'TakeWhile', type: 'method', detail: 'IEnumerable<T> TakeWhile(Func<T, bool> predicate)', info: 'Takes while predicate true', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Skip', type: 'method', detail: 'IEnumerable<T> Skip(int count)', info: 'Skip first n', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'SkipLast', type: 'method', detail: 'IEnumerable<T> SkipLast(int count)', info: 'Skip last n', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'SkipWhile', type: 'method', detail: 'IEnumerable<T> SkipWhile(Func<T, bool> predicate)', info: 'Skips while predicate true', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Concat', type: 'method', detail: 'IEnumerable<T> Concat(IEnumerable<T> second)', info: 'Appends sequence', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Union', type: 'method', detail: 'IEnumerable<T> Union(IEnumerable<T> second)', info: 'Set union', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Intersect', type: 'method', detail: 'IEnumerable<T> Intersect(IEnumerable<T> second)', info: 'Set intersection', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Except', type: 'method', detail: 'IEnumerable<T> Except(IEnumerable<T> second)', info: 'Set difference', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Chunk', type: 'method', detail: 'IEnumerable<T[]> Chunk(int size)', info: 'Splits into chunks', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Prepend', type: 'method', detail: 'IEnumerable<T> Prepend(T element)', info: 'Adds to beginning', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'Append', type: 'method', detail: 'IEnumerable<T> Append(T element)', info: 'Adds to end', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },

  // Conversion
  { label: 'ToList', type: 'method', detail: 'List<T> ToList()', info: 'Converts to List', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'ToArray', type: 'method', detail: 'T[] ToArray()', info: 'Converts to array', boost: 100, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'ToDictionary', type: 'method', detail: 'Dictionary<TKey, T> ToDictionary(Func<T, TKey> keySelector)', info: 'Converts to dictionary', boost: 50, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'ToHashSet', type: 'method', detail: 'HashSet<T> ToHashSet()', info: 'Converts to HashSet', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
  { label: 'AsEnumerable', type: 'method', detail: 'IEnumerable<T> AsEnumerable()', info: 'Returns as IEnumerable', boost: 10, section: 'LINQ', triggerContext: 'linq', minWeek: 14 },
];

// ── 3.1.12 Exception Types ─────────────────────────────────────────────

const exceptionTypes: CompletionEntry[] = [
  { label: 'Exception', type: 'class', detail: 'System.Exception', info: 'General-purpose exception', boost: 100, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'ArgumentException', type: 'class', detail: 'System.ArgumentException', info: 'Invalid argument', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'ArgumentNullException', type: 'class', detail: 'System.ArgumentNullException', info: 'Null argument', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'ArgumentOutOfRangeException', type: 'class', detail: 'System.ArgumentOutOfRangeException', info: 'Out-of-range argument', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'InvalidOperationException', type: 'class', detail: 'System.InvalidOperationException', info: 'Invalid state for operation', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'FormatException', type: 'class', detail: 'System.FormatException', info: 'Parse/conversion failure', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'IndexOutOfRangeException', type: 'class', detail: 'System.IndexOutOfRangeException', info: 'Array/list out of bounds', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'DivideByZeroException', type: 'class', detail: 'System.DivideByZeroException', info: 'Division by zero', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'NullReferenceException', type: 'class', detail: 'System.NullReferenceException', info: 'Null dereference', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'IOException', type: 'class', detail: 'System.IO.IOException', info: 'File I/O failure', boost: 10, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'NotImplementedException', type: 'class', detail: 'System.NotImplementedException', info: 'Placeholder for unimplemented code', boost: 50, triggerContext: 'after-throw', minWeek: 12 },
  { label: 'OverflowException', type: 'class', detail: 'System.OverflowException', info: 'Numeric overflow', boost: 10, triggerContext: 'after-throw', minWeek: 12 },
];

// ── 3.1.13 Random, DateTime, TimeSpan, Environment ─────────────────────

const randomMembers: CompletionEntry[] = [
  { label: 'Next', type: 'method', detail: 'int Random.Next()', info: 'Non-negative random integer', boost: 100, section: 'Random', triggerContext: 'Random.' },
  { label: 'Next', type: 'method', detail: 'int Random.Next(int maxValue)', info: 'Random int in [0, max)', boost: 100, section: 'Random', triggerContext: 'Random.' },
  { label: 'Next', type: 'method', detail: 'int Random.Next(int minValue, int maxValue)', info: 'Random int in [min, max)', boost: 100, section: 'Random', triggerContext: 'Random.' },
  { label: 'NextDouble', type: 'method', detail: 'double Random.NextDouble()', info: 'Random double in [0.0, 1.0)', boost: 50, section: 'Random', triggerContext: 'Random.' },
  { label: 'NextSingle', type: 'method', detail: 'float Random.NextSingle()', info: 'Random float in [0.0, 1.0)', boost: 10, section: 'Random', triggerContext: 'Random.' },
  { label: 'NextInt64', type: 'method', detail: 'long Random.NextInt64()', info: 'Non-negative random long', boost: 10, section: 'Random', triggerContext: 'Random.' },
  { label: 'NextBytes', type: 'method', detail: 'void Random.NextBytes(byte[] buffer)', info: 'Fills array with random bytes', boost: 10, section: 'Random', triggerContext: 'Random.' },
  { label: 'Shared', type: 'property', detail: 'Random Random.Shared', info: 'Thread-safe shared instance', boost: 50, section: 'Random', triggerContext: 'Random.' },
];

const dateTimeStaticMembers: CompletionEntry[] = [
  { label: 'Now', type: 'property', detail: 'DateTime DateTime.Now', info: 'Current local date and time', boost: 100, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'Today', type: 'property', detail: 'DateTime DateTime.Today', info: 'Current date (midnight)', boost: 100, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'UtcNow', type: 'property', detail: 'DateTime DateTime.UtcNow', info: 'Current UTC date and time', boost: 50, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'MinValue', type: 'property', detail: 'DateTime DateTime.MinValue', info: 'Smallest possible value', boost: 10, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'MaxValue', type: 'property', detail: 'DateTime DateTime.MaxValue', info: 'Largest possible value', boost: 10, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'UnixEpoch', type: 'property', detail: 'DateTime DateTime.UnixEpoch', info: 'Jan 1, 1970 UTC', boost: 10, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'Parse', type: 'method', detail: 'DateTime DateTime.Parse(string s)', info: 'Parses date string', boost: 50, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'TryParse', type: 'method', detail: 'bool DateTime.TryParse(string s, out DateTime result)', info: 'Safe parse', boost: 50, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'ParseExact', type: 'method', detail: 'DateTime DateTime.ParseExact(string s, string format, IFormatProvider)', info: 'Parses with exact format', boost: 10, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'IsLeapYear', type: 'method', detail: 'bool DateTime.IsLeapYear(int year)', info: 'Checks leap year', boost: 10, section: 'DateTime', triggerContext: 'DateTime.' },
  { label: 'DaysInMonth', type: 'method', detail: 'int DateTime.DaysInMonth(int year, int month)', info: 'Days in specified month', boost: 10, section: 'DateTime', triggerContext: 'DateTime.' },
];

const dateTimeInstanceMembers: CompletionEntry[] = [
  { label: 'Year', type: 'property', detail: 'int DateTime.Year', info: 'Year component', boost: 100, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Month', type: 'property', detail: 'int DateTime.Month', info: 'Month (1-12)', boost: 100, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Day', type: 'property', detail: 'int DateTime.Day', info: 'Day (1-31)', boost: 100, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Hour', type: 'property', detail: 'int DateTime.Hour', info: 'Hour (0-23)', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Minute', type: 'property', detail: 'int DateTime.Minute', info: 'Minute (0-59)', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Second', type: 'property', detail: 'int DateTime.Second', info: 'Second (0-59)', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'DayOfWeek', type: 'property', detail: 'DayOfWeek DateTime.DayOfWeek', info: 'Day of the week', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'DayOfYear', type: 'property', detail: 'int DateTime.DayOfYear', info: 'Day of year (1-366)', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Date', type: 'property', detail: 'DateTime DateTime.Date', info: 'Date part only (midnight)', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'TimeOfDay', type: 'property', detail: 'TimeSpan DateTime.TimeOfDay', info: 'Time part only', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Ticks', type: 'property', detail: 'long DateTime.Ticks', info: '100-nanosecond intervals', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToString', type: 'method', detail: 'string DateTime.ToString()', info: 'Default format', boost: 100, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToString', type: 'method', detail: 'string DateTime.ToString(string format)', info: 'Custom format (e.g., "yyyy-MM-dd")', boost: 100, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToShortDateString', type: 'method', detail: 'string DateTime.ToShortDateString()', info: 'Short date format', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToLongDateString', type: 'method', detail: 'string DateTime.ToLongDateString()', info: 'Long date format', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToShortTimeString', type: 'method', detail: 'string DateTime.ToShortTimeString()', info: 'Short time format', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'AddDays', type: 'method', detail: 'DateTime DateTime.AddDays(double value)', info: 'Adds days', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'AddHours', type: 'method', detail: 'DateTime DateTime.AddHours(double value)', info: 'Adds hours', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'AddMinutes', type: 'method', detail: 'DateTime DateTime.AddMinutes(double value)', info: 'Adds minutes', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'AddSeconds', type: 'method', detail: 'DateTime DateTime.AddSeconds(double value)', info: 'Adds seconds', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'AddMonths', type: 'method', detail: 'DateTime DateTime.AddMonths(int months)', info: 'Adds months', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'AddYears', type: 'method', detail: 'DateTime DateTime.AddYears(int value)', info: 'Adds years', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Subtract', type: 'method', detail: 'TimeSpan DateTime.Subtract(DateTime value)', info: 'Difference between dates', boost: 50, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'CompareTo', type: 'method', detail: 'int DateTime.CompareTo(DateTime value)', info: 'Compares dates', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'Equals', type: 'method', detail: 'bool DateTime.Equals(DateTime value)', info: 'Equality check', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToUniversalTime', type: 'method', detail: 'DateTime DateTime.ToUniversalTime()', info: 'Converts to UTC', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
  { label: 'ToLocalTime', type: 'method', detail: 'DateTime DateTime.ToLocalTime()', info: 'Converts to local', boost: 10, section: 'DateTime', triggerContext: 'DateTime-instance' },
];

const timeSpanStaticMembers: CompletionEntry[] = [
  { label: 'FromDays', type: 'method', detail: 'TimeSpan TimeSpan.FromDays(double value)', info: 'Creates TimeSpan from days', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'FromHours', type: 'method', detail: 'TimeSpan TimeSpan.FromHours(double value)', info: 'Creates from hours', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'FromMinutes', type: 'method', detail: 'TimeSpan TimeSpan.FromMinutes(double value)', info: 'Creates from minutes', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'FromSeconds', type: 'method', detail: 'TimeSpan TimeSpan.FromSeconds(double value)', info: 'Creates from seconds', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'FromMilliseconds', type: 'method', detail: 'TimeSpan TimeSpan.FromMilliseconds(double value)', info: 'Creates from ms', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'Parse', type: 'method', detail: 'TimeSpan TimeSpan.Parse(string s)', info: 'Parses "hh:mm:ss"', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'TryParse', type: 'method', detail: 'bool TimeSpan.TryParse(string s, out TimeSpan result)', info: 'Safe parse', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'Zero', type: 'property', detail: 'TimeSpan TimeSpan.Zero', info: 'Zero duration', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'MinValue', type: 'property', detail: 'TimeSpan TimeSpan.MinValue', info: 'Minimum TimeSpan', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
  { label: 'MaxValue', type: 'property', detail: 'TimeSpan TimeSpan.MaxValue', info: 'Maximum TimeSpan', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan.' },
];

const timeSpanInstanceMembers: CompletionEntry[] = [
  { label: 'Days', type: 'property', detail: 'int TimeSpan.Days', info: 'Days component', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Hours', type: 'property', detail: 'int TimeSpan.Hours', info: 'Hours component', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Minutes', type: 'property', detail: 'int TimeSpan.Minutes', info: 'Minutes component', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Seconds', type: 'property', detail: 'int TimeSpan.Seconds', info: 'Seconds component', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Milliseconds', type: 'property', detail: 'int TimeSpan.Milliseconds', info: 'Milliseconds component', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'TotalDays', type: 'property', detail: 'double TimeSpan.TotalDays', info: 'Total in days', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'TotalHours', type: 'property', detail: 'double TimeSpan.TotalHours', info: 'Total in hours', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'TotalMinutes', type: 'property', detail: 'double TimeSpan.TotalMinutes', info: 'Total in minutes', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'TotalSeconds', type: 'property', detail: 'double TimeSpan.TotalSeconds', info: 'Total in seconds', boost: 50, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'TotalMilliseconds', type: 'property', detail: 'double TimeSpan.TotalMilliseconds', info: 'Total in milliseconds', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Ticks', type: 'property', detail: 'long TimeSpan.Ticks', info: 'Total ticks', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Add', type: 'method', detail: 'TimeSpan TimeSpan.Add(TimeSpan ts)', info: 'Adds TimeSpan', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Subtract', type: 'method', detail: 'TimeSpan TimeSpan.Subtract(TimeSpan ts)', info: 'Subtracts TimeSpan', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Negate', type: 'method', detail: 'TimeSpan TimeSpan.Negate()', info: 'Negation', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'Duration', type: 'method', detail: 'TimeSpan TimeSpan.Duration()', info: 'Absolute value', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
  { label: 'ToString', type: 'method', detail: 'string TimeSpan.ToString()', info: 'Default format', boost: 10, section: 'TimeSpan', triggerContext: 'TimeSpan-instance' },
];

const environmentMembers: CompletionEntry[] = [
  { label: 'NewLine', type: 'property', detail: 'string Environment.NewLine', info: 'Platform line terminator', boost: 50, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'Exit', type: 'method', detail: 'void Environment.Exit(int exitCode)', info: 'Terminates the process', boost: 50, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'MachineName', type: 'property', detail: 'string Environment.MachineName', info: 'Computer name', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'UserName', type: 'property', detail: 'string Environment.UserName', info: 'Current user name', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'OSVersion', type: 'property', detail: 'OperatingSystem Environment.OSVersion', info: 'OS version info', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'Is64BitOperatingSystem', type: 'property', detail: 'bool Environment.Is64BitOperatingSystem', info: '64-bit OS check', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'ProcessorCount', type: 'property', detail: 'int Environment.ProcessorCount', info: 'Number of processors', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'CurrentDirectory', type: 'property', detail: 'string Environment.CurrentDirectory', info: 'Current working directory', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'TickCount', type: 'property', detail: 'int Environment.TickCount', info: 'Milliseconds since boot', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'TickCount64', type: 'property', detail: 'long Environment.TickCount64', info: 'Milliseconds since boot (long)', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'Version', type: 'property', detail: 'Version Environment.Version', info: '.NET runtime version', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'GetEnvironmentVariable', type: 'method', detail: 'string? Environment.GetEnvironmentVariable(string variable)', info: 'Gets env variable', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'SetEnvironmentVariable', type: 'method', detail: 'void Environment.SetEnvironmentVariable(string variable, string? value)', info: 'Sets env variable', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'GetCommandLineArgs', type: 'method', detail: 'string[] Environment.GetCommandLineArgs()', info: 'Command line arguments', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'StackTrace', type: 'property', detail: 'string Environment.StackTrace', info: 'Current stack trace', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'CommandLine', type: 'property', detail: 'string Environment.CommandLine', info: 'Command line string', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
  { label: 'FailFast', type: 'method', detail: 'void Environment.FailFast(string message)', info: 'Immediate termination with message', boost: 10, section: 'Environment', triggerContext: 'Environment.' },
];

// ── 3.1.14 Enum Helpers ────────────────────────────────────────────────

const enumHelpers: CompletionEntry[] = [
  { label: 'IsDefined', type: 'method', detail: 'bool Enum.IsDefined(Type enumType, object value)', info: 'Checks if value is defined in enum', boost: 10, section: 'Enum', triggerContext: 'Enum.', minWeek: 13 },
  { label: 'GetValues', type: 'method', detail: 'Array Enum.GetValues(Type enumType)', info: 'Gets all values of enum', boost: 10, section: 'Enum', triggerContext: 'Enum.', minWeek: 13 },
  { label: 'Parse', type: 'method', detail: 'object Enum.Parse(Type enumType, string value)', info: 'Parses string to enum', boost: 10, section: 'Enum', triggerContext: 'Enum.', minWeek: 13 },
  { label: 'GetNames', type: 'method', detail: 'string[] Enum.GetNames(Type enumType)', info: 'Gets all names of enum', boost: 10, section: 'Enum', triggerContext: 'Enum.', minWeek: 13 },
  { label: 'TryParse', type: 'method', detail: 'bool Enum.TryParse<TEnum>(string value, out TEnum result)', info: 'Safe parse to enum', boost: 10, section: 'Enum', triggerContext: 'Enum.', minWeek: 13 },
];

// ── Top-level class names for completion ────────────────────────────────

const classNames: CompletionEntry[] = [
  { label: 'Console', type: 'class', detail: 'System.Console', info: 'Provides standard input/output/error streams', boost: 100 },
  { label: 'Math', type: 'class', detail: 'System.Math', info: 'Provides constants and static methods for math operations', boost: 90 },
  { label: 'Convert', type: 'class', detail: 'System.Convert', info: 'Converts a base data type to another', boost: 80 },
  { label: 'Random', type: 'class', detail: 'System.Random', info: 'Pseudo-random number generator', boost: 70 },
  { label: 'DateTime', type: 'class', detail: 'System.DateTime', info: 'Represents a date and time', boost: 60 },
  { label: 'TimeSpan', type: 'class', detail: 'System.TimeSpan', info: 'Represents a time interval', boost: 40 },
  { label: 'Environment', type: 'class', detail: 'System.Environment', info: 'Provides information about the current environment', boost: 30 },
  { label: 'Array', type: 'class', detail: 'System.Array', info: 'Base class for arrays with static utility methods', boost: 60, minWeek: 6 },
  { label: 'ConsoleColor', type: 'enum', detail: 'System.ConsoleColor', info: 'Defines console foreground and background colors', boost: 30 },
  { label: 'Enum', type: 'class', detail: 'System.Enum', info: 'Base class for enumerations', boost: 20, minWeek: 13 },
  { label: 'List', type: 'class', detail: 'System.Collections.Generic.List<T>', info: 'Strongly typed dynamic list', boost: 80, minWeek: 6 },
  { label: 'Dictionary', type: 'class', detail: 'System.Collections.Generic.Dictionary<TKey, TValue>', info: 'Key-value pair collection', boost: 50, minWeek: 13 },
  { label: 'Stack', type: 'class', detail: 'System.Collections.Generic.Stack<T>', info: 'Last-in, first-out collection', boost: 40, minWeek: 13 },
  { label: 'Queue', type: 'class', detail: 'System.Collections.Generic.Queue<T>', info: 'First-in, first-out collection', boost: 40, minWeek: 13 },
  { label: 'HashSet', type: 'class', detail: 'System.Collections.Generic.HashSet<T>', info: 'Unique element collection', boost: 30, minWeek: 13 },
  // Exception types as top-level
  ...exceptionTypes.map(e => ({ ...e, triggerContext: undefined as string | undefined })),
];

// ── Combined Registry ──────────────────────────────────────────────────

export const completionRegistry: CompletionEntry[] = [
  ...keywords,
  ...primitiveTypes,
  ...classNames,
  ...consoleMethods,
  ...consoleColorMembers,
  ...intParseMethods,
  ...doubleParseMethods,
  ...decimalParseMethods,
  ...boolParseMethods,
  ...convertMethods,
  ...stringInstanceMembers,
  ...stringStaticMembers,
  ...mathMembers,
  ...listMembers,
  ...dictionaryMembers,
  ...stackMembers,
  ...queueMembers,
  ...hashSetMembers,
  ...arrayInstanceMembers,
  ...arrayStaticMembers,
  ...linqMembers,
  ...exceptionTypes,
  ...randomMembers,
  ...dateTimeStaticMembers,
  ...dateTimeInstanceMembers,
  ...timeSpanStaticMembers,
  ...timeSpanInstanceMembers,
  ...environmentMembers,
  ...enumHelpers,
];

/** Lookup map: triggerContext → entries for that context */
export const contextMap = new Map<string, CompletionEntry[]>();
for (const entry of completionRegistry) {
  if (entry.triggerContext) {
    const list = contextMap.get(entry.triggerContext) ?? [];
    list.push(entry);
    contextMap.set(entry.triggerContext, list);
  }
}

/** All entries without a triggerContext (keywords, types, class names) */
export const globalEntries = completionRegistry.filter(e => !e.triggerContext);
