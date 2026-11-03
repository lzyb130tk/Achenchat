const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('这张图片无法读取'));
    };
    image.src = url;
  });
}

export async function readImageFile(file, { maxSize = 640, quality = 0.86 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('图片不能超过 12MB');

  const image = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function measureDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => reject(new Error('这张图片无法读取'));
    image.src = dataUrl;
  });
}

export function isImageSource(value) {
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}

export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!match) throw new Error('图片数据格式不正确');
  const mime = match[1] || 'image/jpeg';
  const binary = match[2]
    ? atob(match[3])
    : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

export async function readChatImage(file) {
  const dataUrl = await readImageFile(file, { maxSize: 1280, quality: 0.82 });
  const { width, height } = await measureDataUrl(dataUrl);
  return {
    dataUrl,
    blob: dataUrlToBlob(dataUrl),
    width,
    height,
  };
}
