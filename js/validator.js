export function validateDocument(source, renderResult) {
  const stats = renderResult.stats;
  const issues = [];

  issues.push(ok('Markdown 기본 요소', '제목, 문단, 목록, 인용문, 링크를 Rich Text로 변환합니다.'));
  issues.push(ok('코드 블록', `${stats.codeBlocks}개 코드 블록에 언어 라벨과 기본 Syntax Highlight를 적용합니다.`));

  if (stats.tables > 0) {
    const wideTables = detectWideTables(renderResult.html);
    issues.push(wideTables > 0 ? warn('넓은 표', `${wideTables}개 표가 5열 이상입니다. 모바일에서 읽기 어려울 수 있습니다.`) : ok('표', `${stats.tables}개 표를 HTML table로 변환합니다.`));
  } else issues.push(ok('표', '표가 없습니다.'));

  if (stats.images > 0) issues.push(warn('이미지 수동 삽입', `${stats.images}개 이미지는 위치 마커로 복사됩니다. 이미지 Queue에서 순서대로 붙여넣으세요.`));
  else issues.push(ok('이미지', '외부 이미지 참조가 없습니다.'));

  if (stats.mermaid > 0) issues.push(warn('Mermaid → PNG', `${stats.mermaid}개 Mermaid를 기본 Flowchart로 렌더링하고 PNG 복사 Queue를 제공합니다.`));
  else issues.push(ok('Mermaid', 'Mermaid 블록이 없습니다.'));

  const detailsCount = (source.match(/<details\b/gi) || []).length;
  if (detailsCount) issues.push(warn('HTML <details>', `${detailsCount}개 <details> 요소는 접기 UI 대신 일반 텍스트로 처리될 수 있습니다.`));

  const htmlTags = (source.match(/<([a-z][\w-]*)\b[^>]*>/gi) || []).length;
  if (htmlTags > 0) issues.push(warn('Raw HTML', `${htmlTags}개 HTML 태그가 원문에 있습니다. 안전을 위해 문자로 처리됩니다.`));

  const longLines = source.split('\n').filter(line => line.length > 220).length;
  if (longLines > 0) issues.push(warn('긴 문장/라인', `${longLines}개 라인이 220자를 넘습니다. 모바일 가독성을 확인하세요.`));

  const score = Math.max(0, 100 - issues.filter(i => i.level === 'warn').length * 8 - issues.filter(i => i.level === 'error').length * 20);
  return { score, issues };
}

export function getDiagnosticVisibility(validation, imageCount = 0, diagramCount = 0, expanded = false) {
  const hasWarning = Boolean(validation?.issues?.some(item => item.level === 'warn' || item.level === 'error'));
  const hasMedia = imageCount + diagramCount > 0;
  const showCompatibility = expanded || hasWarning;
  const showImages = expanded || hasMedia;
  return {
    showCompatibility,
    showImages,
    showPanel: showCompatibility || showImages
  };
}
function detectWideTables(html) {
  const host = document.createElement('div'); host.innerHTML = html;
  return [...host.querySelectorAll('table')].filter(t => { const row = t.querySelector('thead tr') || t.querySelector('tr'); return row ? row.children.length >= 5 : false; }).length;
}
function ok(title, desc) { return { level: 'ok', icon: '✓', title, desc }; }
function warn(title, desc) { return { level: 'warn', icon: '!', title, desc }; }
export function error(title, desc) { return { level: 'error', icon: '×', title, desc }; }
