import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { getApiConfig, saveApiConfig } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

const PROVIDER_DEFAULTS = {
  openai: {
    label: 'OpenAI 兼容',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5-5',
  },
};

export function renderApiConfig() {
  const api = getApiConfig();
  let provider = api.provider;
  const screen = document.createElement('section');
  screen.className = 'screen';

  screen.innerHTML = `
    ${appHeader({ title: 'API 配置', backTo: '#/settings' })}
    <main class="page-scroll">
      <div class="page-content page-content--api">
        <div class="api-intro">
          <span class="api-intro__icon">${icon('plugs-connected')}</span>
          <p>连接你的模型服务，让对话真正发生。</p>
        </div>
        <form class="api-form" novalidate>
          <div class="field">
            <span class="field__label">接口格式</span>
            <div class="segmented" role="group" aria-label="接口格式">
              ${Object.entries(PROVIDER_DEFAULTS)
                .map(
                  ([value, item]) =>
                    `<button class="segmented__item${value === provider ? ' is-selected' : ''}" type="button" data-provider="${value}">${item.label}</button>`,
                )
                .join('')}
            </div>
          </div>
          <label class="field">
            <span class="field__label">接口地址</span>
            <span class="field__control">
              <input class="field__input" name="baseUrl" type="url" spellcheck="false" autocomplete="off" value="${escapeHTML(api.baseUrl)}" placeholder="${PROVIDER_DEFAULTS[provider].baseUrl}">
            </span>
          </label>
          <label class="field">
            <span class="field__label">API Key</span>
            <span class="field__control">
              <input class="field__input" name="apiKey" type="password" spellcheck="false" autocomplete="new-password" value="${escapeHTML(api.apiKey)}" placeholder="sk-…">
              <button class="field__action" type="button" aria-label="显示密钥" data-toggle-key>${icon('eye')}</button>
            </span>
          </label>
          <label class="field">
            <span class="field__label">模型</span>
            <span class="field__control">
              <input class="field__input" name="model" type="text" spellcheck="false" autocomplete="off" value="${escapeHTML(api.model)}" placeholder="${PROVIDER_DEFAULTS[provider].model}">
            </span>
          </label>
          <button class="button button--primary api-form__submit" type="submit">保存配置</button>
          <p class="api-form__note">${icon('shield-check')}密钥仅保存在这台设备。若请求失败，请确认接口允许浏览器跨域访问。</p>
        </form>
      </div>
    </main>`;

  const baseUrlInput = screen.querySelector('[name="baseUrl"]');
  const modelInput = screen.querySelector('[name="model"]');
  const keyInput = screen.querySelector('[name="apiKey"]');
  const toggleKey = screen.querySelector('[data-toggle-key]');

  screen.querySelectorAll('[data-provider]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.provider;
      if (next === provider) return;
      const previousDefaults = PROVIDER_DEFAULTS[provider];
      if (!baseUrlInput.value.trim() || baseUrlInput.value.trim() === previousDefaults.baseUrl) {
        baseUrlInput.value = PROVIDER_DEFAULTS[next].baseUrl;
      }
      if (!modelInput.value.trim() || modelInput.value.trim() === previousDefaults.model) {
        modelInput.value = PROVIDER_DEFAULTS[next].model;
      }
      provider = next;
      baseUrlInput.placeholder = PROVIDER_DEFAULTS[next].baseUrl;
      modelInput.placeholder = PROVIDER_DEFAULTS[next].model;
      screen.querySelectorAll('[data-provider]').forEach((item) => {
        item.classList.toggle('is-selected', item === button);
      });
    });
  });

  toggleKey.addEventListener('click', () => {
    const hidden = keyInput.type === 'password';
    keyInput.type = hidden ? 'text' : 'password';
    toggleKey.innerHTML = icon(hidden ? 'eye-slash' : 'eye');
    toggleKey.setAttribute('aria-label', hidden ? '隐藏密钥' : '显示密钥');
  });

  screen.querySelector('.api-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const baseUrl = baseUrlInput.value.trim();
    const apiKey = keyInput.value.trim();
    const model = modelInput.value.trim();

    if (!/^https?:\/\/.+/i.test(baseUrl)) {
      toast('请输入完整的接口地址', { tone: 'danger' });
      baseUrlInput.focus();
      return;
    }
    if (!apiKey) {
      toast('请填写 API Key', { tone: 'danger' });
      keyInput.focus();
      return;
    }
    if (!model) {
      toast('请填写模型名称', { tone: 'danger' });
      modelInput.focus();
      return;
    }

    saveApiConfig({ provider, baseUrl, apiKey, model });
    toast('API 配置已保存');
    window.location.hash = '#/settings';
  });

  return { element: screen };
}
