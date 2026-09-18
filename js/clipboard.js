export async function copyRichText(html, plainText) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined' && window.isSecureContext) {
    const item = new ClipboardItem({
      'text/html': new Blob([wrapHtml(html)], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    return { method: 'clipboard-api' };
  }

  // file:// 환경용 fallback. 브라우저 정책에 따라 HTML 서식 보존 정도가 다를 수 있습니다.
  const sandbox = document.createElement('div');
  sandbox.contentEditable = 'true';
  sandbox.style.cssText = 'position:fixed;left:-99999px;top:0;opacity:0;pointer-events:none;';
  sandbox.innerHTML = html;
  document.body.appendChild(sandbox);

  const range = document.createRange();
  range.selectNodeContents(sandbox);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const ok = document.execCommand('copy');
  selection.removeAllRanges();
  sandbox.remove();

  if (!ok) throw new Error('클립보드 복사에 실패했습니다. localhost 또는 HTTPS로 실행해 주세요.');
  return { method: 'execCommand' };
}

function wrapHtml(body) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
}
