import type { ReactNode } from 'react';
import { parseMarkdownBlocks, type MarkdownBlock } from '../utils/markdown-blocks';

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const SAFE_URL = /^(https?:|mailto:)/i;
const HEADING_CLASS = ['text-xl', 'text-lg', 'text-base', 'text-base', 'text-sm', 'text-sm'];

/**
 * Model text as Markdown. Only React elements are created, never raw HTML,
 * and links are limited to http, https, and mailto.
 */
export function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-2 break-words ${className}`}>
      {parseMarkdownBlocks(text).map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: MarkdownBlock }) {
  if (block.kind === 'heading') {
    const size = HEADING_CLASS[block.level - 1] ?? 'text-base';
    return <p className={`${size} font-semibold`} role="heading" aria-level={block.level}>{inline(block.text)}</p>;
  }
  if (block.kind === 'code') {
    return <pre className="overflow-x-auto rounded-md bg-surface-control p-3 text-sm"><code>{block.text}</code></pre>;
  }
  if (block.kind === 'list') return <List ordered={block.ordered} items={block.items} />;
  return <p className="whitespace-pre-wrap">{inline(block.text)}</p>;
}

function List({ ordered, items }: { ordered: boolean; items: readonly string[] }) {
  const children = items.map((item, index) => <li key={index}>{inline(item)}</li>);
  if (ordered) return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

function inline(text: string): ReactNode[] {
  return text.split(INLINE).filter((part) => part.length > 0).map((part, index) => token(part, index));
}

function token(part: string, key: number): ReactNode {
  if (part.startsWith('`') && part.endsWith('`') && part.length > 1)
    return <code key={key} className="rounded-sm bg-surface-control px-1">{part.slice(1, -1)}</code>;
  if (isWrapped(part, '**') || isWrapped(part, '__')) return <strong key={key}>{part.slice(2, -2)}</strong>;
  if (isWrapped(part, '*') || isWrapped(part, '_')) return <em key={key}>{part.slice(1, -1)}</em>;
  const link = LINK.exec(part);
  if (link !== null) return linkNode(link[1] ?? '', link[2] ?? '', key);
  return part;
}

function linkNode(label: string, href: string, key: number): ReactNode {
  if (!SAFE_URL.test(href)) return label;
  return (
    <a key={key} className="text-link underline" href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function isWrapped(part: string, mark: string): boolean {
  return part.length > mark.length * 2 && part.startsWith(mark) && part.endsWith(mark);
}
