import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { readImageFile } from '../services/image.js';
import { addStickerPack } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

export function renderStickerNew({ focusLinks = false } = {}) {
  const screen = document.createElement('section');
  screen.className = 'screen screen--sticker-new';
  let step = 1;
  let name = '';
  let urlText = '';
  let localImages = [];
  let items = [];

  const paint = () => {
    screen.innerHTML = `
      <header class="sticker-new__header">
        <button class="icon-button" type="button" data-sticker-back aria-label="返回">${icon('arrow-left')}</button>
        <h1>新建表情包</h1>
        <span>${step}/2</span>
      </header>
      <main class="page-scroll">
        <div class="page-content sticker-new__content">
          ${step === 1 ? `
            <div class="sticker-new__intro">
              <div class="sticker-new__art"><span></span><img src="src/assets/sticker-cat.png" alt="可爱猫咪表情示意"></div>
              <h2>用图片做一套表情</h2>
              <p>AI 会按名字和文字理解图片，用在合适的对话里。</p>
            </div>
            <div class="sticker-new__form">
              <label class="field"><span class="field__label">名称</span><span class="field__control"><input class="field__input" name="packName" maxlength="20" value="${escapeHTML(name)}" placeholder="例如：猫猫日常"></span></label>
              <label class="field"><span class="field__label">图片链接</span><span class="field__control field__control--area"><textarea class="field__input field__textarea" name="packUrls" rows="6" spellcheck="false" placeholder="https://example.com/1.png&#10;https://example.com/2.png">${escapeHTML(urlText)}</textarea></span></label>
              <p class="sticker-new__hint">${icon('info')}支持 http 或 https 图片地址 · 每行一个</p>
              <button class="sticker-new__upload" type="button" data-upload-stickers>${icon('image')}从相册选择</button>
              <input type="file" accept="image/*" multiple data-sticker-files hidden>
              ${localImages.length ? `<p class="sticker-new__selected">已从相册选择 ${localImages.length} 张图片</p>` : ''}
            </div>` : `
            <div class="sticker-new__intro sticker-new__intro--small"><h2>给每张表情起名</h2><p>名字会帮助 AI 理解和选用这张图。</p></div>
            <div class="sticker-new__names">${items.map((item, index) => `<label class="sticker-new__name-row"><img src="${escapeHTML(item.url)}" alt=""><input type="text" maxlength="20" data-item-name="${index}" value="${escapeHTML(item.name)}" aria-label="第 ${index + 1} 张表情的名字"></label>`).join('')}</div>`}
        </div>
      </main>
      <div class="sticker-new__footer"><button class="button button--primary" type="button" data-sticker-next>${step === 1 ? '下一步' : '添加表情包'}</button></div>`;
    screen.querySelector('[data-sticker-back]').addEventListener('click', () => {
      if (step === 2) {
        items = items.map((item, index) => ({ ...item, name: screen.querySelector(`[data-item-name="${index}"]`).value.trim() }));
        step = 1;
        paint();
      }
      else window.location.hash = '#/stickers';
    });
    if (step === 1) {
      const fileInput = screen.querySelector('[data-sticker-files]');
      screen.querySelector('[data-upload-stickers]').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const files = [...(fileInput.files || [])].slice(0, 20 - localImages.length);
        if (!files.length) return;
        try {
          for (const file of files) localImages.push(await readImageFile(file, { maxSize: 512, quality: 0.82 }));
          name = screen.querySelector('[name="packName"]').value;
          urlText = screen.querySelector('[name="packUrls"]').value;
          paint();
        } catch (error) {
          toast(error.message || '图片读取失败', { tone: 'danger' });
        }
      });
      screen.querySelector('[data-sticker-next]').addEventListener('click', () => {
        name = screen.querySelector('[name="packName"]').value.trim();
        urlText = screen.querySelector('[name="packUrls"]').value;
        const urls = [...new Set(urlText.split(/\s+/).map((url) => url.trim()).filter(Boolean))];
        if (!name) { toast('先给表情包起个名字', { tone: 'danger' }); return; }
        if (!urls.length && !localImages.length) { toast('请添加至少一张图片', { tone: 'danger' }); return; }
        if (urls.some((url) => !/^https?:\/\//i.test(url))) { toast('图片链接需要以 http 或 https 开头', { tone: 'danger' }); return; }
        const previousNames = new Map(items.map((item) => [item.url, item.name]));
        items = [...urls, ...localImages].slice(0, 30).map((url, index) => ({ url, name: previousNames.get(url) || `表情 ${index + 1}` }));
        step = 2;
        paint();
      });
    } else {
      screen.querySelector('[data-sticker-next]').addEventListener('click', () => {
        items = items.map((item, index) => ({ ...item, name: screen.querySelector(`[data-item-name="${index}"]`).value.trim() }));
        if (items.some((item) => !item.name)) { toast('每张表情都需要名字', { tone: 'danger' }); return; }
        const saved = addStickerPack({ name, items });
        if (!saved) { toast('表情包保存失败', { tone: 'danger' }); return; }
        toast('表情包已添加');
        window.location.hash = '#/stickers';
      });
    }
  };
  paint();
  if (focusLinks) requestAnimationFrame(() => screen.querySelector('[name="packUrls"]')?.focus({ preventScroll: true }));
  return { element: screen };
}
