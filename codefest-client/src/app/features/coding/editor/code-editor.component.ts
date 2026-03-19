import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule],
  template: `<div #editorContainer class="editor-container"></div>`,
  styles: [
    `
      .editor-container {
        height: 100%;
        width: 100%;
        overflow: hidden;
      }

      :host {
        display: block;
        height: 100%;
      }

      :host ::ng-deep .cm-editor {
        height: 100%;
        font-size: 14px;
      }

      :host ::ng-deep .cm-scroller {
        overflow: auto;
      }
    `,
  ],
})
export class CodeEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef;
  @Input() initialCode = '';
  @Input() readOnly = false;
  @Output() codeChange = new EventEmitter<string>();

  private view!: EditorView;

  ngAfterViewInit(): void {
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        this.codeChange.emit(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: this.initialCode,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        javascript(), // Covers C# syntax basics
        oneDark,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
        ]),
        updateListener,
        EditorState.readOnly.of(this.readOnly),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    this.view = new EditorView({
      state,
      parent: this.editorContainer.nativeElement,
    });
  }

  setCode(code: string): void {
    if (this.view) {
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: code,
        },
      });
    }
  }

  getCode(): string {
    return this.view?.state.doc.toString() ?? '';
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }
}
