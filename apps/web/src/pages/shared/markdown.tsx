import { Fragment, type ReactNode } from 'react';

import { cn } from '@kodinga-mono-repo/ui';

/** Links kept: web pages and app paths (no javascript:, data:…) */
const safeHref = (href: string) => (/^(https?:\/\/|\/(?!\/)|#)/i.test(href) ? href : null);

/** **bold**, *italic*, `code`, [text](url) inside a line */
function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const k = `${key}-${i++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={k} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={k}>{token.slice(1, -1)}</em>);
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      const url = href ? safeHref(href) : null;
      nodes.push(
        url ? (
          <a key={k} href={url} target={url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="font-medium text-blue-900 underline underline-offset-2">
            {label}
          </a>
        ) : (
          label
        ),
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' };

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i += 1;
      blocks.push({ type: 'code', lang: fence[1], code: code.join('\n') });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2] });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,6}\s|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

/**
 * Markdown of the lessons (and posts) as React elements: no HTML is injected, so a content can
 * never run a script. Headings, paragraphs, lists, quotes, code blocks, bold, italic, code, links.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parse(source);
  return (
    <div className={cn('space-y-4 leading-relaxed text-slate-700', className)}>
      {blocks.map((b, n) => {
        const key = `b${n}`;
        switch (b.type) {
          case 'heading': {
            const Tag = (['h2', 'h3', 'h4'] as const)[b.level - 1];
            const size = ['text-2xl', 'text-xl', 'text-lg'][b.level - 1];
            return (
              <Tag key={key} className={cn('pt-2 font-semibold tracking-tight text-slate-900', size)}>
                {inline(b.text, key)}
              </Tag>
            );
          }
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={key} className={cn('space-y-1.5 pl-6', b.ordered ? 'list-decimal' : 'list-disc')}>
                {b.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>
                ))}
              </Tag>
            );
          }
          case 'code':
            return (
              <pre key={key} className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
                {b.lang && <span className="mb-2 block text-xs text-slate-400">{b.lang}</span>}
                <code>{b.code}</code>
              </pre>
            );
          case 'quote':
            return (
              <blockquote key={key} className="border-l-4 border-blue-200 pl-4 text-slate-600 italic">
                {inline(b.text, key)}
              </blockquote>
            );
          case 'rule':
            return <hr key={key} className="border-slate-200" />;
          default:
            return <p key={key}>{inline(b.text, key).map((node, j) => <Fragment key={j}>{node}</Fragment>)}</p>;
        }
      })}
    </div>
  );
}

/** Text of an HTML content, without running it (lessons written in HTML) */
export function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Their content is code or styling, not text of the lesson
  doc.querySelectorAll('script, style, noscript, template, iframe').forEach((el) => el.remove());
  doc.querySelectorAll('br, p, div, li, h1, h2, h3, h4').forEach((el) => el.append('\n'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
