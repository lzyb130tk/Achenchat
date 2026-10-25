import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { fetchModels, testApiConnection } from '../services/api.js';
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
  let testController = null;

  const screen = document.createElement('section');
  screen.className = 'screen screen--api-config';

  screen.innerHTML = `
    ${appHeader({ title: 'API 配置', backTo: '#/settings', action: '<button class="api-help" type="button" data-api-help>帮助</button>' })}
    <main class="page-scroll">
      <div class="page-content page-content--api">
        <div class="api-intro">
          <span class="api-intro__icon">${icon('plugs-connected')}</span>
          <p>连接你的模型服务。模型列表会从接口读取，不需要手动输入。</p>
        </div>
        <form class="api-form" novalidate>
          <div class="segmented api-provider" role="group" aria-label="接口格式">
            ${Object.entries(PROVIDER_DEFAULTS)
              .map(
                ([value, item]) =>
                  `<button class="segmented__item${value === provider ? ' is-selected' : ''}" type="button" data-provider="${value}">${item.label}</button>`,
              )
              .join('')}
          </div>
          <div class="api-fields">
            <label class="field">
              <span class="field__label">接口地址</span>
              <span class="field__control"><span class="api-field-icon">${icon('link-simple')}</span>
                <input class="field__input" name="baseUrl" type="url" spellcheck="false" autocomplete="off" value="${escapeHTML(api.baseUrl)}" placeholder="${PROVIDER_DEFAULTS[provider].baseUrl}">
              </span>
            </label>
            <label class="field">
              <span class="field__label">API Key</span>
              <span class="field__control"><span class="api-field-icon">${icon('lock-simple')}</span>
                <input class="field__input" name="apiKey" type="password" spellcheck="false" autocomplete="new-password" value="${escapeHTML(api.apiKey)}" placeholder="sk-…">
                <button class="field__action" type="button" aria-label="显示密钥" data-toggle-key>${icon('eye')}</button>
              </span>
            </label>
            <div class="field">
              <span class="field__label-row">
                <span class="field__label">模型</span>
                <button class="text-button text-button--small" type="button" data-refresh-models>${icon('arrows-clockwise')}<span>获取模型列表</span></button>
              </span>
              <span class="field__control field__control--select"><span class="api-field-icon">${icon('cube')}</span>
                <select class="field__input field__select" name="model" aria-label="模型" data-model-select></select>
              </span>
              <p class="field__hint" data-model-status></p>
            </div>
            <p class="api-connection" data-connection-line><span class="api-connection__dot"></span><span data-connection-status>待连接</span></p>
          </div>
          <button class="button api-form__test" type="button" data-test-connection>${icon('wifi-high')}测试连接</button>
          <button class="button button--primary api-form__submit" type="submit">保存配置</button>
          <p class="api-form__note">${icon('shield-check')}密钥仅保存在这台设备的 IndexedDB 中，不会上传到 Achat。</p>
        </form>
      </div>
    </main>`;

  const baseUrlInput = screen.querySelector('[name="baseUrl"]');
  const keyInput = screen.querySelector('[name="apiKey"]');
  const modelSelect = screen.querySelector('[data-model-select]');
  const status = screen.querySelector('[data-model-status]');
  const refreshButton = screen.querySelector('[data-refresh-models]');
  const toggleKey = screen.querySelector('[data-toggle-key]');
  const connectionLine = screen.querySelector('[data-connection-line]');
  const connectionStatus = screen.querySelector('[data-connection-status]');
  const testButton = screen.querySelector('[data-test-connection]');

  const setConnection = (message, tone = '') => {
    connectionStatus.textContent = message;
    connectionLine.dataset.tone = tone;
  };

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
    testController?.abort();
    if (loading) {
      requestController?.abort();
      loading = false;
    }
    models = [];
    selectedModel = '';
    renderModels();
    setStatus('连接信息变了，重新获取一次模型。');
    setConnection('连接信息已更改，请重新测试');
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
      setConnection(`模型列表已读取 · ${list.length} 个可用模型`, 'success');
    } catch (error) {
      if (error.name === 'AbortError') return;
      loading = false;
      renderModels();
      setStatus(error.message || '获取模型失败', 'danger');
      setConnection('连接失败，请检查配置', 'danger');
      if (announce) toast(error.message || '获取模型失败', { tone: 'danger' });
    }
  };

  renderModels();
  setConnection(api.model ? `已保存 · 上次使用 ${api.model}` : '待连接');
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
      testController?.abort();
      baseUrlInput.placeholder = PROVIDER_DEFAULTS[next].baseUrl;
      models = [];
      selectedModel = '';
      loading = false;
      requestController?.abort();
      renderModels();
      setStatus('接口格式已切换，重新获取模型列表。');
      setConnection('接口格式已切换，请重新测试');
      screen.querySelectorAll('[data-provider]').forEach((item) => {
        item.classList.toggle('is-selected', item === button);
      });
    });
  });

  baseUrlInput.addEventListener('input', invalidateModels);
  keyInput.addEventListener('input', invalidateModels);

  modelSelect.addEventListener('change', () => {
    selectedModel = modelSelect.value;
    if (selectedModel) {
      setStatus('模型已选择，别忘了保存。');
      setConnection('模型已更改，请重新测试');
    }
  });

  refreshButton.addEventListener('click', () => loadModels());

  toggleKey.addEventListener('click', () => {
    const hidden = keyInput.type === 'password';
    keyInput.type = hidden ? 'text' : 'password';
    toggleKey.innerHTML = icon(hidden ? 'eye-slash' : 'eye');
    toggleKey.setAttribute('aria-label', hidden ? '隐藏密钥' : '显示密钥');
  });

  screen.querySelector('[data-api-help]').addEventListener('click', () => {
    openSheet({
      title: 'API 配置帮助',
      content: '<p class="sheet-note">选择接口格式，填写服务地址和 API Key，再获取模型列表并选择模型。测试连接会向所选模型发送一条简短请求。连接失败时，请检查密钥、模型名称及服务是否允许浏览器跨域访问。</p>',
    });
  });

  testButton.addEventListener('click', async () => {
    const baseUrl = baseUrlInput.value.trim();
    const apiKey = keyInput.value.trim();
    const model = selectedModel.trim();
    if (!/^https?:\/\/.+/i.test(baseUrl) || !apiKey || !model) {
      toast('先填写地址、密钥并选择模型', { tone: 'danger' });
      return;
    }
    testController?.abort();
    testController = new AbortController();
    testButton.disabled = true;
    testButton.innerHTML = `${icon('arrows-clockwise')}正在测试…`;
    setConnection('正在连接所选模型…');
    try {
      await testApiConnection({ provider, baseUrl, apiKey, model }, { signal: testController.signal });
      setConnection(`连接正常 · 当前模型 ${model}`, 'success');
      toast('连接正常');
    } catch (error) {
      if (error.name !== 'AbortError') {
        setConnection(error.message || '连接失败', 'danger');
        toast(error.message || '连接失败', { tone: 'danger' });
      }
    } finally {
      testButton.disabled = false;
      testButton.innerHTML = `${icon('wifi-high')}测试连接`;
    }
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
      testController?.abort();
    },
  };
}
