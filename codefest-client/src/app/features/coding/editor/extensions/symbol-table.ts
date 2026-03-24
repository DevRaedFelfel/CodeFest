import { type LintContext } from './diagnostic-helpers';

/** Information about a declared variable. */
export interface VariableInfo {
  name: string;
  type: string;           // "int", "string", "double", "bool", "List<int>", "unknown", etc.
  declaredLine: number;
  initialized: boolean;
  usedLines: number[];
}

/** Information about a declared method. */
export interface MethodInfo {
  name: string;
  returnType: string;
  params: Array<{ name: string; type: string }>;
  isStatic: boolean;
  declaredLine: number;
}

/** Lightweight symbol table built from a single-file C# program. */
export interface SymbolTable {
  variables: Map<string, VariableInfo>;
  methods: Map<string, MethodInfo[]>;
  currentClass: string | null;
}

// Type declaration patterns
const EXPLICIT_DECL = /^\s*(?:(?:public|private|protected|internal|static|readonly|const)\s+)*?(int|string|double|bool|char|decimal|float|long|short|byte|object|void|var|List<\w+>|Dictionary<\w+,\s*\w+>|Stack<\w+>|Queue<\w+>|HashSet<\w+>|int\[\]|string\[\]|double\[\]|bool\[\]|char\[\]|\w+\[\]|\w+)\s+(\w+)\s*([=;,)])/;
const VAR_NEW = /\bvar\s+(\w+)\s*=\s*new\s+(\w+(?:<[^>]+>)?)/;
const VAR_READLINE = /\bvar\s+(\w+)\s*=\s*Console\.ReadLine\(\)/;
const VAR_PARSE = /\bvar\s+(\w+)\s*=\s*(int|double|decimal|float|long|bool)\.Parse\b/;
const VAR_LITERAL = /\bvar\s+(\w+)\s*=\s*(".*"|'.'|true|false|\d+\.\d+|\d+)\s*;/;
const METHOD_DECL = /^\s*(?:(?:public|private|protected|internal|static|abstract|virtual|override|async)\s+)*?(void|int|string|double|bool|char|decimal|float|long|Task(?:<\w+>)?|\w+)\s+(\w+)\s*\(([^)]*)\)/;
const FOR_VAR = /\bfor\s*\(\s*(int|var)\s+(\w+)/;
const FOREACH_VAR = /\bforeach\s*\(\s*(?:var|int|string|double|bool|char|decimal|float|long|\w+)\s+(\w+)\s+in\b/;

/**
 * Build a lightweight symbol table from the document.
 * Single-pass, best-effort. Unknown types are marked as "unknown".
 */
export function buildSymbolTable(ctx: LintContext): SymbolTable {
  const variables = new Map<string, VariableInfo>();
  const methods = new Map<string, MethodInfo[]>();
  let currentClass: string | null = null;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.length === 0) continue;

    // Detect class name
    const classMatch = trimmed.match(/\bclass\s+(\w+)/);
    if (classMatch) {
      currentClass = classMatch[1];
    }

    // Method declarations
    const methodMatch = line.match(METHOD_DECL);
    if (methodMatch) {
      const returnType = methodMatch[1];
      const name = methodMatch[2];
      const paramStr = methodMatch[3];
      const params = parseParams(paramStr);
      const isStatic = /\bstatic\b/.test(line);

      const entry: MethodInfo = { name, returnType, params, isStatic, declaredLine: i };
      const existing = methods.get(name);
      if (existing) {
        existing.push(entry);
      } else {
        methods.set(name, [entry]);
      }

      // Register method parameters as variables
      for (const p of params) {
        variables.set(p.name, {
          name: p.name,
          type: p.type,
          declaredLine: i,
          initialized: true,
          usedLines: [],
        });
      }
      continue;
    }

    // var with new
    const varNewMatch = line.match(VAR_NEW);
    if (varNewMatch) {
      registerVar(variables, varNewMatch[1], varNewMatch[2], i, true);
      continue;
    }

    // var = Console.ReadLine()
    const varReadMatch = line.match(VAR_READLINE);
    if (varReadMatch) {
      registerVar(variables, varReadMatch[1], 'string', i, true);
      continue;
    }

    // var = int.Parse(...)
    const varParseMatch = line.match(VAR_PARSE);
    if (varParseMatch) {
      registerVar(variables, varParseMatch[1], varParseMatch[2], i, true);
      continue;
    }

    // var = literal
    const varLitMatch = line.match(VAR_LITERAL);
    if (varLitMatch) {
      const type = inferLiteralType(varLitMatch[2]);
      registerVar(variables, varLitMatch[1], type, i, true);
      continue;
    }

    // for loop variable
    const forMatch = line.match(FOR_VAR);
    if (forMatch) {
      registerVar(variables, forMatch[2], 'int', i, true);
      continue;
    }

    // foreach variable
    const foreachMatch = line.match(FOREACH_VAR);
    if (foreachMatch) {
      registerVar(variables, foreachMatch[1], 'unknown', i, true);
      continue;
    }

    // Explicit type declarations
    const explicitMatch = line.match(EXPLICIT_DECL);
    if (explicitMatch && explicitMatch[1] !== 'var') {
      const type = explicitMatch[1];
      const name = explicitMatch[2];
      const tail = explicitMatch[3];
      const initialized = tail === '=';
      registerVar(variables, name, type, i, initialized);
    }
  }

  // Second pass: find variable usages
  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (line.trim().startsWith('//')) continue;

    for (const [name, info] of variables) {
      if (i === info.declaredLine) continue;
      // Simple word-boundary check for usage
      const usageRegex = new RegExp(`\\b${escapeRegex(name)}\\b`);
      if (usageRegex.test(line)) {
        info.usedLines.push(i);
      }
    }
  }

  return { variables, methods, currentClass };
}

function registerVar(
  map: Map<string, VariableInfo>,
  name: string,
  type: string,
  line: number,
  initialized: boolean,
): void {
  if (!map.has(name)) {
    map.set(name, { name, type, declaredLine: line, initialized, usedLines: [] });
  }
}

function inferLiteralType(literal: string): string {
  if (literal.startsWith('"')) return 'string';
  if (literal.startsWith("'")) return 'char';
  if (literal === 'true' || literal === 'false') return 'bool';
  if (literal.includes('.')) return 'double';
  return 'int';
}

function parseParams(paramStr: string): Array<{ name: string; type: string }> {
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { type: parts.slice(0, -1).join(' '), name: parts[parts.length - 1] };
    }
    return { type: 'unknown', name: parts[0] || '' };
  }).filter(p => p.name.length > 0);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
