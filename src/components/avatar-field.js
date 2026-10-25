import { readImageFile } from '../services/image.js';
import { escapeHTML } from '../services/utils.js';
import { avatar } from './avatar.js';
import { icon } from './icons.js';
import { toast } from './toast.js';

export function avatarField({ mark, name, tone = 'ink' }) {
  return `<div class="avatar-field" data-avatar-field>
    <div class="avatar-field__preview" data-avatar-preview></div>
    <div class="avatar-field__actions">
      <button class="small-button" type="button" data-avatar-upload>${icon('camera-plus')}<span>上传</span></button>
      <button class="small-button" type="button" data-avatar-url-toggle>${icon('link-simple')}<span>链接</span></button>
      <button class="small-button small-button--muted" type="button" data-avatar-clear hidden>${icon('trash-simple')}<span>移除</span></button>
    </div>
    <input type="file" accept="image/*" data-avatar-file hidden>
    <label class="field avatar-field__url" data-avatar-url-wrap hidden>
      <span class="field__label">头像链接</span>
      <span class="field__control">
        <input class="field__input" type="url" inputmode="url" spellcheck="false" autocomplete="off" placeholder="https://…" data-avatar-url>
      </span>
    </label>
  </div>`;
}

export function setupAvatarField(root, { initial = '', mark, name, tone = 'ink' }) {
  const field = root.querySelector('[data-avatar-field]');
  if (!field) return { getValue: () => initial };

  let value = initial;
  const preview = field.querySelector('[data-avatar-preview]');
  const fileInput = field.querySelector('[data-avatar-file]');
  const urlWrap = field.querySelector('[data-avatar-url-wrap]');
  const urlInput = field.querySelector('[data-avatar-url]');
  const clearButton = field.querySelector('[data-avatar-clear]');

  const paint = () => {
    const isRemote = /^https?:\/\//i.test(value);
    preview.innerHTML = avatar({
      mark,
      name,
      tone,
      size: '2xl',
      src: value && (isRemote || value.startsWith('data:image/')) ? value : '',
    });
    clearButton.hidden = !value;
  };

  if (/^https?:\/\//i.test(value)) {
    urlWrap.hidden = false;
    urlInput.value = value;
  }
  paint();

  field.querySelector('[data-avatar-upload]').addEventListener('click', () => fileInput.click());
  field.querySelector('[data-avatar-url-toggle]').addEventListener('click', () => {
    urlWrap.hidden = !urlWrap.hidden;
    if (!urlWrap.hidden) {
      if (/^https?:\/\//i.test(value)) urlInput.value = value;
      window.setTimeout(() => urlInput.focus(), 80);
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      value = await readImageFile(file, { maxSize: 512, quality: 0.87 });
      paint();
    } catch (error) {
      toast(error.message || '图片读取失败', { tone: 'danger' });
    } finally {
      fileInput.value = '';
    }
  });

  urlInput.addEventListener('input', () => {
    const next = urlInput.value.trim();
    if (!next) {
      value = '';
      paint();
      return;
    }
    if (/^https?:\/\//i.test(next) || next.startsWith('data:image/')) {
      value = next;
      paint();
      if (!urlWrap.hidden && document.activeElement !== urlInput) urlInput.value = next;
    }
  });

  clearButton.addEventListener('click', () => {
    value = '';
    urlInput.value = '';
    urlWrap.hidden = true;
    paint();
  });

  return {
    getValue: () => value,
    setValue(next) {
      value = next;
      paint();
    },
  };
}
