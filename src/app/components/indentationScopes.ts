import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

function buildScopeDecorations(view: EditorView): DecorationSet {
  const bracesByLine = new Map<number, { position: number; opens: boolean; showsGuide: boolean }[]>();
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== "{" && node.name !== "}") return;
      const line = view.state.doc.lineAt(node.from);
      const braces = bracesByLine.get(line.number) ?? [];
      braces.push({
        position: node.from - line.from,
        opens: node.name === "{",
        showsGuide: !/^\s*(class|struct)\b/.test(line.text),
      });
      bracesByLine.set(line.number, braces);
    },
  });

  const activeScopes: { baseIndent: number; guideColumn: number | null; showsGuide: boolean }[] = [];
  const decorations = [];
  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
    const line = view.state.doc.line(lineNumber);
    const lineBraces = (bracesByLine.get(lineNumber) ?? []).sort((left, right) => left.position - right.position);
    const leadingWhitespace = /^[ \t]*/.exec(line.text)?.[0] ?? "";
    const indentationColumns = [...leadingWhitespace].reduce((columns, char) => columns + (char === "\t" ? 4 : 1), 0);
    const leadingClosures = lineBraces.filter((brace) => !brace.opens && brace.position <= indentationColumns);
    for (let index = 0; index < leadingClosures.length && activeScopes.length > 0; index++) {
      activeScopes.pop();
    }
    if (leadingClosures.length === 0 && line.text.trim()) {
      for (const scope of activeScopes) {
        if (scope.showsGuide && scope.guideColumn === null && indentationColumns > scope.baseIndent) {
          scope.guideColumn = scope.baseIndent;
        }
      }
    }
    const guides = activeScopes.flatMap((scope) => scope.guideColumn === null ? [] : [scope.guideColumn]);

    if (guides.length > 0) {
      const layers = guides.map((column) =>
        `linear-gradient(to right, transparent calc(${column}ch + 4.5px), rgba(255,255,255,0.16) calc(${column}ch + 4.5px), rgba(255,255,255,0.16) calc(${column}ch + 5.5px), transparent calc(${column}ch + 5.5px))`,
      );
      decorations.push(Decoration.line({
        attributes: { style: `background-image:${layers.join(",")};background-repeat:no-repeat` },
      }).range(line.from));
    }

    for (const brace of lineBraces) {
      if (brace.opens) {
        activeScopes.push({
          baseIndent: indentationColumns,
          guideColumn: null,
          showsGuide: brace.showsGuide,
        });
      }
      else if (brace.position > indentationColumns && activeScopes.length > 0) activeScopes.pop();
    }
  }
  return Decoration.set(decorations, true);
}

export const indentationScopes = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildScopeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildScopeDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
