import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import { completionRegistry, type CompletionEntry } from '../data/completion-registry';

/**
 * Keyword documentation for hover tooltips.
 */
const keywordDocs: Record<string, string> = {
  if: 'Executes a block if a condition is true',
  else: 'Executes a block if the preceding if condition is false',
  switch: 'Selects a block to execute from multiple choices',
  case: 'Defines a branch in a switch statement',
  default: 'Default branch in a switch statement',
  break: 'Exits the current loop or switch',
  continue: 'Skips to the next iteration of the loop',
  return: 'Returns a value from a method',
  for: 'Repeats a block a specific number of times',
  foreach: 'Iterates over each element in a collection',
  while: 'Repeats a block while a condition is true',
  do: 'Executes a block at least once, then repeats while condition is true',
  class: 'Defines a new class type',
  interface: 'Defines a contract that classes can implement',
  abstract: 'Indicates a class or member must be implemented by derived classes',
  virtual: 'Allows a method to be overridden in derived classes',
  override: 'Overrides a virtual member from a base class',
  static: 'Declares a member that belongs to the type itself, not instances',
  void: 'Specifies that a method does not return a value',
  public: 'Member is accessible from anywhere',
  private: 'Member is accessible only within the containing class',
  protected: 'Member is accessible within the class and derived classes',
  internal: 'Member is accessible within the same assembly',
  namespace: 'Organizes code into logical groups',
  using: 'Imports a namespace or defines a scope for IDisposable resources',
  new: 'Creates a new instance of a type',
  this: 'Refers to the current instance of the class',
  base: 'Refers to the base class of the current class',
  var: 'Declares a variable with compiler-inferred type',
  const: 'Declares a compile-time constant',
  readonly: 'Field can only be assigned in declaration or constructor',
  enum: 'Defines a set of named integer constants',
  struct: 'Defines a value type that can contain data members',
  is: 'Checks if an object is of a given type at runtime',
  as: 'Casts an object to a type, returns null if invalid',
  typeof: 'Gets the System.Type object of a type at compile time',
  try: 'Defines a block to attempt that might throw exceptions',
  catch: 'Handles exceptions thrown in the try block',
  finally: 'Code that always executes after try/catch, even if an exception occurs',
  throw: 'Throws an exception',
  null: 'Represents a null reference — no object',
  true: 'Boolean true value',
  false: 'Boolean false value',
  async: 'Marks a method as asynchronous, enabling the use of await',
  await: 'Pauses execution until an asynchronous operation completes',
  in: 'Used in foreach to specify the collection to iterate over',
  get: 'Defines the get accessor of a property',
  set: 'Defines the set accessor of a property',
};

/**
 * Build a lookup for member-access hover:
 * key = "ClassName.MemberName" or just "MemberName" → entry
 */
const memberLookup = new Map<string, CompletionEntry>();
for (const entry of completionRegistry) {
  if (entry.triggerContext && entry.detail) {
    // Build key like "Console.WriteLine", "Math.Pow", etc.
    const ctx = entry.triggerContext.replace('.', '').replace('-instance', '');
    const key = `${ctx}.${entry.label}`;
    if (!memberLookup.has(key)) {
      memberLookup.set(key, entry);
    }
  }
}

/**
 * Creates a hover tooltip extension for the C# editor.
 */
export function csharpHover() {
  return hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
    const { from, to, text } = view.state.doc.lineAt(pos);
    const lineText = text;
    const colPos = pos - from;

    // Get the word under cursor
    let wordStart = colPos;
    let wordEnd = colPos;
    while (wordStart > 0 && /[\w.]/.test(lineText[wordStart - 1])) wordStart--;
    while (wordEnd < lineText.length && /[\w.]/.test(lineText[wordEnd])) wordEnd++;

    const hoveredText = lineText.slice(wordStart, wordEnd);
    if (!hoveredText || hoveredText.length < 2) return null;

    // Skip if inside a string literal or comment
    const beforeHover = lineText.slice(0, wordStart);
    if (beforeHover.includes('//')) return null;
    const quoteCount = (beforeHover.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) return null;

    let tooltipContent: string | null = null;

    // Check for member access: Console.WriteLine, Math.Pow, etc.
    if (hoveredText.includes('.')) {
      const entry = memberLookup.get(hoveredText);
      if (entry) {
        tooltipContent = entry.detail || '';
        if (entry.info) tooltipContent += `\n${entry.info}`;
      }
    }

    // Check for keyword
    if (!tooltipContent && keywordDocs[hoveredText]) {
      tooltipContent = `(keyword) ${hoveredText}\n${keywordDocs[hoveredText]}`;
    }

    // Check for known type/class names
    if (!tooltipContent) {
      const typeEntry = completionRegistry.find(
        e => e.label === hoveredText && (e.type === 'class' || e.type === 'type' || e.type === 'enum')
      );
      if (typeEntry) {
        tooltipContent = typeEntry.detail || '';
        if (typeEntry.info) tooltipContent += `\n${typeEntry.info}`;
      }
    }

    // Check for exception types
    if (!tooltipContent && hoveredText.endsWith('Exception')) {
      const excEntry = completionRegistry.find(
        e => e.label === hoveredText && e.type === 'class'
      );
      if (excEntry) {
        tooltipContent = excEntry.detail || '';
        if (excEntry.info) tooltipContent += `\n${excEntry.info}`;
      }
    }

    if (!tooltipContent) return null;

    return {
      pos: from + wordStart,
      end: from + wordEnd,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-csharp-tooltip';
        dom.style.cssText = 'padding: 4px 8px; font-family: monospace; font-size: 13px; max-width: 500px; white-space: pre-wrap;';

        const lines = tooltipContent!.split('\n');
        if (lines.length > 1) {
          const sig = document.createElement('div');
          sig.style.fontWeight = 'bold';
          sig.textContent = lines[0];
          dom.appendChild(sig);

          const desc = document.createElement('div');
          desc.style.cssText = 'color: #aaa; margin-top: 2px;';
          desc.textContent = lines.slice(1).join('\n');
          dom.appendChild(desc);
        } else {
          dom.textContent = tooltipContent!;
        }

        return { dom };
      },
    };
  });
}
