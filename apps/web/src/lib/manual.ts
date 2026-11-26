import { ADMIN_MANUAL } from '@/content/admin-manual.generated';

/**
 * The Admin User Manual lives in docs/ADMIN-MANUAL.md (one source). This
 * renders the small Markdown subset it uses — headings, paragraphs, lists,
 * tables, images, bold, inline code and links — to HTML. Only trusted,
 * in-repository text is rendered.
 */
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text: string): string {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https:\/\/[^\s)<]+)/g, '$1<a href="$2">$2</a>');
}

export const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function renderManual(markdown: string, imageBase = ''): { html: string; toc: { id: string; title: string }[] } {
  const lines = markdown.split('\n');
  const out: string[] = [];
  const toc: { id: string; title: string }[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      closeList();
      const level = heading[1]!.length;
      const id = slug(heading[2]!);
      if (level === 2) toc.push({ id, title: heading[2]! });
      out.push(`<h${level} id="${id}">${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    if (trimmed === '---') {
      flush();
      closeList();
      out.push('<hr />');
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (image) {
      flush();
      closeList();
      out.push(`<figure><img src="${imageBase}${image[2]}" alt="${esc(image[1]!)}" loading="lazy" /><figcaption>${esc(image[1]!)}</figcaption></figure>`);
      continue;
    }
    if (trimmed.startsWith('|')) {
      flush();
      closeList();
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i]!.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^-+$/.test(cell))) rows.push(cells);
        i += 1;
      }
      i -= 1;
      const [head, ...body] = rows;
      out.push(`<table><thead><tr>${(head ?? []).map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if ((bullet || numbered) && !line.startsWith('   ')) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1]!)}</li>`);
      continue;
    }
    if (list && /^\s+/.test(line)) {
      // Continuation of the previous list item.
      const last = out.pop()!;
      out.push(last.replace(/<\/li>$/, ` ${inline(trimmed)}</li>`));
      continue;
    }
    closeList();
    para.push(trimmed);
  }
  flush();
  closeList();
  return { html: out.join('\n'), toc };
}

/** The manual text, embedded at build time by scripts/embed-manual.mjs. */
export function readManual(): string {
  return ADMIN_MANUAL;
}
