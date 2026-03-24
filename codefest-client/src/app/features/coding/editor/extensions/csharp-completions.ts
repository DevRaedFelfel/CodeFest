import { CompletionContext, type CompletionResult, type Completion } from '@codemirror/autocomplete';
import { contextMap, globalEntries, type CompletionEntry } from '../data/completion-registry';
import { csharpSnippets } from './csharp-snippets';

/**
 * Known static class names that trigger member-access completions.
 * Maps the identifier before "." to the triggerContext key in the registry.
 */
const staticClassTriggers: Record<string, string> = {
  Console: 'Console.',
  Math: 'Math.',
  Convert: 'Convert.',
  Array: 'Array.',
  Environment: 'Environment.',
  Enum: 'Enum.',
  ConsoleColor: 'ConsoleColor.',
};

/**
 * Primitive type triggers (int., double., etc.)
 */
const primitiveTypeTriggers: Record<string, string> = {
  int: 'int.',
  double: 'double.',
  decimal: 'decimal.',
  bool: 'bool.',
};

/**
 * Instance-type identifiers: if we see `DateTime` as a declared type,
 * instances get these members. Also string-instance for string variables.
 */
const instanceTypeContexts: Record<string, string> = {
  string: 'string-instance',
  DateTime: 'DateTime-instance',
  TimeSpan: 'TimeSpan-instance',
};

/**
 * Collection type patterns → triggerContext.
 * We match the generic type name in variable declarations.
 */
const collectionTriggers: Record<string, string> = {
  List: 'List.',
  Dictionary: 'Dictionary.',
  Stack: 'Stack.',
  Queue: 'Queue.',
  HashSet: 'HashSet.',
};

/** Convert a registry CompletionEntry to a CodeMirror Completion */
function toCompletion(entry: CompletionEntry): Completion {
  return {
    label: entry.label,
    type: entry.type,
    detail: entry.detail,
    info: entry.info,
    boost: entry.boost ?? 0,
    section: entry.section ? { name: entry.section, rank: 0 } : undefined,
  };
}

/**
 * Scan the document text for variable declarations to build a simple
 * variable→type map. This is a lightweight heuristic, not a full parser.
 */
function inferVariableTypes(code: string): Map<string, string> {
  const varTypes = new Map<string, string>();

  // Match explicit type declarations: Type varName (with optional generics)
  // e.g., "string name", "List<int> numbers", "DateTime dt"
  const declRegex = /\b(string|int|double|bool|char|decimal|long|float|short|byte|DateTime|TimeSpan|List<[^>]*>|Dictionary<[^>]*>|Stack<[^>]*>|Queue<[^>]*>|HashSet<[^>]*>|Random)\s+(\w+)\b/g;
  let match;
  while ((match = declRegex.exec(code)) !== null) {
    const rawType = match[1];
    const varName = match[2];
    // Strip generic parameters for lookup
    const baseType = rawType.replace(/<.*>/, '');
    varTypes.set(varName, baseType);
  }

  // Match var declarations with new: var x = new Type(...)
  const varNewRegex = /\bvar\s+(\w+)\s*=\s*new\s+(string|DateTime|TimeSpan|List|Dictionary|Stack|Queue|HashSet|Random)(?:<[^>]*>)?\s*\(/g;
  while ((match = varNewRegex.exec(code)) !== null) {
    varTypes.set(match[1], match[2]);
  }

  // Match var x = Console.ReadLine() → string
  const varReadLineRegex = /\bvar\s+(\w+)\s*=\s*Console\.ReadLine\s*\(/g;
  while ((match = varReadLineRegex.exec(code)) !== null) {
    varTypes.set(match[1], 'string');
  }

  // Match var x = int.Parse(...) → int, etc.
  const varParseRegex = /\bvar\s+(\w+)\s*=\s*(int|double|decimal|bool|long|float|short|byte)\.Parse\b/g;
  while ((match = varParseRegex.exec(code)) !== null) {
    varTypes.set(match[1], match[2]);
  }

  // Match var x = DateTime.Now / DateTime.Today
  const varDateTimeRegex = /\bvar\s+(\w+)\s*=\s*DateTime\.(Now|Today|UtcNow)\b/g;
  while ((match = varDateTimeRegex.exec(code)) !== null) {
    varTypes.set(match[1], 'DateTime');
  }

  // Match var x = new Random()
  const varRandomRegex = /\bvar\s+(\w+)\s*=\s*new\s+Random\s*\(/g;
  while ((match = varRandomRegex.exec(code)) !== null) {
    varTypes.set(match[1], 'Random');
  }

  // Match string[] or int[] arrays
  const arrayRegex = /\b(string|int|double|bool|char|decimal|long|float)\s*\[\]\s+(\w+)\b/g;
  while ((match = arrayRegex.exec(code)) !== null) {
    varTypes.set(match[2], 'Array');
  }

  // Match var x = new Type[] { ... }
  const varArrayRegex = /\bvar\s+(\w+)\s*=\s*new\s+\w+\s*\[/g;
  while ((match = varArrayRegex.exec(code)) !== null) {
    varTypes.set(match[1], 'Array');
  }

  return varTypes;
}

/**
 * Check if LINQ should be active based on code content.
 */
function isLinqActive(code: string, weekNumber?: number): boolean {
  if (weekNumber !== undefined && weekNumber >= 14) return true;
  return /using\s+System\.Linq\s*;/.test(code);
}

/**
 * Creates a C# CompletionSource function for CodeMirror.
 * @param weekNumber Optional week number for progressive disclosure
 */
export function csharpCompletionSource(weekNumber?: number) {
  return (context: CompletionContext): CompletionResult | null => {
    const code = context.state.doc.toString();

    // ── Dot-triggered completions ──────────────────────────────────
    // Check if we're after "identifier."
    const dotMatch = context.matchBefore(/(\w+)\.\w*$/);
    if (dotMatch) {
      const identifier = dotMatch.text.split('.')[0];
      const from = dotMatch.from + identifier.length + 1; // after the dot

      let entries: CompletionEntry[] = [];

      // Static class triggers: Console., Math., etc.
      if (staticClassTriggers[identifier]) {
        entries = contextMap.get(staticClassTriggers[identifier]) ?? [];
      }
      // Primitive type triggers: int., double., etc.
      else if (primitiveTypeTriggers[identifier]) {
        entries = contextMap.get(primitiveTypeTriggers[identifier]) ?? [];
      }
      // Static string. triggers
      else if (identifier === 'string' || identifier === 'String') {
        entries = contextMap.get('string.') ?? [];
      }
      // DateTime. and TimeSpan. static triggers
      else if (identifier === 'DateTime') {
        entries = contextMap.get('DateTime.') ?? [];
      }
      else if (identifier === 'TimeSpan') {
        entries = contextMap.get('TimeSpan.') ?? [];
      }
      else if (identifier === 'Random') {
        entries = contextMap.get('Random.') ?? [];
      }
      else {
        // Try to resolve variable type
        const varTypes = inferVariableTypes(code);
        const varType = varTypes.get(identifier);

        if (varType) {
          // Instance member completions
          const instanceCtx = instanceTypeContexts[varType];
          if (instanceCtx) {
            entries = contextMap.get(instanceCtx) ?? [];
          }

          // Collection instance members
          const collCtx = collectionTriggers[varType];
          if (collCtx) {
            entries = contextMap.get(collCtx) ?? [];
          }

          // Array instance members
          if (varType === 'Array') {
            entries = contextMap.get('Array-instance') ?? [];
          }

          // Random instance members
          if (varType === 'Random') {
            entries = contextMap.get('Random.') ?? [];
          }

          // LINQ extension methods for collections/arrays
          if (isLinqActive(code, weekNumber) &&
              ['List', 'Dictionary', 'Stack', 'Queue', 'HashSet', 'Array', 'string'].includes(varType)) {
            const linqEntries = contextMap.get('linq') ?? [];
            entries = [...entries, ...linqEntries];
          }
        } else {
          // Unknown variable — check if it looks like a string literal access
          // e.g., after "someString." - show string instance members as a default fallback
          // We'll be conservative and just return null for unknown variables
        }
      }

      if (entries.length === 0) return null;

      // Filter by week if applicable
      const filtered = weekNumber !== undefined
        ? entries.filter(e => !e.minWeek || e.minWeek <= weekNumber)
        : entries;

      return {
        from,
        options: filtered.map(toCompletion),
        validFor: /^\w*$/,
      };
    }

    // ── "throw new " completions ───────────────────────────────────
    const throwMatch = context.matchBefore(/throw\s+new\s+\w*$/);
    if (throwMatch) {
      const from = throwMatch.from + throwMatch.text.lastIndexOf('new ') + 4;
      const entries = contextMap.get('after-throw') ?? [];
      const filtered = weekNumber !== undefined
        ? entries.filter(e => !e.minWeek || e.minWeek <= weekNumber)
        : entries;
      return {
        from,
        options: filtered.map(toCompletion),
        validFor: /^\w*$/,
      };
    }

    // ── "catch (" completions ──────────────────────────────────────
    const catchMatch = context.matchBefore(/catch\s*\(\s*\w*$/);
    if (catchMatch) {
      const wordStart = catchMatch.text.match(/\w*$/);
      const from = catchMatch.from + (wordStart?.index ?? catchMatch.text.length);
      const entries = contextMap.get('after-throw') ?? []; // same exception types
      const filtered = weekNumber !== undefined
        ? entries.filter(e => !e.minWeek || e.minWeek <= weekNumber)
        : entries;
      return {
        from,
        options: filtered.map(toCompletion),
        validFor: /^\w*$/,
      };
    }

    // ── General keyword/type/class completions ─────────────────────
    const wordMatch = context.matchBefore(/\w+$/);
    if (!wordMatch || wordMatch.text.length < 2) return null;

    // Filter global entries by week
    const filtered = weekNumber !== undefined
      ? globalEntries.filter(e => !e.minWeek || e.minWeek <= weekNumber)
      : globalEntries;

    // Combine with snippets
    const options: Completion[] = [
      ...filtered.map(toCompletion),
      ...csharpSnippets,
    ];

    return {
      from: wordMatch.from,
      options,
      validFor: /^\w*$/,
    };
  };
}
