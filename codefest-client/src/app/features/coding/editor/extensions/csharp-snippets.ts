import { snippetCompletion } from '@codemirror/autocomplete';
import type { Completion } from '@codemirror/autocomplete';

/**
 * C# snippet templates — expand on Tab/Enter.
 * Uses CodeMirror's snippet syntax: #{n} for tab stops, ${text} for placeholders.
 */
export const csharpSnippets: Completion[] = [
  snippetCompletion('if (${condition})\n{\n\t${}\n}', {
    label: 'if',
    detail: 'if statement',
    type: 'snippet',
    boost: 90,
  }),
  snippetCompletion('if (${condition})\n{\n\t${}\n}\nelse\n{\n\t\n}', {
    label: 'ifelse',
    detail: 'if-else statement',
    type: 'snippet',
    boost: 85,
  }),
  snippetCompletion('for (int ${i} = 0; ${i} < ${length}; ${i}++)\n{\n\t${}\n}', {
    label: 'for',
    detail: 'for loop',
    type: 'snippet',
    boost: 90,
  }),
  snippetCompletion('foreach (var ${item} in ${collection})\n{\n\t${}\n}', {
    label: 'foreach',
    detail: 'foreach loop',
    type: 'snippet',
    boost: 85,
  }),
  snippetCompletion('while (${condition})\n{\n\t${}\n}', {
    label: 'while',
    detail: 'while loop',
    type: 'snippet',
    boost: 85,
  }),
  snippetCompletion('do\n{\n\t${}\n} while (${condition});', {
    label: 'dowhile',
    detail: 'do-while loop',
    type: 'snippet',
    boost: 70,
  }),
  snippetCompletion(
    'switch (${variable})\n{\n\tcase ${value}:\n\t\t${}\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}',
    {
      label: 'switch',
      detail: 'switch statement',
      type: 'snippet',
      boost: 80,
    },
  ),
  snippetCompletion(
    'try\n{\n\t${}\n}\ncatch (Exception ex)\n{\n\tConsole.WriteLine(ex.Message);\n}',
    {
      label: 'try',
      detail: 'try-catch block',
      type: 'snippet',
      boost: 70,
    },
  ),
  snippetCompletion(
    'try\n{\n\t${}\n}\ncatch (Exception ex)\n{\n\tConsole.WriteLine(ex.Message);\n}\nfinally\n{\n\t\n}',
    {
      label: 'trycf',
      detail: 'try-catch-finally block',
      type: 'snippet',
      boost: 65,
    },
  ),
  snippetCompletion('Console.WriteLine(${});', {
    label: 'cw',
    detail: 'Console.WriteLine',
    type: 'snippet',
    boost: 100,
  }),
  snippetCompletion('Console.ReadLine()', {
    label: 'cr',
    detail: 'Console.ReadLine',
    type: 'snippet',
    boost: 95,
  }),
  snippetCompletion('class ${Name}\n{\n\t${}\n}', {
    label: 'class',
    detail: 'class declaration',
    type: 'snippet',
    boost: 80,
  }),
  snippetCompletion('public ${Type} ${Name} { get; set; }', {
    label: 'prop',
    detail: 'auto-property',
    type: 'snippet',
    boost: 70,
  }),
  snippetCompletion(
    'private ${type} _${name};\npublic ${Type} ${Name}\n{\n\tget { return _${name}; }\n\tset { _${name} = value; }\n}',
    {
      label: 'propf',
      detail: 'full property with backing field',
      type: 'snippet',
      boost: 60,
    },
  ),
  snippetCompletion('public ${ClassName}(${parameters})\n{\n\t${}\n}', {
    label: 'ctor',
    detail: 'constructor',
    type: 'snippet',
    boost: 70,
  }),
  snippetCompletion('static void Main(string[] args)\n{\n\t${}\n}', {
    label: 'main',
    detail: 'Main method',
    type: 'snippet',
    boost: 90,
  }),
  snippetCompletion('static void Main(string[] args)\n{\n\t${}\n}', {
    label: 'svm',
    detail: 'static void Main',
    type: 'snippet',
    boost: 85,
  }),
];
