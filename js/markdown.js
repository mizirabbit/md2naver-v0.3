export function configureMarked() {
  // 호환용 no-op. V0.1은 외부 Markdown 라이브러리 없이 동작합니다.
}

export function detectInputType(source) {
  const text = String(source || '').trim();
  if (!text) return { type: 'empty', label: '빈 입력' };

  const markdownSignals = [
    /^#{1,6}\s+\S/m,
    /^\s*```[\w-]*\s*$/m,
    /^\s*>\s+\S/m,
    /^\s*[-+*]\s+\S/m,
    /^\s*\d+[.)]\s+\S/m,
    /\*\*[^*\n]+\*\*/,
    /~~[^~\n]+~~/,
    /!?\[[^\]]+\]\([^)]+\)/,
    /^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m,
    /^\s*(?:---+|___+|\*\*\*+)\s*$/m
  ];
  const matches = markdownSignals.reduce((count, pattern) => count + Number(pattern.test(text)), 0);
  return matches > 0
    ? { type: 'markdown', label: 'Markdown 감지' }
    : { type: 'plain', label: '일반 텍스트' };
}

export function normalizeAiMarkdown(source) {
  let out = String(source || '').replace(/\r\n?/g, '\n');

  out = out.replace(/^>\s*\*\*(NOTE|TIP|WARNING|WARN|ERROR|IMPORTANT|참고|주의|팁)\*\*\s*:?\s*$/gim,
    (_, label) => `> [!${normalizeCalloutLabel(label)}]`);

  out = out.replace(/\n{4,}/g, '\n\n\n');
  return out.trim();
}

export function parseMarkdown(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i += 1; continue; }

    const fence = line.match(/^\s*```\s*([^\s`]*)\s*$/);
    if (fence) {
      const lang = (fence[1] || '').toLowerCase();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const raw = code.join('\n');
      if (lang === 'mermaid') {
        html.push(`<div class="mermaid-wrap" data-mermaid-source="${escapeAttr(raw)}"><pre class="mermaid-source">${escapeHtml(raw)}</pre></div>`);
      } else {
        html.push(`<pre><span class="code-lang">${escapeHtml(lang || 'code')}</span><code class="code-highlight language-${escapeAttr(lang || 'text')}">${highlightCode(raw, lang)}</code></pre>`);
      }
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const depth = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(stripMarkdown(text));
      html.push(`<h${depth} id="${escapeAttr(id)}">${renderInline(text)}</h${depth}>`);
      i += 1;
      continue;
    }

    if (/^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line.trim())) {
      html.push('<hr>');
      i += 1;
      continue;
    }

    const standaloneImage = line.trim().match(/^!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)$/);
    if (standaloneImage) {
      const [, alt, src, title = ''] = standaloneImage;
      html.push(`<figure class="md-image" data-md-src="${escapeAttr(src)}" data-md-title="${escapeAttr(title)}"><div class="image-marker"><b>IMAGE_PLACEHOLDER</b><span>${escapeHtml(alt || 'image')}</span><small>${escapeHtml(src)}</small></div></figure>`);
      i += 1;
      continue;
    }

    if (looksLikeTableHeader(lines, i)) {
      const parsed = parseTable(lines, i);
      html.push(parsed.html);
      i = parsed.next;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote>${parseMarkdown(quoteLines.join('\n'))}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-+*]\s+(.+)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (ul || ol) {
      const ordered = Boolean(ol);
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length) {
        const m = ordered ? lines[i].match(/^\s*\d+[.)]\s+(.+)/) : lines[i].match(/^\s*[-+*]\s+(.+)/);
        if (!m) break;
        items.push(`<li>${renderInline(m[1])}</li>`);
        i += 1;
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const para = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
      para.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${renderInline(para.join('\n')).replaceAll('\n', '<br>')}</p>`);
  }

  return html.join('\n');
}

function startsBlock(lines, i) {
  const line = lines[i] || '';
  if (/^\s*```/.test(line)) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^\s*>/.test(line)) return true;
  if (/^\s*[-+*]\s+/.test(line)) return true;
  if (/^\s*\d+[.)]\s+/.test(line)) return true;
  if (/^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line.trim())) return true;
  if (/^!\[[^\]]*\]\(/.test(line.trim())) return true;
  return looksLikeTableHeader(lines, i);
}

function looksLikeTableHeader(lines, i) {
  if (i + 1 >= lines.length) return false;
  if (!lines[i].includes('|')) return false;
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1]);
}

function parseTable(lines, start) {
  const headers = splitTableRow(lines[start]);
  const aligns = splitTableRow(lines[start + 1]).map(cell => {
    const t = cell.trim();
    if (/^:-+:$/.test(t)) return 'center';
    if (/^-+:$/.test(t)) return 'right';
    return 'left';
  });
  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    rows.push(splitTableRow(lines[i]));
    i += 1;
  }
  const head = headers.map((cell, idx) => `<th style="text-align:${aligns[idx] || 'left'}">${renderInline(cell.trim())}</th>`).join('');
  const body = rows.map(row => `<tr>${headers.map((_, idx) => `<td style="text-align:${aligns[idx] || 'left'}">${renderInline((row[idx] || '').trim())}</td>`).join('')}</tr>`).join('');
  return { html: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`, next: i };
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  const out = [];
  let buf = '';
  let escaped = false;
  for (const ch of value) {
    if (escaped) { buf += ch; escaped = false; continue; }
    if (ch === '\\') { escaped = true; buf += ch; continue; }
    if (ch === '|') { out.push(buf.replaceAll('\\|', '|')); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf.replaceAll('\\|', '|'));
  return out;
}

function renderInline(input) {
  let text = String(input || '');
  const tokens = [];
  const hold = html => {
    const key = `\u0000TOK${tokens.length}\u0000`;
    tokens.push(html);
    return key;
  };

  text = text.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g, (_, alt, src, title = '') =>
    hold(`<span class="md-inline-image" data-md-src="${escapeAttr(src)}" data-md-title="${escapeAttr(title)}">[IMAGE: ${escapeHtml(alt || src)}]</span>`));
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, label, href) =>
    hold(`<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`));

  text = escapeHtml(text);
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');

  tokens.forEach((html, idx) => {
    const key = `\u0000TOK${idx}\u0000`;
    text = text.replaceAll(key, html);
  });
  return text;
}

function highlightCode(code, lang) {
  const value = String(code || '');
  if (!value) return '';
  if (/^(html?|xml|svg)$/.test(lang)) return highlightXml(value);

  const keywordSets = {
    bash: 'if then else elif fi for while do done case esac function in export local readonly return'.split(' '),
    sh: 'if then else elif fi for while do done case esac function in export local readonly return'.split(' '),
    java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while record var'.split(' '),
    c: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while'.split(' '),
    cpp: 'alignas alignof and asm auto bool break case catch char class const constexpr continue default delete do double else enum explicit export extern false float for friend goto if inline int long namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while'.split(' '),
    javascript: 'async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield'.split(' '),
    js: 'async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield'.split(' '),
    typescript: 'abstract any as async await boolean break case catch class const constructor continue declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface keyof let namespace never new null number object of private protected public readonly return set static string super switch symbol this throw true try type typeof undefined unknown var void while with yield'.split(' '),
    ts: 'abstract any as async await boolean break case catch class const constructor continue declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface keyof let namespace never new null number object of private protected public readonly return set static string super switch symbol this throw true try type typeof undefined unknown var void while with yield'.split(' '),
    python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '),
    py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '),
    json: 'true false null'.split(' ')
  };
  const keywords = new Set(keywordSets[lang] || [...keywordSets.javascript, ...keywordSets.java, ...keywordSets.c]);
  const tokenRe = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
  let out = '';
  let last = 0;
  for (const match of value.matchAll(tokenRe)) {
    const token = match[0];
    const idx = match.index ?? 0;
    out += escapeHtml(value.slice(last, idx));
    let cls = '';
    if (/^(\/\/|\/\*|#)/.test(token)) cls = 'tok-comment';
    else if (/^["'`]/.test(token)) cls = 'tok-string';
    else if (/^\d/.test(token)) cls = 'tok-number';
    else if (keywords.has(token)) cls = 'tok-keyword';
    out += cls ? `<span class="${cls}">${escapeHtml(token)}</span>` : escapeHtml(token);
    last = idx + token.length;
  }
  out += escapeHtml(value.slice(last));
  return out;
}

function highlightXml(code) {
  let out = '';
  let last = 0;
  const re = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;
  for (const match of code.matchAll(re)) {
    const idx = match.index ?? 0;
    out += escapeHtml(code.slice(last, idx));
    const token = match[0];
    const cls = token.startsWith('<!--') ? 'tok-comment' : 'tok-keyword';
    out += `<span class="${cls}">${escapeHtml(token)}</span>`;
    last = idx + token.length;
  }
  return out + escapeHtml(code.slice(last));
}

function normalizeCalloutLabel(label) {
  const value = label.toUpperCase();
  if (value === 'WARN' || value === '주의') return 'WARNING';
  if (value === '참고') return 'NOTE';
  if (value === '팁') return 'TIP';
  return value;
}

function stripMarkdown(value) {
  return String(value || '').replace(/[*_~`\[\]()]/g, '').trim();
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-') || `section-${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttr(value = '') {
  return escapeHtml(value).replaceAll('`', '&#096;').replaceAll('\n', '&#10;');
}
