export type TextListKind = 'none' | 'bulleted' | 'numbered';

export interface TextListMarkerResult {
  content: string;
  lineStyles: TextListKind[];
  caret: number;
  kind: Exclude<TextListKind, 'none'>;
}

export interface TextListEnterResult {
  content: string;
  lineStyles: TextListKind[];
  caret: number;
  exited: boolean;
}

export function normalizeTextListLineStyles(
  content: string,
  lineStyles: readonly TextListKind[] | undefined,
  defaultKind: TextListKind = 'none',
): TextListKind[] {
  const count = content.split(/\r?\n/).length;
  return Array.from({ length: count }, (_, index) => lineStyles?.[index] ?? defaultKind);
}

export function reconcileTextListLineStyles(
  previousContent: string,
  nextContent: string,
  lineStyles: readonly TextListKind[],
): TextListKind[] {
  if (previousContent === nextContent) return normalizeTextListLineStyles(nextContent, lineStyles);

  let prefixLength = 0;
  while (
    prefixLength < previousContent.length
    && prefixLength < nextContent.length
    && previousContent[prefixLength] === nextContent[prefixLength]
  ) prefixLength++;

  let suffixLength = 0;
  while (
    suffixLength < previousContent.length - prefixLength
    && suffixLength < nextContent.length - prefixLength
    && previousContent[previousContent.length - suffixLength - 1]
      === nextContent[nextContent.length - suffixLength - 1]
  ) suffixLength++;

  const oldStartLine = previousContent.slice(0, prefixLength).split(/\r?\n/).length - 1;
  const newStartLine = nextContent.slice(0, prefixLength).split(/\r?\n/).length - 1;
  const oldEndLine = previousContent.slice(0, previousContent.length - suffixLength).split(/\r?\n/).length - 1;
  const newEndLine = nextContent.slice(0, nextContent.length - suffixLength).split(/\r?\n/).length - 1;
  const prefix = lineStyles.slice(0, oldStartLine);
  const inheritedKind = lineStyles[oldStartLine] ?? 'none';
  const oldSuffixStart = previousContent.length - suffixLength;
  const newSuffixStart = nextContent.length - suffixLength;
  const preservesSuffixRow = suffixLength > 0
    && (oldSuffixStart === 0 || previousContent[oldSuffixStart - 1] === '\n')
    && (newSuffixStart === 0 || nextContent[newSuffixStart - 1] === '\n');
  const middleCount = Math.max(0, newEndLine - newStartLine + (preservesSuffixRow ? 0 : 1));
  const suffix = lineStyles.slice(oldEndLine + (preservesSuffixRow ? 0 : 1));

  return normalizeTextListLineStyles(nextContent, [
    ...prefix,
    ...Array.from({ length: middleCount }, () => inheritedKind),
    ...suffix,
  ]);
}

export function formatTextListInput(
  content: string,
  lineStyles?: readonly TextListKind[],
  defaultKind: TextListKind = 'none',
) {
  const styles = normalizeTextListLineStyles(content, lineStyles, defaultKind);
  let number = 0;
  return content.split('\n').map((line, index) => {
    const kind = styles[index];
    number = kind === 'numbered' ? number + 1 : 0;
    return kind === 'numbered' ? `${number}. ${line}` : kind === 'bulleted' ? `• ${line}` : line;
  }).join('\n');
}

export function parseTextListInput(
  content: string,
  lineStyles?: readonly TextListKind[],
  caret = content.length,
) {
  const styles = normalizeTextListLineStyles(content, lineStyles);
  let offset = 0;
  let removedBeforeCaret = 0;
  const rows = content.split('\n').map((line, index) => {
    const marker = /^(•|-|\d+\.)(?:[ \t]+|$)/.exec(line);
    const removed = marker?.[0].length ?? 0;
    if (marker) styles[index] = /^\d/.test(marker[1]) ? 'numbered' : 'bulleted';
    removedBeforeCaret += Math.max(0, Math.min(removed, caret - offset));
    offset += line.length + 1;
    return line.slice(removed);
  });
  return { content: rows.join('\n'), lineStyles: styles, caret: caret - removedBeforeCaret };
}

export function completeTextListInputMarker(content: string, caret: number) {
  const start = caret === 0 ? 0 : content.lastIndexOf('\n', caret - 1) + 1;
  const prefix = content.slice(start, caret);
  if (!/^(?:-|\d+\.)$/.test(prefix)) return null;
  const marker = prefix === '-' ? '• ' : `${prefix} `;
  return { content: content.slice(0, start) + marker + content.slice(caret), caret: start + marker.length };
}

export function continueTextListInput(content: string, selectionStart: number, selectionEnd: number) {
  const start = selectionStart === 0 ? 0 : content.lastIndexOf('\n', selectionStart - 1) + 1;
  const nextBreak = content.indexOf('\n', selectionStart);
  const end = nextBreak === -1 ? content.length : nextBreak;
  const line = content.slice(start, end);
  const marker = /^(•|-|(\d+)\.)(?:[ \t]+|$)/.exec(line);
  if (!marker || selectionStart < start + marker[0].length) return null;
  if (!line.slice(marker[0].length).trim() && selectionStart === selectionEnd) {
    return { content: content.slice(0, start) + content.slice(end), caret: start };
  }
  const nextMarker = marker[2] ? `${Number(marker[2]) + 1}. ` : '• ';
  const insertion = `\n${nextMarker}`;
  return {
    content: content.slice(0, selectionStart) + insertion + content.slice(selectionEnd),
    caret: selectionStart + insertion.length,
  };
}

export function detectTextListMarker(
  content: string,
  caret: number,
  lineStyles: readonly TextListKind[],
): TextListMarkerResult | null {
  const parsed = parseTextListInput(content, lineStyles, caret);
  if (parsed.content !== content) {
    const rows = parsed.content.split('\n');
    const changedLine = content.split('\n').findIndex((line, index) => line !== rows[index]);
    return { ...parsed, kind: parsed.lineStyles[changedLine] as Exclude<TextListKind, 'none'> };
  }
  const lineStart = caret === 0 ? 0 : content.lastIndexOf('\n', caret - 1) + 1;
  const lineEnd = content.indexOf('\n', caret);
  const end = lineEnd === -1 ? content.length : lineEnd;
  const line = content.slice(lineStart, end);

  const lineIndex = content.slice(0, lineStart).split(/\r?\n/).length - 1;
  const currentKind = lineStyles[lineIndex] ?? 'none';
  const prefix = content.slice(lineStart, caret);
  const match = /^(?:- ?|(\d+)\. ?)$/.exec(prefix);
  // A space typed after immediate conversion is a separator, not item content.
  const isSeparator = line === ' ' && caret === end && currentKind !== 'none';
  if (!match && !isSeparator) return null;

  const kind = match ? (match[1] ? 'numbered' : 'bulleted') : currentKind;
  if (kind === 'none') return null;
  const normalized = `${content.slice(0, lineStart)}${content.slice(caret)}`;
  const normalizedStyles = normalizeTextListLineStyles(normalized, lineStyles);
  normalizedStyles[lineIndex] = kind;

  return {
    content: normalized,
    lineStyles: normalizedStyles,
    caret: lineStart,
    kind,
  };
}

export function applyTextListEnter(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  lineStyles: readonly TextListKind[],
): TextListEnterResult | null {
  const lines = content.split(/\r?\n/);
  const startLine = content.slice(0, selectionStart).split(/\r?\n/).length - 1;
  const endLine = content.slice(0, selectionEnd).split(/\r?\n/).length - 1;
  const kind = lineStyles[startLine] ?? 'none';
  if (kind === 'none') return null;

  const lineStart = selectionStart === 0 ? 0 : content.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEnd = content.indexOf('\n', selectionStart);
  const end = lineEnd === -1 ? content.length : lineEnd;
  const currentLine = content.slice(lineStart, end);

  if (currentLine.trim().length === 0 && selectionStart === selectionEnd) {
    const nextStyles = normalizeTextListLineStyles(content, lineStyles);
    nextStyles[startLine] = 'none';
    return { content, lineStyles: nextStyles, caret: selectionStart, exited: true };
  }

  const nextContent = `${content.slice(0, selectionStart)}\n${content.slice(selectionEnd)}`;
  const nextLineCount = nextContent.split(/\r?\n/).length;
  const prefix = lines.slice(0, startLine).map((_, index) => lineStyles[index] ?? 'none');
  const suffix = lines.slice(endLine + 1).map((_, index) => lineStyles[endLine + 1 + index] ?? 'none');
  const middleCount = Math.max(0, nextLineCount - prefix.length - suffix.length);
  const nextStyles = [
    ...prefix,
    ...Array.from({ length: middleCount }, () => kind),
    ...suffix,
  ];

  return {
    content: nextContent,
    lineStyles: normalizeTextListLineStyles(nextContent, nextStyles),
    caret: selectionStart + 1,
    exited: false,
  };
}
