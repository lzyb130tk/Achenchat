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

export function isImageSource(value) {
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}
