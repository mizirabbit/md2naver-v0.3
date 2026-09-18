import { configureMarked, detectInputType } from './markdown.js';
import { buildPreview, renderMermaidIn, getClipboardHtml, copySvgAsPng } from './naver-renderer.js';
import { validateDocument, getDiagnosticVisibility } from './validator.js';
import { ImageManager, fileToObjectUrl, copyImageFile } from './image-manager.js';
import { copyRichText } from './clipboard.js';

configureMarked();

const $ = (sel) => document.querySelector(sel);
const markdownInput = $('#markdownInput');
const preview = $('#preview');
const editorPane = document.querySelector('.editor-pane');
const mdFileInput = $('#mdFileInput');
const imageFolderInput = $('#imageFolderInput');
const imageQueue = $('#imageQueue');
const compatList = $('#compatList');
const compatScore = $('#compatScore');
const sourceMeta = $('#sourceMeta');
const renderMeta = $('#renderMeta');
const imageCountBadge = $('#imageCountBadge');
const copyState = $('#copyState');
const inputTypeBadge = $('#inputTypeBadge');
const diagnosticsPanel = $('#diagnosticsPanel');
const compatibilityCard = $('#compatibilityCard');
const imageCard = $('#imageCard');
const btnDetails = $('#btnDetails');
const presetSelect = $('#presetSelect');
const tocToggle = $('#tocToggle');
const numberHeadingToggle = $('#numberHeadingToggle');
const compareDialog = $('#compareDialog');
const compareSource = $('#compareSource');
const compareResult = $('#compareResult');
const imageTemplate = $('#imageItemTemplate');

const imageManager = new ImageManager();
let renderToken = 0;
let lastRender = null;
let lastValidation = null;
let lastDiagrams = [];
let activeObjectUrls = [];
let detailsExpanded = false;

const sampleMarkdown = `# Android 16 NPU 적용 정리

GPT/Gemini가 만든 Markdown을 **네이버 블로그용 문서**로 변환하는 샘플입니다.

## 1. 개요

Amlogic **S905X5** 환경에서 ADLA NPU 실행 구조를 정리합니다.

> **NOTE**
> 이 문서는 기술 블로그 프리셋 예시입니다.

## 2. 처리 구조

\`\`\`mermaid
graph LR
A[Screen Capture] --> B[Resize 640x480]
B --> C[Ring Buffer]
C --> D[NPU Inference]
\`\`\`

## 3. 실행 명령

\`\`\`bash
adb shell
cd /data/local/tests/vendor/yolo11_test
./yolov11_demo yolo11s_w8a8.adla input/
\`\`\`

### 확인 항목

- ADLA Runtime
- NNServer
- YOLOv11 model

## 4. 결과

| 항목 | 상태 | 비고 |
|---|---|---|
| ADLA | 정상 | Runtime 확인 |
| NNServer | 정상 | Device 확인 |
| YOLOv11 | 정상 | Board 실행 |

> **WARNING**
> SmartEditor ONE은 외부 HTML의 일부 스타일을 제거할 수 있으므로 실제 붙여넣기 결과를 확인해야 합니다.

## 5. 이미지 예시

![Board Result](images/board-result.png)
`;

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
const scheduleRender = debounce(render, 140);

function updateInputType(source) {
  const detected = detectInputType(source);
  inputTypeBadge.textContent = detected.label;
  inputTypeBadge.className = `input-type-badge ${detected.type}`;
}

async function render() {
  const token = ++renderToken;
  const source = markdownInput.value;
  const result = buildPreview(source, { toc: tocToggle.checked, numberHeadings: numberHeadingToggle.checked });
  lastRender = result;

  preview.innerHTML = result.html;
  applyPreset(preview);
  sourceMeta.textContent = `${source.length.toLocaleString()}자`;
  updateInputType(source);
  renderMeta.textContent = `문단 ${result.stats.paragraphs} · 코드 ${result.stats.codeBlocks} · 이미지 ${result.stats.images} · 다이어그램 ${result.stats.mermaid}`;

  lastValidation = updateCompatibility(source, result);
  lastDiagrams = renderMermaidIn(preview);
  if (token !== renderToken) return;
  updateImageQueue(result.imageRefs, lastDiagrams);
  updateDiagnosticVisibility();
}

function applyPreset(target) {
  target.classList.remove('preset-tech', 'preset-clean', 'preset-basic', 'preset-review');
  target.classList.add(`preset-${presetSelect.value}`);
}

function updateCompatibility(source, result) {
  const validation = validateDocument(source, result);
  compatScore.textContent = validation.score;
  compatScore.style.background = validation.score >= 90 ? '#e8f8ef' : validation.score >= 70 ? '#fff7df' : '#fff0f0';
  compatScore.style.color = validation.score >= 90 ? '#0b8b43' : validation.score >= 70 ? '#9b6b00' : '#bd3030';
  compatList.innerHTML = validation.issues.map(item => `
    <div class="compat-item compat-${item.level}">
      <div class="icon">${item.icon}</div>
      <div><div class="title">${escapeHtml(item.title)}</div><div class="desc">${escapeHtml(item.desc)}</div></div>
    </div>`).join('');
  return validation;
}

function updateDiagnosticVisibility() {
  const visibility = getDiagnosticVisibility(
    lastValidation,
    lastRender?.imageRefs.length || 0,
    lastDiagrams.length,
    detailsExpanded
  );

  compatibilityCard.hidden = !visibility.showCompatibility;
  imageCard.hidden = !visibility.showImages;
  diagnosticsPanel.hidden = !visibility.showPanel;
  btnDetails.textContent = detailsExpanded ? '상세 검사 닫기' : '상세 검사';
  btnDetails.setAttribute('aria-expanded', String(detailsExpanded));
}

function toggleDetails() {
  detailsExpanded = !detailsExpanded;
  updateDiagnosticVisibility();
}

function updateImageQueue(imageRefs, diagrams = []) {
  activeObjectUrls.forEach(URL.revokeObjectURL);
  activeObjectUrls = [];

  const entries = imageManager.createEntries(imageRefs);
  const total = entries.length + diagrams.length;
  imageCountBadge.textContent = `${total}개`;

  if (!total) {
    imageQueue.className = 'image-queue empty-state';
    imageQueue.textContent = '이미지/다이어그램이 없습니다.';
    return;
  }

  imageQueue.className = 'image-queue';
  imageQueue.innerHTML = '';

  entries.forEach(entry => {
    const node = imageTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.image-index').textContent = `I${String(entry.index).padStart(2, '0')}`;
    node.querySelector('.image-name').textContent = entry.alt || entry.file?.name || 'image';
    node.querySelector('.image-path').textContent = entry.src;
    const status = node.querySelector('.image-status');
    const thumb = node.querySelector('.image-thumb');
    const copyBtn = node.querySelector('.image-copy');

    if (entry.file) {
      status.textContent = `연결됨 · ${formatBytes(entry.file.size)}`;
      status.className = 'image-status status-ok';
      const url = fileToObjectUrl(entry.file);
      activeObjectUrls.push(url);
      thumb.src = url;
      copyBtn.addEventListener('click', async () => {
        try { await copyImageFile(entry.file); flashButton(copyBtn); }
        catch (err) { alert(err.message); }
      });
    } else {
      status.textContent = '파일 미연결';
      status.className = 'image-status status-missing';
      thumb.removeAttribute('src');
      copyBtn.disabled = true;
      copyBtn.title = '이미지 폴더를 선택해 주세요.';
    }
    imageQueue.appendChild(node);
  });

  diagrams.forEach(diagram => {
    const node = imageTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.image-index').textContent = `D${String(diagram.index).padStart(2, '0')}`;
    node.querySelector('.image-name').textContent = `Mermaid Diagram ${diagram.index}`;
    node.querySelector('.image-path').textContent = diagram.source.split('\n')[0] || 'mermaid';
    const status = node.querySelector('.image-status');
    const thumb = node.querySelector('.image-thumb');
    const copyBtn = node.querySelector('.image-copy');
    copyBtn.textContent = 'PNG 복사';

    if (diagram.ok) {
      status.textContent = 'PNG 변환 가능';
      status.className = 'image-status status-ok';
      const holder = document.createElement('div');
      holder.className = 'diagram-thumb';
      holder.innerHTML = diagram.svg;
      thumb.replaceWith(holder);
      copyBtn.addEventListener('click', async () => {
        try { await copySvgAsPng(diagram.svg); flashButton(copyBtn, 'PNG 복사'); }
        catch (err) { alert(`${err.message}\nlocalhost 또는 HTTPS 환경에서 사용해 주세요.`); }
      });
    } else {
      status.textContent = diagram.reason || '미지원 Mermaid';
      status.className = 'image-status status-missing';
      copyBtn.disabled = true;
    }
    imageQueue.appendChild(node);
  });
}

function flashButton(btn, original = '이미지 복사', success = '복사됨') {
  btn.textContent = success;
  setTimeout(() => btn.textContent = original, 1200);
}

async function copyForNaver() {
  if (!lastRender) await render();
  try {
    const html = getClipboardHtml(preview, presetSelect.value);
    const plain = preview.innerText;
    const result = await copyRichText(html, plain);
    setCopyState(result.method === 'clipboard-api' ? '복사 완료' : '복사 완료*', true);
  } catch (err) {
    setCopyState('복사 실패', false);
    alert(`${err.message}\n\nChrome에서 localhost 또는 HTTPS로 실행하면 가장 안정적입니다.`);
  }
}

function setCopyState(text, ok) {
  copyState.textContent = text;
  copyState.className = `copy-state ${ok ? 'ok' : 'fail'}`;
  setTimeout(() => { copyState.textContent = '대기'; copyState.className = 'copy-state'; }, 1800);
}

async function openMarkdownFile(file) {
  if (!file) return;
  markdownInput.value = await file.text();
  await render();
}

function insertAtCursor(text) {
  const value = String(text || '');
  const start = markdownInput.selectionStart ?? markdownInput.value.length;
  const end = markdownInput.selectionEnd ?? start;
  markdownInput.setRangeText(value, start, end, 'end');
  markdownInput.focus();
  render();
}

async function pasteFromClipboard() {
  try {
    if (!navigator.clipboard?.readText) throw new Error('이 브라우저에서는 클립보드 읽기를 지원하지 않습니다.');
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error('클립보드에 붙여넣을 텍스트가 없습니다.');
    insertAtCursor(text);
    flashButton($('#btnPaste'), '클립보드에서 붙여넣기', '붙여넣음');
  } catch (err) {
    markdownInput.focus();
    alert(`${err.message}\n\n입력창을 클릭한 뒤 Ctrl+V로 붙여넣어 주세요.`);
  }
}

function openCompare() {
  compareSource.textContent = markdownInput.value;
  compareResult.innerHTML = preview.innerHTML;
  applyPreset(compareResult);
  compareDialog.showModal();
}

markdownInput.addEventListener('input', scheduleRender);
markdownInput.addEventListener('paste', () => {
  requestAnimationFrame(() => {
    updateInputType(markdownInput.value);
  });
});
presetSelect.addEventListener('change', () => { applyPreset(preview); applyPreset(compareResult); });
tocToggle.addEventListener('change', render);
numberHeadingToggle.addEventListener('change', render);
mdFileInput.addEventListener('change', e => openMarkdownFile(e.target.files?.[0]));
imageFolderInput.addEventListener('change', e => { imageManager.setFiles(e.target.files); if (lastRender) updateImageQueue(lastRender.imageRefs, lastDiagrams); });
$('#btnCopy').addEventListener('click', copyForNaver);
btnDetails.addEventListener('click', toggleDetails);
$('#btnPaste').addEventListener('click', pasteFromClipboard);
$('#btnLoadSample').addEventListener('click', () => { markdownInput.value = sampleMarkdown; render(); });
$('#btnReset').addEventListener('click', () => { markdownInput.value = ''; imageFolderInput.value = ''; imageManager.setFiles([]); render(); });
$('#btnCompare').addEventListener('click', openCompare);
$('#btnCloseCompare').addEventListener('click', () => compareDialog.close());

['dragenter', 'dragover'].forEach(name => editorPane.addEventListener(name, e => { e.preventDefault(); editorPane.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(name => editorPane.addEventListener(name, e => { e.preventDefault(); editorPane.classList.remove('dragging'); }));
editorPane.addEventListener('drop', e => {
  const file = [...(e.dataTransfer?.files || [])].find(f => /\.(md|markdown|txt)$/i.test(f.name));
  if (file) openMarkdownFile(file);
});
compareDialog.addEventListener('click', e => {
  const rect = compareDialog.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) compareDialog.close();
});

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

markdownInput.value = '';
render();
