import { parseMarkdown, normalizeAiMarkdown } from './markdown.js';


/* ============================================================
 * Callout
 * ============================================================ */

const CALLOUT_MAP = {
    NOTE: {
        cls: 'note',
        icon: '💡',
        title: '참고'
    },

    TIP: {
        cls: 'tip',
        icon: '✅',
        title: '팁'
    },

    WARNING: {
        cls: 'warning',
        icon: '⚠️',
        title: '주의'
    },

    IMPORTANT: {
        cls: 'warning',
        icon: '⚠️',
        title: '중요'
    },

    ERROR: {
        cls: 'error',
        icon: '❌',
        title: '오류'
    }
};


/* ============================================================
 * Preview
 * ============================================================ */

export function buildPreview(source, options = {})
{
    const normalized = normalizeAiMarkdown(source);
    const html = parseMarkdown(normalized);

    const host = document.createElement('div');
    host.innerHTML = html;

    transformCallouts(host);
    transformImages(host);

    if(options.numberHeadings)
        numberH2(host);

    if(options.toc)
        injectToc(host);

    return {
        normalized,
        html: host.innerHTML,

        stats: collectStats(host),

        imageRefs: collectImageRefs(host),

        mermaidBlocks:
            [...host.querySelectorAll('.mermaid-wrap')].map(
                (el, index) => ({
                    index: index + 1,
                    source: el.dataset.mermaidSource || ''
                })
            )
    };
}


/* ============================================================
 * Callout 변환
 * ============================================================ */

function transformCallouts(host)
{
    host.querySelectorAll('blockquote').forEach(block => {

        const first = block.firstElementChild;

        if(!first)
            return;

        const text = first.textContent.trim();

        const match =
            text.match(
                /^\[!(NOTE|TIP|WARNING|IMPORTANT|ERROR)\]\s*(.*)$/i
            );

        if(!match)
            return;

        const type = match[1].toUpperCase();
        const cfg = CALLOUT_MAP[type];

        first.textContent = match[2] || '';

        if(!first.textContent.trim())
            first.remove();

        const box = document.createElement('div');

        box.className =
            `callout callout-${cfg.cls}`;

        box.innerHTML =
            `<div class="callout-title">` +
            `${cfg.icon} ${cfg.title}` +
            `</div>` +
            block.innerHTML;

        block.replaceWith(box);
    });
}


/* ============================================================
 * 이미지 변환
 * ============================================================ */

function transformImages(host)
{
    const images =
        [
            ...host.querySelectorAll(
                'figure.md-image, .md-inline-image'
            )
        ];

    images.forEach((node, index) => {

        const path =
            node.dataset.mdSrc || '';

        let alt = 'image';

        if(node.matches('figure'))
        {
            alt =
                node.querySelector(
                    '.image-marker span'
                )?.textContent || 'image';
        }
        else
        {
            alt =
                node.textContent
                    .replace(
                        /^\[IMAGE:\s*|\]$/g,
                        ''
                    ) || 'image';
        }


        /*
         * inline image → figure 변환
         */

        if(!node.matches('figure'))
        {
            const figure =
                document.createElement('figure');

            figure.className =
                'md-image';

            figure.dataset.mdSrc =
                path;

            figure.dataset.mdTitle =
                node.dataset.mdTitle || '';

            figure.innerHTML =
                `<div class="image-marker">` +
                `<b>IMAGE_PLACEHOLDER</b>` +
                `<span>${escapeHtml(alt)}</span>` +
                `<small>${escapeHtml(path)}</small>` +
                `</div>`;

            node.replaceWith(figure);

            node = figure;
        }


        node.dataset.imageIndex =
            String(index + 1);


        const marker =
            node.querySelector('.image-marker');

        if(marker)
        {
            marker.innerHTML =
                `<b>IMAGE ${String(index + 1).padStart(2, '0')}</b>` +
                `<span>${escapeHtml(alt)}</span>` +
                `<small>${escapeHtml(path)}</small>`;
        }
    });
}


/* ============================================================
 * H2 번호
 * ============================================================ */

function numberH2(host)
{
    let count = 0;

    host.querySelectorAll('h2').forEach(heading => {

        if(heading.closest('.toc-box'))
            return;

        count++;

        const text =
            heading.textContent.replace(
                /^\d+\.\s*/,
                ''
            );

        heading.textContent =
            `${count}. ${text}`;
    });
}


/* ============================================================
 * TOC
 * ============================================================ */

function injectToc(host)
{
    const headings =
        [...host.querySelectorAll('h2, h3')]
            .filter(
                heading =>
                    heading.textContent.trim()
            );


    if(headings.length < 2)
        return;


    const box =
        document.createElement('div');

    box.className =
        'toc-box';


    const items =
        headings.map(heading => {

            const indent =
                heading.tagName === 'H3'
                    ? ' style="margin-left:18px"'
                    : '';

            return (
                `<li${indent}>` +
                `<a href="#${escapeAttr(heading.id)}">` +
                `${escapeHtml(heading.textContent)}` +
                `</a>` +
                `</li>`
            );

        }).join('');


    box.innerHTML =
        `<strong>목차</strong>` +
        `<ol>${items}</ol>`;


    host.prepend(box);
}


/* ============================================================
 * 통계
 * ============================================================ */

function collectStats(host)
{
    return {
        paragraphs:
            host.querySelectorAll('p').length,

        codeBlocks:
            host.querySelectorAll(
                'pre:not(.mermaid-source)'
            ).length,

        images:
            host.querySelectorAll(
                'figure.md-image'
            ).length,

        tables:
            host.querySelectorAll(
                'table'
            ).length,

        headings:
            host.querySelectorAll(
                'h1,h2,h3,h4,h5,h6'
            ).length,

        links:
            host.querySelectorAll(
                'a'
            ).length,

        mermaid:
            host.querySelectorAll(
                '.mermaid-wrap'
            ).length
    };
}


/* ============================================================
 * 이미지 정보
 * ============================================================ */

function collectImageRefs(host)
{
    return [
        ...host.querySelectorAll(
            'figure.md-image'
        )
    ].map((el, index) => ({

        index: index + 1,

        src:
            el.dataset.mdSrc || '',

        title:
            el.dataset.mdTitle || '',

        alt:
            el.querySelector(
                '.image-marker span'
            )?.textContent || 'image'
    }));
}


/* ============================================================
 * Mermaid
 * ============================================================ */

export function renderMermaidIn(container)
{
    const result = [];

    const wraps =
        [
            ...container.querySelectorAll(
                '.mermaid-wrap'
            )
        ];


    wraps.forEach((wrap, index) => {

        const source =
            wrap.dataset.mermaidSource || '';

        const rendered =
            renderSimpleFlowchart(source);


        if(rendered.ok)
        {
            wrap.innerHTML =
                rendered.svg;

            wrap.dataset.rendered =
                '1';

            wrap.dataset.diagramIndex =
                String(index + 1);


            result.push({
                index: index + 1,
                source,
                svg: rendered.svg,
                ok: true
            });
        }
        else
        {
            wrap.innerHTML =
                `<div class="callout callout-warning">` +
                `<div class="callout-title">⚠ Mermaid 원문 유지</div>` +
                `<p>${escapeHtml(rendered.reason)}</p>` +
                `<pre>${escapeHtml(source)}</pre>` +
                `</div>`;


            wrap.dataset.rendered =
                '0';


            result.push({
                index: index + 1,
                source,
                svg: '',
                ok: false,
                reason: rendered.reason
            });
        }
    });


    return result;
}


/* ============================================================
 * 단순 Mermaid Flowchart Renderer
 * ============================================================ */

function renderSimpleFlowchart(source)
{
    const lines =
        String(source || '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);


    if(lines.length === 0)
    {
        return {
            ok: false,
            reason: '빈 Mermaid 블록입니다.'
        };
    }


    const header =
        lines.shift();


    const headerMatch =
        header.match(
            /^(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)$/i
        );


    if(!headerMatch)
    {
        return {
            ok: false,
            reason:
                '현재 graph/flowchart LR, RL, TD, TB, BT 형식만 지원합니다.'
        };
    }


    const direction =
        headerMatch[1].toUpperCase();


    const nodes =
        new Map();


    const edges =
        [];


    function addNode(id, label = '')
    {
        if(!nodes.has(id))
        {
            nodes.set(id, {
                id,
                label: label || id
            });
        }
        else if(label)
        {
            nodes.get(id).label =
                label;
        }
    }


    const nodePattern =
        String.raw`([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?`;


    const edgeRegex =
        new RegExp(
            `^${nodePattern}\\s*` +
            `(-->|---|-.->|==>)\\s*` +
            `${nodePattern}` +
            `(?:\\s*\\|([^|]+)\\|)?$`
        );


    const nodeOnlyRegex =
        new RegExp(
            `^${nodePattern}$`
        );


    for(const originalLine of lines)
    {
        const line =
            originalLine
                .replace(/;$/, '')
                .trim();


        const edge =
            line.match(edgeRegex);


        if(edge)
        {
            const fromId =
                edge[1];

            const fromLabel =
                edge[2] ||
                edge[3] ||
                edge[4] ||
                '';


            const arrow =
                edge[5];


            const toId =
                edge[6];

            const toLabel =
                edge[7] ||
                edge[8] ||
                edge[9] ||
                '';


            const label =
                edge[10] || '';


            addNode(
                fromId,
                fromLabel
            );

            addNode(
                toId,
                toLabel
            );


            edges.push({
                from: fromId,
                to: toId,
                arrow,
                label
            });


            continue;
        }


        const node =
            line.match(
                nodeOnlyRegex
            );


        if(node)
        {
            addNode(
                node[1],
                node[2] ||
                node[3] ||
                node[4] ||
                ''
            );
        }
    }


    if(nodes.size === 0 ||
       edges.length === 0)
    {
        return {
            ok: false,
            reason:
                '지원 가능한 Mermaid 노드 또는 화살표를 찾지 못했습니다.'
        };
    }


    /*
     * 노드 rank 계산
     */

    const rank =
        new Map();


    for(const key of nodes.keys())
        rank.set(key, 0);


    for(
        let pass = 0;
        pass < nodes.size;
        pass++
    )
    {
        let changed =
            false;


        for(const edge of edges)
        {
            const current =
                rank.get(edge.from) || 0;


            const candidate =
                Math.min(
                    nodes.size,
                    current + 1
                );


            if(
                candidate >
                (rank.get(edge.to) || 0)
            )
            {
                rank.set(
                    edge.to,
                    candidate
                );

                changed =
                    true;
            }
        }


        if(!changed)
            break;
    }


    const levels =
        new Map();


    for(const node of nodes.values())
    {
        const nodeRank =
            rank.get(node.id) || 0;


        if(!levels.has(nodeRank))
            levels.set(nodeRank, []);


        levels.get(nodeRank)
            .push(node);
    }


    const nodeWidth =
        168;

    const nodeHeight =
        58;

    const gapX =
        72;

    const gapY =
        52;

    const padding =
        38;


    const horizontal =
        direction === 'LR' ||
        direction === 'RL';


    const positions =
        new Map();


    const ranks =
        [...levels.keys()]
            .sort((a, b) => a - b);


    for(const r of ranks)
    {
        const list =
            levels.get(r);


        list.forEach(
            (node, index) => {

                let x;
                let y;


                if(horizontal)
                {
                    x =
                        padding +
                        r *
                        (nodeWidth + gapX);

                    y =
                        padding +
                        index *
                        (nodeHeight + gapY);
                }
                else
                {
                    x =
                        padding +
                        index *
                        (nodeWidth + gapX);

                    y =
                        padding +
                        r *
                        (nodeHeight + gapY);
                }


                positions.set(
                    node.id,
                    { x, y }
                );
            }
        );
    }


    /*
     * Right → Left
     */

    if(direction === 'RL')
    {
        const maxX =
            Math.max(
                ...[
                    ...positions.values()
                ].map(p => p.x)
            );


        for(const p of positions.values())
        {
            p.x =
                maxX -
                p.x +
                padding;
        }
    }


    /*
     * Bottom → Top
     */

    if(direction === 'BT')
    {
        const maxY =
            Math.max(
                ...[
                    ...positions.values()
                ].map(p => p.y)
            );


        for(const p of positions.values())
        {
            p.y =
                maxY -
                p.y +
                padding;
        }
    }


    const width =
        Math.max(
            ...[
                ...positions.values()
            ].map(
                p => p.x + nodeWidth
            )
        ) + padding;


    const height =
        Math.max(
            ...[
                ...positions.values()
            ].map(
                p => p.y + nodeHeight
            )
        ) + padding;


    const markerId =
        `arrow-${Math.random()
            .toString(36)
            .slice(2, 8)}`;


    const edgeSvg =
        edges.map(edge => {

            const from =
                positions.get(
                    edge.from
                );

            const to =
                positions.get(
                    edge.to
                );


            if(!from || !to)
                return '';


            let x1;
            let y1;
            let x2;
            let y2;


            if(horizontal)
            {
                const forward =
                    to.x >= from.x;


                x1 =
                    forward
                        ? from.x + nodeWidth
                        : from.x;

                y1 =
                    from.y +
                    nodeHeight / 2;


                x2 =
                    forward
                        ? to.x
                        : to.x + nodeWidth;

                y2 =
                    to.y +
                    nodeHeight / 2;
            }
            else
            {
                const forward =
                    to.y >= from.y;


                x1 =
                    from.x +
                    nodeWidth / 2;

                y1 =
                    forward
                        ? from.y + nodeHeight
                        : from.y;


                x2 =
                    to.x +
                    nodeWidth / 2;

                y2 =
                    forward
                        ? to.y
                        : to.y + nodeHeight;
            }


            const mx =
                (x1 + x2) / 2;

            const my =
                (y1 + y2) / 2;


            let labelSvg =
                '';


            if(edge.label)
            {
                labelSvg =
                    `<text ` +
                    `x="${mx}" ` +
                    `y="${my - 7}" ` +
                    `text-anchor="middle" ` +
                    `font-size="12" ` +
                    `fill="#475569">` +
                    `${escapeHtml(edge.label)}` +
                    `</text>`;
            }


            return (
                `<g>` +
                `<path ` +
                `d="M ${x1} ${y1} L ${x2} ${y2}" ` +
                `fill="none" ` +
                `stroke="#64748b" ` +
                `stroke-width="2" ` +
                `marker-end="url(#${markerId})"` +
                `/>` +
                labelSvg +
                `</g>`
            );

        }).join('');


    const nodeSvg =
        [...nodes.values()]
            .map(node => {

                const p =
                    positions.get(
                        node.id
                    );


                return (
                    `<g>` +

                    `<rect ` +
                    `x="${p.x}" ` +
                    `y="${p.y}" ` +
                    `width="${nodeWidth}" ` +
                    `height="${nodeHeight}" ` +
                    `rx="10" ` +
                    `fill="#f8fafc" ` +
                    `stroke="#94a3b8" ` +
                    `stroke-width="1.5"` +
                    `/>` +

                    `<text ` +
                    `x="${p.x + nodeWidth / 2}" ` +
                    `y="${p.y + nodeHeight / 2 + 5}" ` +
                    `text-anchor="middle" ` +
                    `font-family="Arial, sans-serif" ` +
                    `font-size="14" ` +
                    `font-weight="600" ` +
                    `fill="#1e293b">` +
                    `${escapeHtml(node.label)}` +
                    `</text>` +

                    `</g>`
                );
            })
            .join('');


    const svg =
        `<svg ` +
        `xmlns="http://www.w3.org/2000/svg" ` +
        `viewBox="0 0 ${width} ${height}" ` +
        `width="${width}" ` +
        `height="${height}" ` +
        `role="img" ` +
        `aria-label="Mermaid flowchart">` +

        `<defs>` +
        `<marker ` +
        `id="${markerId}" ` +
        `markerWidth="10" ` +
        `markerHeight="10" ` +
        `refX="9" ` +
        `refY="3" ` +
        `orient="auto" ` +
        `markerUnits="strokeWidth">` +

        `<path ` +
        `d="M0,0 L0,6 L9,3 z" ` +
        `fill="#64748b"` +
        `/>` +

        `</marker>` +
        `</defs>` +

        edgeSvg +
        nodeSvg +

        `</svg>`;


    return {
        ok: true,
        svg
    };
}


/* ============================================================
 * SVG → PNG Clipboard
 * ============================================================ */

export async function copySvgAsPng(
    svgMarkup,
    scale = 2
)
{
    if(
        !navigator.clipboard?.write ||
        typeof ClipboardItem === 'undefined'
    )
    {
        throw new Error(
            '이미지 Clipboard API를 사용할 수 없습니다.'
        );
    }


    const blob =
        new Blob(
            [svgMarkup],
            {
                type:
                    'image/svg+xml;charset=utf-8'
            }
        );


    const url =
        URL.createObjectURL(blob);


    try
    {
        const img =
            await loadImage(url);


        const canvas =
            document.createElement(
                'canvas'
            );


        canvas.width =
            Math.max(
                1,
                Math.round(
                    img.naturalWidth *
                    scale
                )
            );


        canvas.height =
            Math.max(
                1,
                Math.round(
                    img.naturalHeight *
                    scale
                )
            );


        const ctx =
            canvas.getContext('2d');


        ctx.fillStyle =
            '#ffffff';


        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
        );


        const png =
            await new Promise(
                (resolve, reject) => {

                    canvas.toBlob(
                        blob => {

                            if(blob)
                                resolve(blob);
                            else
                                reject(
                                    new Error(
                                        'PNG 생성 실패'
                                    )
                                );
                        },

                        'image/png'
                    );
                }
            );


        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': png
            })
        ]);
    }
    finally
    {
        URL.revokeObjectURL(url);
    }
}


function loadImage(url)
{
    return new Promise(
        (resolve, reject) => {

            const img =
                new Image();


            img.onload =
                () => resolve(img);


            img.onerror =
                () => reject(
                    new Error(
                        'SVG 렌더링 실패'
                    )
                );


            img.src =
                url;
        }
    );
}


/* ============================================================
 * NAVER Clipboard HTML
 *
 * 핵심:
 *
 * 1. PRE를 그대로 복사하지 않는다.
 * 2. 실제 개행을 BR로 변환한다.
 * 3. SPACE를 NBSP로 변환하여 들여쓰기를 유지한다.
 * 4. inline CODE를 SPAN으로 변환한다.
 *
 * ============================================================ */

export function getClipboardHtml(
    previewEl,
    preset = 'tech'
)
{
    const clone =
        previewEl.cloneNode(true);


    /*
     * TOC 링크 제거
     */

    clone.querySelectorAll(
        '.toc-box a'
    ).forEach(a => {

        const span =
            document.createElement(
                'span'
            );

        span.textContent =
            a.textContent;

        a.replaceWith(span);
    });


    /*
     * 이미지 → Placeholder
     */

    clone.querySelectorAll(
        'figure.md-image'
    ).forEach(figure => {

        const marker =
            figure.querySelector(
                '.image-marker'
            );


        const p =
            document.createElement('p');


        p.style.cssText =
            'margin:20px 0;' +
            'padding:14px;' +
            'text-align:center;' +
            'border:1px dashed #aeb8c5;' +
            'background-color:#fafbfc;' +
            'color:#596575;';


        p.textContent =
            marker?.innerText
                .replace(/\s+/g, ' ')
                .trim()
            || '[IMAGE]';


        figure.replaceWith(p);
    });


    /*
     * Mermaid → Placeholder
     */

    clone.querySelectorAll(
        '.mermaid-wrap'
    ).forEach(
        (wrap, index) => {

            const p =
                document.createElement(
                    'p'
                );


            p.style.cssText =
                'margin:20px 0;' +
                'padding:14px;' +
                'text-align:center;' +
                'border:1px dashed #aeb8c5;' +
                'background-color:#fafbfc;' +
                'color:#596575;';


            p.textContent =
                `[DIAGRAM ${String(index + 1).padStart(2, '0')}] ` +
                'Mermaid PNG를 이미지 Queue에서 복사해 붙여넣으세요.';


            wrap.replaceWith(p);
        }
    );


    /*
     * 중요:
     *
     * SmartEditor ONE이 PRE의 white-space를
     * 제거할 가능성이 있으므로
     *
     * PRE → DIV + BR
     *
     * 구조로 변환한다.
     */

    convertCodeBlocksForNaver(clone);


    /*
     * inline code:
     *
     * CODE → styled SPAN
     */

    convertInlineCodeForNaver(clone);


    /*
     * 일반 HTML 스타일
     */

    inlineStylesForClipboard(
        clone,
        preset
    );


    /*
     * 불필요 attribute 정리
     */

    cleanupClipboardAttributes(
        clone
    );


    return clone.innerHTML;
}


/* ============================================================
 * Code Block
 *
 * <pre><code>
 *     ...
 * </code></pre>
 *
 *          ↓
 *
 * <div>
 *     <span>line1</span><br>
 *     <span>line2</span><br>
 * </div>
 *
 * ============================================================ */

function convertCodeBlocksForNaver(root)
{
    const codeBlocks = [
        ...root.querySelectorAll(
            'pre:not(.mermaid-source)'
        )
    ];

    codeBlocks.forEach(pre => {

        const code =
            pre.querySelector('code');

        let text =
            code
                ? code.textContent
                : pre.textContent;

        text = String(text || '')
            .replace(/\r\n?/g, '\n')
            .replace(/\n$/, '');

        const wrapper =
            document.createElement('div');

        wrapper.style.cssText =
            'margin:18px 0;' +
            'padding:12px 14px;' +
            'border:1px solid #dfe3e8;' +
            'background-color:#f6f8fa;' +
            'font-family:Consolas,Menlo,Monaco,monospace;' +
            'font-size:13px;' +
            'line-height:1.6;' +
            'color:#20252b;' +
            'text-align:left;';

        const lines =
            text.split('\n');

        lines.forEach(line => {

            const p =
                document.createElement('p');

            p.style.cssText =
                'display:block;' +
                'margin:0;' +
                'padding:0;' +
                'min-height:20px;' +
                'font-family:Consolas,Menlo,Monaco,monospace;' +
                'font-size:13px;' +
                'line-height:20px;' +
                'color:#20252b;' +
                'text-align:left;';

            const expanded =
                line.replace(/\t/g, '    ');

            const leading =
                expanded.match(/^ */)?.[0].length || 0;

            const body =
                expanded.slice(leading);

            const indent =
                '\u00A0'.repeat(leading);

            p.textContent =
                expanded.length === 0
                    ? '\u00A0'
                    : indent + body;

            wrapper.appendChild(p);
        });

        pre.replaceWith(wrapper);
    });
}

/* ============================================================
 * Inline Code
 *
 * <code>Init_flag</code>
 *
 *         ↓
 *
 * <span style="...">Init_flag</span>
 *
 * ============================================================ */

function convertInlineCodeForNaver(root)
{
    const inlineCodes =
        [
            ...root.querySelectorAll(
                'code'
            )
        ];


    inlineCodes.forEach(code => {

        /*
         * PRE 내부 CODE는 위 단계에서
         * 이미 제거된다.
         */

        if(code.closest('pre'))
            return;


        const span =
            document.createElement(
                'span'
            );


        span.textContent =
            code.textContent;


        span.style.cssText =
            'font-family:Consolas,Menlo,Monaco,monospace;' +
            'font-size:0.92em;' +
            'background-color:#f0f2f5;' +
            'padding:2px 5px;' +
            'border-radius:4px;' +
            'color:#20252b;';


        code.replaceWith(
            span
        );
    });
}


/* ============================================================
 * Clipboard Inline Style
 * ============================================================ */

function inlineStylesForClipboard(
    root,
    preset = 'tech'
)
{
    const presets = {

        tech: {
            h1:
                'font-size:32px;' +
                'font-weight:800;' +
                'line-height:1.35;' +
                'margin:0 0 30px;' +
                'color:#1d2530;',

            h2:
                'font-size:25px;' +
                'font-weight:800;' +
                'line-height:1.4;' +
                'margin:38px 0 16px;' +
                'padding-bottom:8px;' +
                'border-bottom:2px solid #1e2935;' +
                'color:#1d2530;',

            h3:
                'font-size:20px;' +
                'font-weight:800;' +
                'line-height:1.45;' +
                'margin:26px 0 10px;' +
                'color:#1d2530;'
        },


        clean: {
            h1:
                'font-size:34px;' +
                'font-weight:700;' +
                'line-height:1.45;' +
                'margin:0 0 34px;' +
                'color:#20242a;',

            h2:
                'font-size:25px;' +
                'font-weight:700;' +
                'line-height:1.55;' +
                'margin:40px 0 15px;' +
                'color:#20242a;',

            h3:
                'font-size:20px;' +
                'font-weight:700;' +
                'line-height:1.6;' +
                'margin:28px 0 10px;' +
                'color:#20242a;'
        },


        basic: {
            h1:
                'font-size:30px;' +
                'font-weight:800;' +
                'line-height:1.4;' +
                'margin:0 0 28px;' +
                'color:#1d2530;',

            h2:
                'font-size:24px;' +
                'font-weight:800;' +
                'line-height:1.45;' +
                'margin:34px 0 14px;' +
                'color:#1d2530;',

            h3:
                'font-size:20px;' +
                'font-weight:800;' +
                'line-height:1.5;' +
                'margin:24px 0 10px;' +
                'color:#1d2530;'
        },


        review: {
            h1:
                'font-size:34px;' +
                'font-weight:800;' +
                'line-height:1.4;' +
                'margin:0 0 34px;' +
                'text-align:center;' +
                'color:#1d2530;',

            h2:
                'font-size:24px;' +
                'font-weight:800;' +
                'line-height:1.45;' +
                'margin:36px 0 15px;' +
                'padding:10px 14px;' +
                'border-left:6px solid #222;' +
                'background-color:#f7f7f8;' +
                'color:#1d2530;',

            h3:
                'font-size:20px;' +
                'font-weight:800;' +
                'line-height:1.5;' +
                'margin:26px 0 10px;' +
                'color:#1d2530;'
        }
    };


    const selected =
        presets[preset] ||
        presets.tech;


    const css = {

        H1:
            selected.h1,

        H2:
            selected.h2,

        H3:
            selected.h3,

        H4:
            'font-size:17px;' +
            'font-weight:800;' +
            'line-height:1.5;' +
            'margin:22px 0 8px;' +
            'color:#1d2530;',

        P:
            'font-size:16px;' +
            'line-height:1.85;' +
            'margin:12px 0;' +
            'color:#252b33;',

        UL:
            'font-size:16px;' +
            'line-height:1.8;' +
            'margin:12px 0;' +
            'padding-left:26px;' +
            'color:#252b33;',

        OL:
            'font-size:16px;' +
            'line-height:1.8;' +
            'margin:12px 0;' +
            'padding-left:26px;' +
            'color:#252b33;',

        LI:
            'margin:3px 0;',

        BLOCKQUOTE:
            'font-size:16px;' +
            'line-height:1.75;' +
            'margin:18px 0;' +
            'padding:12px 16px;' +
            'border-left:4px solid #aab4c1;' +
            'background-color:#f7f8fa;' +
            'color:#46515e;',

        TABLE:
            'width:100%;' +
            'border-collapse:collapse;' +
            'margin:18px 0;' +
            'font-size:14px;',

        TH:
            'border:1px solid #d7dde6;' +
            'padding:9px 10px;' +
            'text-align:left;' +
            'background-color:#f2f4f7;' +
            'font-weight:800;',

        TD:
            'border:1px solid #d7dde6;' +
            'padding:9px 10px;' +
            'text-align:left;' +
            'vertical-align:top;',

        HR:
            'border:0;' +
            'border-top:1px solid #dfe4ea;' +
            'margin:30px 0;',

        A:
            'color:#1565c0;' +
            'text-decoration:underline;'
    };


    root.querySelectorAll('*')
        .forEach(el => {

            if(css[el.tagName])
            {
                /*
                 * 이미 특정 style이 들어있는 경우
                 * 기존 style 뒤에 공통 style 추가
                 */

                const existing =
                    el.getAttribute(
                        'style'
                    ) || '';


                el.setAttribute(
                    'style',
                    existing +
                    css[el.tagName]
                );
            }


            /*
             * Callout
             */

            if(
                el.classList.contains(
                    'callout'
                )
            )
            {
                let background =
                    '#f4f8ff';

                let border =
                    '#cfe0ff';


                if(
                    el.classList.contains(
                        'callout-tip'
                    )
                )
                {
                    background =
                        '#f2fbf5';

                    border =
                        '#c7ebd2';
                }


                if(
                    el.classList.contains(
                        'callout-warning'
                    )
                )
                {
                    background =
                        '#fff9e8';

                    border =
                        '#f2df9d';
                }


                if(
                    el.classList.contains(
                        'callout-error'
                    )
                )
                {
                    background =
                        '#fff2f2';

                    border =
                        '#f0caca';
                }


                el.setAttribute(
                    'style',

                    'font-size:16px;' +
                    'line-height:1.75;' +
                    'margin:16px 0;' +
                    'padding:14px 16px;' +
                    `border:1px solid ${border};` +
                    `background-color:${background};`
                );
            }


            if(
                el.classList.contains(
                    'callout-title'
                )
            )
            {
                el.setAttribute(
                    'style',

                    'font-weight:800;' +
                    'margin-bottom:4px;'
                );
            }


            if(
                el.classList.contains(
                    'toc-box'
                )
            )
            {
                el.setAttribute(
                    'style',

                    'border:1px solid #dfe5eb;' +
                    'background-color:#f8fafb;' +
                    'padding:14px 16px;' +
                    'margin:0 0 28px;'
                );
            }
        });
}


/* ============================================================
 * Clipboard HTML Cleanup
 * ============================================================ */

function cleanupClipboardAttributes(root)
{
    root.querySelectorAll('*')
        .forEach(el => {

            el.removeAttribute(
                'class'
            );


            el.removeAttribute(
                'id'
            );


            [
                ...el.attributes
            ].forEach(attr => {

                if(
                    attr.name.startsWith(
                        'data-'
                    )
                )
                {
                    el.removeAttribute(
                        attr.name
                    );
                }
            });
        });
}


/* ============================================================
 * Escape
 * ============================================================ */

function escapeHtml(value = '')
{
    return String(value)
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );
}


function escapeAttr(value = '')
{
    return escapeHtml(value)
        .replaceAll(
            '`',
            '&#096;'
        );
}
