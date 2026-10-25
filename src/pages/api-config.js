import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { fetchModels } from '../services/api.js';
import { getApiConfig, saveApiConfig } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

const PROVIDER_DEFAULTS = {
  openai: {
    label: 'OpenAI 兼容',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
  },
};

export function renderApiConfig() {
  const api = getApiConfig();
  let provider = api.provider;
  let models = [];
  let selectedModel = api.model || '';
  let loading = false;
  let requestController = null;

  const screen = document.createElement('section');
  screen.className = 'screen';

  screen.innerHTML = `
    ${appHeader({ title: 'API 配置', backTo: '#/settings' })}
    <main class="page-scroll">
      <div class="page-content page-content--api">
        <div class="api-intro">
          <span class="api-intro__icon">${icon('plugs-connected')}</span>
          <p>连接你的模型服务。模型列表会从接口读取，不需要手动输入。</p>
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
          <div class="field">
            <span class="field__label-row">
              <span class="field__label">模型</span>
              <button class="text-button text-button--small" type="button" data-refresh-models>${icon('arrows-clockwise')}<span>获取列表</span></button>
            </span>
            <span class="field__control field__control--select">
              <select class="field__input field__select" name="model" aria-label="模型" data-model-select></select>
            </span>
            <p class="field__hint" data-model-status></p>
          </div>
          <button class="button button--primary api-form__submit" type="submit">保存配置</button>
          <p class="api-form__note">${icon('shield-check')}密钥仅保存在这台设备的 IndexedDB。若请求失败，请确认接口允许浏览器跨域访问。</p>
        </form>
      </div>
    </main>`;

  const baseUrlInput = screen.querySelector('[name="baseUrl"]');
  const keyInput = screen.querySelector('[name="apiKey"]');
  const modelSelect = screen.querySelector('[data-model-select]');
  const status = screen.querySelector('[data-model-status]');
  const refreshButton = screen.querySelector('[data-refresh-models]');
  const toggleKey = screen.querySelector('[data-toggle-key]');

  const renderModels = () => {
    const options = [...models];
    if (selectedModel && !options.includes(selectedModel)) options.unshift(selectedModel);
    const placeholder = loading
      ? '正在获取模型…'
      : options.length
        ? '请选择模型'
        : '先获取模型列表';
    modelSelect.innerHTML = `<option value="">${placeholder}</option>${options
      .map(
        (model) =>
          `<option value="${escapeHTML(model)}"${model === selectedModel ? ' selected' : ''}>${escapeHTML(model)}</option>`,
      )
      .join('')}`;
    modelSelect.disabled = loading || !options.length;
    refreshButton.classList.toggle('is-loading', loading);
    refreshButton.disabled = loading;
  };

  const setStatus = (message = '', tone = '') => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const invalidateModels = () => {
    if (loading) {
      requestController?.abort();
      loading = false;
    }
    models = [];
    selectedModel = '';
    renderModels();
    setStatus('连接信息变了，重新获取一次模型。');
  };

  const loadModels = async ({ announce = true } = {}) => {
    const baseUrl = baseUrlInput.value.trim();
    const apiKey = keyInput.value.trim();
    if (!/^https?:\/\/.+/i.test(baseUrl)) {
      setStatus('先填写完整的接口地址', 'danger');
      if (announce) toast('请输入完整的接口地址', { tone: 'danger' });
      return;
    }
    if (!apiKey) {
      setStatus('先填写 API Key', 'danger');
      if (announce) toast('请填写 API Key', { tone: 'danger' });
      return;
    }

    requestController?.abort();
    requestController = new AbortController();
    loading = true;
    renderModels();
    setStatus('正在从接口获取模型…');
    try {
      const list = await fetchModels(
        { provider, baseUrl, apiKey },
        { signal: requestController.signal },
      );
      models = list;
      selectedModel = list.includes(selectedModel) ? selectedModel : '';
      loading = false;
      renderModels();
      setStatus(`已获取 ${list.length} 个模型，选择一个再保存。`);
    } catch (error) {
      if (error.name === 'AbortError') return;
      loading = false;
      renderModels();
      setStatus(error.message || '获取模型失败', 'danger');
      if (announce) toast(error.message || '获取模型失败', { tone: 'danger' });
    }
  };

  renderModels();
  setStatus(
    api.model
      ? `上次使用的模型：${api.model}`
      : '填写接口地址与密钥后，获取模型列表。',
  );

  screen.querySelectorAll('[data-provider]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.provider;
      if (next === provider) return;
      const previousDefaults = PROVIDER_DEFAULTS[provider];
      if (!baseUrlInput.value.trim() || baseUrlInput.value.trim() === previousDefaults.baseUrl) {
        baseUrlInput.value = PROVIDER_DEFAULTS[next].baseUrl;
      }
      provider = next;
      baseUrlInput.placeholder = PROVIDER_DEFAULTS[next].baseUrl;
      models = [];
      selectedModel = '';
      loading = false;
      requestController?.abort();
      renderModels();
      setStatus('接口格式已切换，重新获取模型列表。');
      screen.querySelectorAll('[data-provider]').forEach((item) => {
        item.classList.toggle('is-selected', item === button);
      });
    });
  });

  baseUrlInput.addEventListener('input', invalidateModels);
  keyInput.addEventListener('input', invalidateModels);

  modelSelect.addEventListener('change', () => {
    selectedModel = modelSelect.value;
    if (selectedModel) setStatus('模型已选择，别忘了保存。');
  });

  refreshButton.addEventListener('click', () => loadModels());

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
    const model = selectedModel.trim();

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
      toast('请先获取并选择模型', { tone: 'danger' });
      if (!models.length) refreshButton.focus();
      else modelSelect.focus();
      return;
    }

    saveApiConfig({ provider, baseUrl, apiKey, model });
    toast('API 配置已保存');
    window.location.hash = '#/settings';
  });

  if (api.apiKey && /^https?:\/\//i.test(api.baseUrl)) {
    window.setTimeout(() => loadModels({ announce: false }), 120);
  }

  return {
    element: screen,
    cleanup() {
      requestController?.abort();
    },
  };
}
