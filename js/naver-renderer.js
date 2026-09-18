import { parseMarkdown, normalizeAiMarkdown } from './markdown.js';

const CALLOUT_MAP = {
  NOTE: { cls: 'note', icon: '💡', title: '참고' },
  TIP: { cls: 'tip', icon: '✅', title: '팁' },
  WARNING: { cls: 'warning', icon: '⚠️', title: '주의' },
  IMPORTANT: { cls: 'warning', icon: '⚠️', title: '중요' },
  ERROR: { cls: 'error', icon: '❌', title: '오류' }
};

export function buildPreview(source, options = {}) {
  const normalized = normalizeAiMarkdown(source);
  const html = parseMarkdown(normalized);
  const host = document.createElement('div');
  host.innerHTML = html;

  transformCallouts(host);
  transformImages(host);

  if (options.numberHeadings) numberH2(host);
  if (options.toc) injectToc(host);

  return {
    normalized,
    html: host.innerHTML,
    stats: collectStats(host),
    imageRefs: collectImageRefs(host),
    mermaidBlocks: [...host.querySelectorAll('.mermaid-wrap')].map((el, index) => ({ index: index + 1, source: el.dataset.mermaidSource || '' }))
  };
}

function transformCallouts(host) {
  host.querySelectorAll('blockquote').forEach(block => {
    const first = block.firstElementChild;
    if (!first) return;
    const text = first.textContent.trim();
    const match = text.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|ERROR)\]\s*(.*)$/i);
    if (!match) return;

    const type = match[1].toUpperCase();
    const cfg = CALLOUT_MAP[type];
    first.textContent = match[2] || '';
    if (!first.textContent.trim()) first.remove();

    const box = document.createElement('div');
    box.className = `callout callout-${cfg.cls}`;
    box.innerHTML = `<div class="callout-title">${cfg.icon} ${cfg.title}</div>${block.innerHTML}`;
    block.replaceWith(box);
  });
}

function transformImages(host) {
  const all = [...host.querySelectorAll('figure.md-image, .md-inline-image')];
  all.forEach((node, index) => {
    const path = node.dataset.mdSrc || '';
    const alt = node.matches('figure')
      ? node.querySelector('.image-marker span')?.textContent || 'image'
      : node.textContent.replace(/^\[IMAGE:\s*|\]$/g, '') || 'image';

    if (!node.matches('figure')) {
      const figure = document.createElement('figure');
      figure.className = 'md-image';
      figure.dataset.mdSrc = path;
      figure.dataset.mdTitle = node.dataset.mdTitle || '';
      figure.innerHTML = `<div class="image-marker"><b>IMAGE_PLACEHOLDER</b><span>${escapeHtml(alt)}</span><small>${escapeHtml(path)}</small></div>`;
      node.replaceWith(figure);
      node = figure;
    }

    node.dataset.imageIndex = String(index + 1);
    const marker = node.querySelector('.image-marker');
    if (marker) marker.innerHTML = `<b>IMAGE ${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(alt)}</span><small>${escapeHtml(path)}</small>`;
  });
}

function numberH2(host) {
  let n = 0;
  host.querySelectorAll('h2').forEach(h => {
    if (h.closest('.toc-box')) return;
    n += 1;
    const text = h.textContent.replace(/^\d+\.\s*/, '');
    h.textContent = `${n}. ${text}`;
  });
}

function injectToc(host) {
  const headings = [...host.querySelectorAll('h2, h3')].filter(h => h.textContent.trim());
  if (headings.length < 2) return;
  const box = document.createElement('div');
  box.className = 'toc-box';
  const items = headings.map(h => {
    const indent = h.tagName === 'H3' ? ' style="margin-left:18px"' : '';
    return `<li${indent}><a href="#${escapeAttr(h.id)}">${escapeHtml(h.textContent)}</a></li>`;
  }).join('');
  box.innerHTML = `<strong>목차</strong><ol>${items}</ol>`;
  host.prepend(box);
}

function collectStats(host) {
  return {
    paragraphs: host.querySelectorAll('p').length,
    codeBlocks: host.querySelectorAll('pre:not(.mermaid-source)').length,
    images: host.querySelectorAll('figure.md-image').length,
    tables: host.querySelectorAll('table').length,
    headings: host.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
    links: host.querySelectorAll('a').length,
    mermaid: host.querySelectorAll('.mermaid-wrap').length
  };
}

function collectImageRefs(host) {
  return [...host.querySelectorAll('figure.md-image')].map((el, i) => ({
    index: i + 1,
    src: el.dataset.mdSrc || '',
    title: el.dataset.mdTitle || '',
    alt: el.querySelector('.image-marker span')?.textContent || 'image'
  }));
}

export function renderMermaidIn(container) {
  const results = [];
  const wraps = [...container.querySelectorAll('.mermaid-wrap')];
  wraps.forEach((wrap, i) => {
    const source = wrap.dataset.mermaidSource || '';
    const rendered = renderSimpleFlowchart(source);
    if (rendered.ok) {
      wrap.innerHTML = rendered.svg;
      wrap.dataset.rendered = '1';
      wrap.dataset.diagramIndex = String(i + 1);
      results.push({ index: i + 1, source, svg: rendered.svg, ok: true });
    } else {
      wrap.innerHTML = `<div class="callout callout-warning"><div class="callout-title">⚠ Mermaid 원문 유지</div><p>${escapeHtml(rendered.reason)}</p><pre>${escapeHtml(source)}</pre></div>`;
      wrap.dataset.rendered = '0';
      results.push({ index: i + 1, source, svg: '', ok: false, reason: rendered.reason });
    }
  });
  return results;
}

function renderSimpleFlowchart(source) {
  const lines = String(source || '').split('\n').map(v => v.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, reason: '빈 Mermaid 블록입니다.' };
  const first = lines.shift();
  const head = first.match(/^(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)$/i);
  if (!head) return { ok: false, reason: '현재 V0.1은 graph/flowchart LR, RL, TD, TB, BT 형식을 지원합니다.' };
  const dir = head[1].toUpperCase();

  const nodes = new Map();
  const edges = [];
  const addNode = (id, label = '') => {
    if (!nodes.has(id)) nodes.set(id, { id, label: label || id });
    else if (label) nodes.get(id).label = label;
  };

  const nodePat = String.raw`([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?`;
  const edgeRe = new RegExp(`^${nodePat}\\s*(-->|---|-.->|==>)\\s*${nodePat}(?:\\s*\\|([^|]+)\\|)?$`);
  const nodeOnlyRe = new RegExp(`^${nodePat}$`);

  for (const line of lines) {
    const clean = line.replace(/;$/, '').trim();
    const e = clean.match(edgeRe);
    if (e) {
      const fromId = e[1], fromLabel = e[2] || e[3] || e[4] || '';
      const arrow = e[5];
      const toId = e[6], toLabel = e[7] || e[8] || e[9] || '';
      const label = e[10] || '';
      addNode(fromId, fromLabel);
      addNode(toId, toLabel);
      edges.push({ from: fromId, to: toId, arrow, label });
      continue;
    }
    const n = clean.match(nodeOnlyRe);
    if (n) addNode(n[1], n[2] || n[3] || n[4] || '');
  }

  if (!nodes.size || !edges.length) return { ok: false, reason: '지원 가능한 노드/화살표를 찾지 못했습니다.' };

  const rank = new Map([...nodes.keys()].map(k => [k, 0]));
  for (let pass = 0; pass < nodes.size; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      const candidate = Math.min(nodes.size, (rank.get(edge.from) || 0) + 1);
      if (candidate > (rank.get(edge.to) || 0)) {
        rank.set(edge.to, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const levels = new Map();
  for (const node of nodes.values()) {
    const r = rank.get(node.id) || 0;
    if (!levels.has(r)) levels.set(r, []);
    levels.get(r).push(node);
  }

  const nodeW = 168, nodeH = 58, gapX = 72, gapY = 52, pad = 38;
  const pos = new Map();
  const horizontal = dir === 'LR' || dir === 'RL';
  const ranks = [...levels.keys()].sort((a, b) => a - b);

  for (const r of ranks) {
    const list = levels.get(r);
    list.forEach((node, idx) => {
      let x = horizontal ? pad + r * (nodeW + gapX) : pad + idx * (nodeW + gapX);
      let y = horizontal ? pad + idx * (nodeH + gapY) : pad + r * (nodeH + gapY);
      pos.set(node.id, { x, y });
    });
  }

  if (dir === 'RL') {
    const maxX = Math.max(...[...pos.values()].map(p => p.x));
    for (const p of pos.values()) p.x = maxX - p.x + pad;
  }
  if (dir === 'BT') {
    const maxY = Math.max(...[...pos.values()].map(p => p.y));
    for (const p of pos.values()) p.y = maxY - p.y + pad;
  }

  const width = Math.max(...[...pos.values()].map(p => p.x + nodeW)) + pad;
  const height = Math.max(...[...pos.values()].map(p => p.y + nodeH)) + pad;
  const markerId = `arrow-${Math.random().toString(36).slice(2, 8)}`;
  const edgeSvg = edges.map(edge => {
    const a = pos.get(edge.from), b = pos.get(edge.to);
    if (!a || !b) return '';
    let x1, y1, x2, y2;
    if (horizontal) {
      const forward = b.x >= a.x;
      x1 = forward ? a.x + nodeW : a.x;
      y1 = a.y + nodeH / 2;
      x2 = forward ? b.x : b.x + nodeW;
      y2 = b.y + nodeH / 2;
    } else {
      const forward = b.y >= a.y;
      x1 = a.x + nodeW / 2;
      y1 = forward ? a.y + nodeH : a.y;
      x2 = b.x + nodeW / 2;
      y2 = forward ? b.y : b.y + nodeH;
    }
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return `<g><path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="#64748b" stroke-width="2" marker-end="url(#${markerId})"/>${edge.label ? `<text x="${mx}" y="${my - 7}" text-anchor="middle" font-size="12" fill="#475569">${escapeHtml(edge.label)}</text>` : ''}</g>`;
  }).join('');

  const nodeSvg = [...nodes.values()].map(node => {
    const p = pos.get(node.id);
    return `<g><rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/><text x="${p.x + nodeW / 2}" y="${p.y + nodeH / 2 + 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#1e293b">${escapeHtml(node.label)}</text></g>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Mermaid flowchart"><defs><marker id="${markerId}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#64748b"/></marker></defs>${edgeSvg}${nodeSvg}</svg>`;
  return { ok: true, svg };
}

export async function copySvgAsPng(svgMarkup, scale = 2) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('이미지 Clipboard API를 사용할 수 없습니다.');
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve, reject) => canvas.toBlob(v => v ? resolve(v) : reject(new Error('PNG 생성 실패')), 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG 렌더링 실패'));
    img.src = url;
  });
}

export function getClipboardHtml(previewEl, preset = 'tech') {
  const clone = previewEl.cloneNode(true);

  // 코드 블록 언어 표시(CPP, TEXT, BASH 등)는
  // Preview 전용이므로 Naver 복사 시 제거
  clone.querySelectorAll('.code-lang').forEach(el => el.remove());

  clone.querySelectorAll('.toc-box a').forEach(a => {
    const span = document.createElement('span');
    span.textContent = a.textContent;
    a.replaceWith(span);
  });

  clone.querySelectorAll('figure.md-image').forEach(figure => {
    const marker = figure.querySelector('.image-marker');
    const p = document.createElement('p');
    p.style.cssText =
      'margin:20px 0;padding:14px;text-align:center;' +
      'border:1px dashed #aeb8c5;background:#fafbfc;color:#596575;';
    p.textContent =
      marker?.innerText.replace(/\s+/g, ' ').trim() || '[IMAGE]';
    figure.replaceWith(p);
  });

  clone.querySelectorAll('.mermaid-wrap').forEach((wrap, index) => {
    const p = document.createElement('p');
    p.style.cssText =
      'margin:20px 0;padding:14px;text-align:center;' +
      'border:1px dashed #aeb8c5;background:#fafbfc;color:#596575;';
    p.textContent =
      `[DIAGRAM ${String(index + 1).padStart(2, '0')}] ` +
      'Mermaid PNG를 이미지 Queue에서 복사해 붙여넣으세요.';
    wrap.replaceWith(p);
  });

  inlineStylesForClipboard(clone, preset);
  return clone.innerHTML;
}

function inlineStylesForClipboard(root, preset = 'tech') {
  const presets = {
    tech: { h1: 'font-size:32px;font-weight:800;line-height:1.35;margin:0 0 30px;color:#1d2530;', h2: 'font-size:25px;font-weight:800;line-height:1.4;margin:38px 0 16px;padding-bottom:8px;border-bottom:2px solid #1e2935;color:#1d2530;', h3: 'font-size:20px;font-weight:800;line-height:1.45;margin:26px 0 10px;color:#1d2530;' },
    clean: { h1: 'font-size:34px;font-weight:700;line-height:1.45;margin:0 0 34px;color:#20242a;', h2: 'font-size:25px;font-weight:700;line-height:1.55;margin:40px 0 15px;color:#20242a;', h3: 'font-size:20px;font-weight:700;line-height:1.6;margin:28px 0 10px;color:#20242a;' },
    basic: { h1: 'font-size:30px;font-weight:800;line-height:1.4;margin:0 0 28px;color:#1d2530;', h2: 'font-size:24px;font-weight:800;line-height:1.45;margin:34px 0 14px;color:#1d2530;', h3: 'font-size:20px;font-weight:800;line-height:1.5;margin:24px 0 10px;color:#1d2530;' },
    review: { h1: 'font-size:34px;font-weight:800;line-height:1.4;margin:0 0 34px;text-align:center;color:#1d2530;', h2: 'font-size:24px;font-weight:800;line-height:1.45;margin:36px 0 15px;padding:10px 14px;border-left:6px solid #222;background:#f7f7f8;color:#1d2530;', h3: 'font-size:20px;font-weight:800;line-height:1.5;margin:26px 0 10px;color:#1d2530;' }
  };
  const ps = presets[preset] || presets.tech;
  const css = {
    H1: ps.h1,
    H2: ps.h2,
    H3: ps.h3,
    H4: 'font-size:17px;font-weight:800;line-height:1.5;margin:22px 0 8px;color:#1d2530;',
    P: 'font-size:16px;line-height:1.85;margin:12px 0;color:#252b33;',
    UL: 'font-size:16px;line-height:1.8;margin:12px 0;padding-left:26px;color:#252b33;',
    OL: 'font-size:16px;line-height:1.8;margin:12px 0;padding-left:26px;color:#252b33;',
    BLOCKQUOTE: 'font-size:16px;line-height:1.75;margin:18px 0;padding:12px 16px;border-left:4px solid #aab4c1;background:#f7f8fa;color:#46515e;',
    PRE: 'font-family:Consolas,Menlo,monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;margin:18px 0;padding:14px;border:1px solid #e4e8ee;background:#f6f8fa;color:#20252b;',
    TABLE: 'width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;',
    TH: 'border:1px solid #d7dde6;padding:9px 10px;text-align:left;background:#f2f4f7;font-weight:800;',
    TD: 'border:1px solid #d7dde6;padding:9px 10px;text-align:left;vertical-align:top;',
    HR: 'border:0;border-top:1px solid #dfe4ea;margin:30px 0;',
    A: 'color:#1565c0;text-decoration:underline;'
  };

  root.querySelectorAll('*').forEach(el => {
    if (css[el.tagName]) el.setAttribute('style', css[el.tagName]);
    if (el.matches('code:not(pre code)')) el.setAttribute('style', 'font-family:Consolas,Menlo,monospace;background:#f0f2f5;padding:2px 5px;border-radius:4px;font-size:0.92em;');
    if (el.classList.contains('callout')) {
      let bg = '#f4f8ff', border = '#cfe0ff';
      if (el.classList.contains('callout-tip')) { bg = '#f2fbf5'; border = '#c7ebd2'; }
      if (el.classList.contains('callout-warning')) { bg = '#fff9e8'; border = '#f2df9d'; }
      if (el.classList.contains('callout-error')) { bg = '#fff2f2'; border = '#f0caca'; }
      el.setAttribute('style', `font-size:16px;line-height:1.75;margin:16px 0;padding:14px 16px;border:1px solid ${border};background:${bg};`);
    }
    if (el.classList.contains('callout-title')) el.setAttribute('style', 'font-weight:800;margin-bottom:4px;');
    if (el.classList.contains('toc-box')) el.setAttribute('style', 'border:1px solid #dfe5eb;background:#f8fafb;padding:14px 16px;margin:0 0 28px;');
    el.removeAttribute('class');
    el.removeAttribute('id');
    [...el.attributes].forEach(attr => { if (attr.name.startsWith('data-')) el.removeAttribute(attr.name); });
  });
}

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function escapeAttr(value = '') { return escapeHtml(value).replaceAll('`', '&#096;'); }
