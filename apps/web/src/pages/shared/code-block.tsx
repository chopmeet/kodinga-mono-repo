import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import 'highlight.js/styles/github-dark.css';
import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '@kodinga/ui';

// Only the languages of the post form (and of the code blocks of the lessons): a small bundle
const LANGUAGES = { bash, css, dart, go, java, javascript, json, kotlin, php, python, rust, sql, swift, typescript, xml, yaml };
Object.entries(LANGUAGES).forEach(([name, language]) => hljs.registerLanguage(name, language));

/** Names written by the authors (post form, ``` fences) → languages of highlight.js */
const ALIASES: Record<string, keyof typeof LANGUAGES> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'xml',
  vue: 'xml',
  kt: 'kotlin',
  rs: 'rust',
  yml: 'yaml',
};

const LABELS: Partial<Record<keyof typeof LANGUAGES, string>> = {
  bash: 'Bash',
  css: 'CSS',
  dart: 'Dart',
  go: 'Go',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  php: 'PHP',
  python: 'Python',
  rust: 'Rust',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  xml: 'HTML',
  yaml: 'YAML',
};

/** Languages offered to the authors (post form, code exercises): what they write, what they read */
export const CODE_LANGUAGE_OPTIONS = ['typescript', 'javascript', 'python', 'java', 'kotlin', 'go', 'rust', 'php', 'dart', 'swift', 'sql', 'bash', 'html', 'css', 'autre'].map(
  (value) => ({ value, label: value === 'autre' ? 'Autre' : (LABELS[codeLanguage(value) ?? 'xml'] ?? value) }),
);

/** The language of highlight.js for a name, or null (plain text: "autre", unknown) */
export function codeLanguage(name: string | undefined | null): keyof typeof LANGUAGES | null {
  const key = (name ?? '').trim().toLowerCase();
  if (key in LANGUAGES) return key as keyof typeof LANGUAGES;
  return ALIASES[key] ?? null;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Props = {
  code: string;
  /** As written by the author: "typescript", "py", "autre"… */
  language?: string | null;
  className?: string;
};

/**
 * Code to read: colored by language (highlight.js, which escapes the code it gets), line numbers in
 * a column that stays while the code scrolls sideways, indentation and line breaks kept, copy.
 * Long lines scroll instead of wrapping, so the numbers stay in front of their line on mobile.
 */
export function CodeBlock({ code, language, className }: Props) {
  const lang = codeLanguage(language);
  const text = code.replace(/\n+$/, '');
  const html = useMemo(() => (lang ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value : escapeHtml(text)), [text, lang]);
  const lines = text.split('\n').length;
  const label = lang ? (LABELS[lang] ?? lang) : (language && language !== 'autre' ? language : 'Code');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The browser refused: the code stays selectable
    }
  };

  return (
    <figure className={cn('mt-4 overflow-hidden rounded-lg border border-slate-800 bg-[#0d1117] text-slate-100', className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-1.5 text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <button type="button" onClick={copy} aria-label={`Copier le code ${label}`} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-white/10 hover:text-white">
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </figcaption>
      <div className="flex overflow-x-auto font-mono text-[13px] leading-6 [tab-size:2] sm:text-sm">
        <pre aria-hidden className="sticky left-0 shrink-0 bg-[#0d1117] py-3 pr-3 pl-3 text-right text-slate-500 select-none">
          {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
        </pre>
        <pre className="py-3 pr-4">
          {/* Markup of highlight.js, built from the escaped code (never raw html of the author) */}
          <code className={cn('hljs bg-transparent! p-0!', lang && `language-${lang}`)} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </figure>
  );
}
