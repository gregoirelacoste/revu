// ── Syntax highlighting: regex-based tokenizer + Darcula theme ──

import type { SyntaxConfig } from '../core/types.js';

export type TokenType =
  | 'keyword' | 'string' | 'comment' | 'number' | 'type'
  | 'decorator' | 'function' | 'operator' | 'property' | 'text';

export interface SyntaxToken { text: string; type: TokenType; }
export type SyntaxTheme = Record<string, string>;

export const DARCULA_THEME: SyntaxTheme = {
  keyword:   '#CC7832',
  string:    '#6A8759',
  comment:   '#808080',
  number:    '#6897BB',
  type:      '#A9B7C6',
  decorator: '#BBB529',
  function:  '#FFC66D',
  operator:  '#CC7832',
  property:  '#9876AA',
  text:      '',
};

const KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class',
  'const', 'continue', 'debugger', 'declare', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from',
  'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof',
  'interface', 'let', 'new', 'null', 'of', 'private', 'protected', 'public',
  'readonly', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void', 'while',
  'yield',
]);

// Single combined regex with named groups. Order matters: earlier groups win.
const TOKEN_RE = new RegExp([
  '(?<comment>\\/\\/.*$)',                          // line comment
  '(?<blockComment>\\/\\*[\\s\\S]*?\\*\\/)',        // block comment (single line)
  '(?<template>`(?:[^`\\\\]|\\\\.)*`)',             // template string
  '(?<dstring>"(?:[^"\\\\]|\\\\.)*")',              // double-quoted string
  '(?<sstring>\'(?:[^\'\\\\]|\\\\.)*\')',           // single-quoted string
  '(?<decorator>@[A-Za-z_]\\w*)',                   // decorator
  '(?<number>\\b0[xX][\\da-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?\\b)', // number
  '(?<word>[A-Za-z_$][\\w$]*)',                     // word (keyword, fn, type)
  '(?<operator>=>|===|!==|==|!=|&&|\\|\\||\\?\\?|\\.\\.\\.)', // multi-char ops
  '(?<punct>[{}()\\[\\];,.:?!<>=+\\-*/%&|^~])',    // single-char punct
  '(?<space>\\s+)',                                 // whitespace
].join('|'), 'g');

export function tokenizeLine(line: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(line)) !== null) {
    // Gap before match → text
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: 'text' });
    }
    const m = match[0];
    const g = match.groups!;

    if (g.comment || g.blockComment) {
      tokens.push({ text: m, type: 'comment' });
    } else if (g.template || g.dstring || g.sstring) {
      tokens.push({ text: m, type: 'string' });
    } else if (g.decorator) {
      tokens.push({ text: m, type: 'decorator' });
    } else if (g.number) {
      tokens.push({ text: m, type: 'number' });
    } else if (g.word) {
      tokens.push({ text: m, type: classifyWord(m, line, match.index + m.length) });
    } else if (g.operator) {
      tokens.push({ text: m, type: 'operator' });
    } else if (g.space) {
      tokens.push({ text: m, type: 'text' });
    } else {
      tokens.push({ text: m, type: 'text' });
    }
    lastIndex = match.index + m.length;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: 'text' });
  }
  return tokens;
}

function classifyWord(word: string, line: string, afterEnd: number): TokenType {
  if (KEYWORDS.has(word)) return 'keyword';
  // Function call: word followed by (
  if (afterEnd < line.length && line[afterEnd] === '(') return 'function';
  // Property access: preceded by .
  const before = line.slice(Math.max(0, afterEnd - word.length - 1), afterEnd - word.length);
  if (before.endsWith('.')) return 'property';
  // Capitalized word (type-like)
  if (word[0] >= 'A' && word[0] <= 'Z') return 'type';
  return 'text';
}

export function loadSyntaxTheme(config?: SyntaxConfig): SyntaxTheme | null {
  if (config && config.enabled === false) return null;
  const base = { ...DARCULA_THEME };
  if (config?.rules) Object.assign(base, config.rules);
  return base;
}
