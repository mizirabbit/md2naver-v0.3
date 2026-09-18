export class ImageManager {
  constructor() {
    this.files = [];
    this.map = new Map();
  }

  setFiles(fileList) {
    this.files = [...(fileList || [])];
    this.map.clear();

    for (const file of this.files) {
      const rel = normalizePath(file.webkitRelativePath || file.name);
      const name = normalizePath(file.name);
      this.map.set(rel.toLowerCase(), file);
      this.map.set(name.toLowerCase(), file);
      const strippedRoot = rel.includes('/') ? rel.split('/').slice(1).join('/') : rel;
      this.map.set(strippedRoot.toLowerCase(), file);
    }
  }

  resolve(path) {
    if (!path) return null;
    let normalized = normalizePath(path)
      .replace(/^\.\//, '')
      .replace(/^\//, '');

    const clean = decodeURIComponentSafe(normalized).split(/[?#]/)[0];
    const direct = this.map.get(clean.toLowerCase());
    if (direct) return direct;

    const basename = clean.split('/').pop();
    return this.map.get((basename || '').toLowerCase()) || null;
  }

  createEntries(imageRefs) {
    return imageRefs.map(ref => ({ ...ref, file: this.resolve(ref.src) }));
  }
}

export function fileToObjectUrl(file) {
  return file ? URL.createObjectURL(file) : '';
}

export async function copyImageFile(file) {
  if (!file) throw new Error('연결된 이미지 파일이 없습니다.');
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('이 브라우저에서는 이미지 Clipboard API를 사용할 수 없습니다.');
  }

  let blob = file;
  if (!['image/png'].includes(file.type)) {
    blob = await convertToPng(file);
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

async function convertToPng(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 변환 실패')), 'image/png');
  });
}

function normalizePath(value = '') {
  return String(value).replaceAll('\\', '/').replace(/\/+/g, '/');
}
function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}
