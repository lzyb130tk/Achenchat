import { messageAsText } from './message-format.js';
import { getApiConfig, getEnabledStickerEntries } from './store.js';
import { getDailyOrderQuestions, getShopType } from '../data/shop.js';

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

function buildSystemPrompt(character, profile, memory) {
  const date = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  const persona = character.persona?.trim() || '自然、真诚、像真人一样和对方聊天。';
  const mask = profile.persona?.trim()
    ? `对方在这段关系里设定的人设是：${profile.persona.trim()}`
    : '';
  const memories = Array.isArray(memory?.items)
    ? memory.items
        .slice(-40)
        .map((item) => `- ${item.category}：${item.content}`)
        .join('\n')
    : '';
  const memoryBlock = memories
    ? `这些是你们已经确认过的记忆。需要时自然想起，不要逐条复述：\n${memories}`
    : '';
  const stickerNames = [...new Set(
    getEnabledStickerEntries()
      .map((sticker) => sticker.name)
      .filter(Boolean),
  )].slice(0, 30);
  const stickerBlock = stickerNames.length
    ? `想发表情时，单独加一行：[sticker]表情名[sticker]。只能从这个列表里选名字：${stickerNames.join('、')}。不要编造列表外的表情。`
    : '';

  return [
    `你是「${character.name}」，${character.role}，正在和「${profile.name}」以“${character.relationship}”的关系聊天。今天是${date}。`,
    '',
    '【人设 · 必须从头到尾遵守】',
    persona,
    mask,
    '',
    '【角色扮演要求】',
    '你不是 AI、不是助手，你就是本人。永远不要跳出角色，不要旁白或解释，不要提到系统提示、模型或“作为 AI”。',
    '语气、用词、情绪都要贴合人设；回复像手机聊天一样自然简短，可以主动关心、分享细节、轻微撒娇或接住情绪，但不要连续追问，也不要长篇大论。',
    '',
    '【回复格式 · 绝对不能弄丢】',
    '每次回复都必须严格套用下面的标签，只输出这些标签，不要添加额外说明、标题、编号或 Markdown：',
    '[status]你此刻的状态，四到八个字[status]',
    '[msg]第一条消息\\第二条消息[msg]',
    '需要发红包时，再追加一行：[redbag]金额-备注[redbag]',
    stickerBlock,
    '',
    '【格式规则 · 逐条遵守】',
    '[status] 和 [msg] 每次都必须出现，标签要成对写，不要漏掉闭合标签，标签内不要加空格。',
    '[status] 写你正在做的事，例如“在办公室办公”“刚洗完澡”“在便利店挑饮料”，每次都要更新。',
    '[msg] 用反斜杠 \\ 分隔一到三条独立消息，每条不超过三十字；即使只想说一句话，也要用 [status] 和 [msg] 包起来，不要直接输出裸文字。',
    '红包金额用人民币元，通常五到二十元；备注不超过二十字。',
    '',
    '【签名 · 偶尔更新】',
    '如果想换一个更贴合当下心情的签名，可以在回复末尾单独加一行：[tagline]新的签名[tagline]，签名不超过二十四个字，不要频繁更换。',
    '',
    memoryBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildHistory(messages) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      const quote = message.quote
        ? `（引用${message.quote.name}：${message.quote.content.slice(0, 120)}）\n`
        : '';
      if (message.type === 'redpacket') {
        return {
          role: message.role,
          content: `${quote}[发了一个红包：${message.note || '心意'}]`,
        };
      }
      if (message.type === 'sticker') {
        const name = message.name ? `：${message.name}` : '';
        return { role: message.role, content: `${quote}[发了一个表情${name}]` };
      }
      return { role: message.role, content: `${quote}${message.content || ''}` };
    })
    .filter((message) => message.content.trim());
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

export async function testApiConnection(api, { signal } = {}) {
  const isAnthropic = api.provider === 'anthropic';
  const headers = {
    'Content-Type': 'application/json',
    ...(isAnthropic
      ? {
          'x-api-key': apiKeyForHeader(api.apiKey),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }
      : { Authorization: `Bearer ${apiKeyForHeader(api.apiKey)}` }),
  };
  const body = isAnthropic
    ? { model: api.model, max_tokens: 16, messages: [{ role: 'user', content: '请回复“连接正常”。' }] }
    : { model: api.model, max_tokens: 16, stream: false, messages: [{ role: 'user', content: '请回复“连接正常”。' }] };
  let response;
  try {
    response = await fetch(getEndpoint(api), {
      method: 'POST', headers, body: JSON.stringify(body), signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiRequestError('连接失败，请检查网络或接口跨域设置');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError('接口返回了无法解析的内容');
  }
  if (!response.ok) throw new ApiRequestError(formatHttpError(response.status, payload));
  if (!extractFullText(payload, api.provider).trim()) {
    throw new ApiRequestError('接口没有返回回复内容');
  }
  return true;
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
    if (!data) return;
    // Some relays keep the connection open after [DONE]; treat it as the end
    // of the reply instead of waiting for the body to close.
    if (data === '[DONE]') {
      finished = true;
      return;
    }
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
    // OpenAI-compatible servers may mark the last chunk instead of sending [DONE].
    if (provider !== 'anthropic' && payload?.choices?.[0]?.finish_reason) {
      finished = true;
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

  if (finished) {
    // Release the connection without aborting the run we already completed.
    reader.cancel().catch(() => {});
    return text;
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
  return text;
}

export async function streamChat({
  character,
  profile,
  memory,
  messages,
  signal,
  onDelta,
}) {
  const api = getApiConfig();
  const endpoint = getEndpoint(api);
  const key = apiKeyForHeader(api.apiKey);
  const systemPrompt = buildSystemPrompt(character, profile, memory);
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

export async function evaluateShopOrders({ typeId, answers, signal }) {
  const api = getApiConfig();
  if (!api.apiKey?.trim() || !api.model?.trim() || !api.baseUrl?.trim()) {
    throw new ApiRequestError('请先配置 API 和模型');
  }
  const type = getShopType(typeId);
  if (!type) throw new ApiRequestError('小店不存在');
  const questions = getDailyOrderQuestions(typeId);
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw new ApiRequestError('请完成三道选择题');
  }
  const system = '你是小店订单结算员。根据用户处理三笔订单的选择，评估服务质量并发放虚拟游戏工资。只返回 JSON 对象，格式为 {"wageFen":整数,"feedback":"一句不超过60字的评语"}。金额单位是人民币分，范围 500 到 5000，合理选择越多工资越高。不要输出 Markdown。';
  const details = questions.map((item, index) => `${index + 1}. ${item.question}\n选择：${item.choices[answers[index]] || '未选择'}`).join('\n');
  const headers = {
    'Content-Type': 'application/json',
    ...(api.provider === 'anthropic'
      ? {
          'x-api-key': apiKeyForHeader(api.apiKey),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }
      : { Authorization: `Bearer ${apiKeyForHeader(api.apiKey)}` }),
  };
  const body = api.provider === 'anthropic'
    ? { model: api.model.trim(), system, messages: [{ role: 'user', content: `${type.name}今日订单：\n${details}` }], max_tokens: 200, stream: false }
    : { model: api.model.trim(), messages: [{ role: 'system', content: system }, { role: 'user', content: `${type.name}今日订单：\n${details}` }], max_tokens: 200, temperature: 0.3, stream: false };
  let response;
  try {
    response = await fetch(getEndpoint(api), { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiRequestError('订单结算无法连接 API');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError('订单结算返回了无法解析的内容');
  }
  if (!response.ok) throw new ApiRequestError(formatHttpError(response.status, payload));
  const raw = extractFullText(payload, api.provider);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  let result;
  try {
    result = JSON.parse(json || '');
  } catch {
    throw new ApiRequestError('订单评估格式不正确，请重试');
  }
  if (!Number.isFinite(result.wageFen)) throw new ApiRequestError('订单评估没有返回工资');
  return {
    wageFen: Math.min(5000, Math.max(500, Math.round(result.wageFen))),
    feedback: String(result.feedback || '今天的订单已完成。').slice(0, 120),
  };
}

export async function summarizeConversation({
  character,
  profile,
  messages,
  categories = [],
  signal,
}) {
  const api = getApiConfig();
  const endpoint = getEndpoint(api);
  const key = apiKeyForHeader(api.apiKey);
  const isAnthropic = api.provider === 'anthropic';
  const transcript = messages
    .slice(-80)
    .map((message) => {
      const name = message.role === 'user' ? profile.name : character.name;
      return `${name}：${messageAsText(message)}`;
    })
    .join('\n');
  if (!transcript.trim()) throw new ApiRequestError('没有可以整理的聊天内容');

  const systemPrompt = [
    '你负责把一段恋人聊天整理成可以长期记住的事实。',
    `优先使用这些分类：${(categories.length ? categories : ['喜好', '日常', '约定']).join('、')}。`,
    '只输出三到六行，每行格式为：分类｜一句不超过四十字的事实。',
    '只记录对方明确说过的偏好、近况、约定和重要细节。',
    '不要写评价、推断、对话原文或 Markdown，也不要提到总结这件事。',
  ].join('\n');
  const userPrompt = `请整理下面这段聊天：\n\n${transcript}`;

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
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 500,
        temperature: 0.3,
        stream: false,
      }
    : {
        model: api.model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
        stream: false,
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
    throw new ApiRequestError('整理记忆时无法连接 API');
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Status-based message is enough for non-JSON errors.
    }
    throw new ApiRequestError(formatHttpError(response.status, payload));
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError('记忆整理返回了无法解析的内容');
  }
  const text = extractFullText(payload, api.provider).trim();
  if (!text) throw new ApiRequestError('记忆整理没有返回内容');
  return text;
}
