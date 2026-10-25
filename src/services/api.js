import { getApiConfig } from './store.js';

export class ApiRequestError extends Error {}

function apiKeyForHeader(apiKey) {
  return apiKey.trim().replace(/^Bearer\s+/i, '');
}

function baseUrlOf(api) {
  return api.baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|messages)$/, '');
}

export function getEndpoint(api) {
  const base = baseUrlOf(api);
  if (api.provider === 'anthropic') {
    return `${base}/messages`;
  }
  return `${base}/chat/completions`;
}

export function getModelsEndpoint(api) {
  return `${baseUrlOf(api)}/models`;
}

function buildSystemPrompt(character, profile) {
  const date = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  const mask = profile.persona?.trim()
    ? `\n对方在这段关系里设定的人设是：${profile.persona.trim()}`
    : '';

  return [
    `你是${character.name}，${character.role}。${character.persona}`,
    `你正在和${profile.name}以“${character.relationship}”的关系聊天。今天是${date}。${mask}`,
    '像手机聊天一样自然回应，每次一到三句，控制在二十到八十字。',
    '可以主动关心、分享细节和轻微撒娇，但不要连续追问。',
    '不使用列表、标题或 Markdown，不写旁白动作，不提及自己是 AI 或系统提示。',
  ].join('\n');
}

function buildHistory(messages) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-24)
    .map((message) => {
      if (message.type === 'redpacket') {
        return { role: message.role, content: '[发了一个红包]' };
      }
      if (message.type === 'sticker') {
        return { role: message.role, content: '[发了一个表情]' };
      }
      return { role: message.role, content: message.content || '' };
    })
    .filter((message) => message.content);
}

function readTextContent(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => part?.text || part?.content || '')
      .filter(Boolean)
      .join('');
  }
  return '';
}

function extractDelta(payload, provider) {
  if (payload?.error) {
    throw new ApiRequestError(payload.error.message || 'API 返回了一个错误');
  }
  if (provider === 'anthropic') {
    if (payload?.type === 'content_block_delta') return payload.delta?.text || '';
    return '';
  }
  const choice = payload?.choices?.[0];
  return readTextContent(choice?.delta?.content) || readTextContent(choice?.message?.content);
}

function extractFullText(payload, provider) {
  if (provider === 'anthropic') return readTextContent(payload?.content);
  return readTextContent(payload?.choices?.[0]?.message?.content);
}

function formatHttpError(status, body) {
  if (status === 401 || status === 403) return '密钥验证失败，请检查 API Key';
  if (status === 404) return '接口地址或模型不存在，请检查配置';
  if (status === 429) return '请求太频繁，请稍后再试';
  return body?.error?.message || body?.message || `请求失败（${status}）`;
}

export async function fetchModels(api, { signal } = {}) {
  const endpoint = getModelsEndpoint(api);
  const key = apiKeyForHeader(api.apiKey);
  const isAnthropic = api.provider === 'anthropic';
  const headers = isAnthropic
    ? {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      }
    : { Authorization: `Bearer ${key}` };

  let response;
  try {
    response = await fetch(endpoint, { headers, signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiRequestError('无法获取模型列表，请检查网络或接口跨域设置');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError('模型列表返回了无法解析的内容');
  }

  if (!response.ok) {
    throw new ApiRequestError(formatHttpError(response.status, payload));
  }

  const rawList = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];
  const models = [];
  const seen = new Set();
  for (const item of rawList) {
    const id =
      typeof item === 'string'
        ? item
        : item?.id || item?.name || item?.model || item?.slug || '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(id);
  }

  if (!models.length) {
    throw new ApiRequestError('接口没有返回可用模型');
  }
  return models;
}

async function parseStream(response, provider, signal, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finished = false;

  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (payload?.type === 'error' || payload?.error) {
      throw new ApiRequestError(payload.error?.message || '生成回复时出错');
    }
    if (payload?.type === 'message_stop') finished = true;
    const delta = extractDelta(payload, provider);
    if (delta) {
      text += delta;
      onDelta(delta);
    }
  };

  while (true) {
    if (signal.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) consume(line);
    if (finished) break;
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
  return text;
}

export async function streamChat({ character, profile, messages, signal, onDelta }) {
  const api = getApiConfig();
  const endpoint = getEndpoint(api);
  const key = apiKeyForHeader(api.apiKey);
  const systemPrompt = buildSystemPrompt(character, profile);
  const history = buildHistory(messages);
  const isAnthropic = api.provider === 'anthropic';

  const headers = {
    'Content-Type': 'application/json',
    ...(isAnthropic
      ? {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }
      : { Authorization: `Bearer ${key}` }),
  };

  const body = isAnthropic
    ? {
        model: api.model.trim(),
        system: systemPrompt,
        messages: history,
        max_tokens: 600,
        stream: true,
      }
    : {
        model: api.model.trim(),
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.9,
        max_tokens: 600,
        stream: true,
      };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiRequestError('无法连接 API，请检查网络或接口跨域设置');
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON error responses still receive a status-based message.
    }
    throw new ApiRequestError(formatHttpError(response.status, payload));
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiRequestError('API 返回了无法解析的内容');
    }
    const text = extractFullText(payload, api.provider);
    if (!text) throw new ApiRequestError('API 没有返回回复内容');
    onDelta(text);
    return text;
  }

  const text = await parseStream(response, api.provider, signal, onDelta);
  if (!text) throw new ApiRequestError('API 没有返回回复内容');
  return text;
}
