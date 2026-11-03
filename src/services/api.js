import { messageAsText } from './message-format.js';
import { getApiConfig, getEnabledStickerEntries, getImageRecord } from './store.js';
import { blobToDataUrl } from './image.js';
import { buildTimeAwarenessBlock } from './time-awareness.js';
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

function buildSystemPrompt(character, profile, memory, ambient) {
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
  const preferences = Array.isArray(memory?.preferences)
    ? memory.preferences
        .slice(-40)
        .map((item) => `- ${item.content}`)
        .join('\n')
    : '';
  const preferenceBlock = preferences
    ? `【关于对方 · 长期记忆】\n这些是你平时悄悄记住的、关于对方的小事。聊天时自然想起就好，不要逐条复述，也不要提到“记忆”“系统”这样的词：\n${preferences}`
    : '';
  const timeBlock = buildTimeAwarenessBlock(ambient);
  const stickerNames = [...new Set(
    getEnabledStickerEntries()
      .map((sticker) => sticker.name)
      .filter(Boolean),
  )].slice(0, 30);
  const stickerBlock = stickerNames.length
    ? `想发表情时，单独加一行：[sticker]表情名[sticker]。只能从这个列表里选名字：${stickerNames.join('、')}。不要编造列表外的表情。`
    : '';
  // Tapbacks and quote replies are chance events, not a fixed part of every
  // reply. Rolling here keeps the feature occasional instead of trusting the
  // model to remember "sometimes".
  const allowReactions = Math.random() < 0.35;
  const allowQuote = Math.random() < 0.3;
  const reactionBlock = [
    allowReactions
      ? [
          '【贴表情 · 本轮可以，但只在你真的想贴时】',
          '你可以像 iMessage 一样，给「对方之前发过的消息」贴一个 emoji。想贴时单独写一行：',
          '[emoji]对方消息的原文-👍:另一条消息原文-🤣[emoji]',
          '消息原文和 emoji 之间用 - 连接，多条之间用英文冒号 : 隔开，一次最多贴三条。emoji 由你根据当下的语气自己挑，不要照抄对方用过的。消息原文要尽量逐字照抄对方发过的那句话，方便对上。',
          '贴表情的位置要符合你真实的表达顺序：先想贴就写在前面，后想贴就写在后面。',
        ].join('\n')
      : '【贴表情】本轮不要输出任何 [emoji] 标签。',
    '聊天记录里如果出现「对方给这条消息贴了…」的说明，那就是对方用 emoji 回应了你或对方之前说的话，你自然知道就好，不要复述这条说明。',
  ].join('\n');
  const quoteBlock = [
    allowQuote
      ? [
          '【引用回复 · 本轮可以，但只在真的想接某句话时】',
          '想引用对方的某条消息再回应时，单独写一行：[repo]对方消息的原文[repo]，紧接着用 [msg]你的回复[msg]。',
          '引用和回复必须用各自的标签分开，禁止把 [msg] 写进 [repo] 里，也禁止任何嵌套。',
        ].join('\n')
      : '【引用回复】本轮不要输出任何 [repo] 标签。',
  ].join('\n');

  return [
    `你是「${character.name}」，${character.role}，正在和「${profile.name}」以“${character.relationship}”的关系聊天。今天是${date}。`,
    timeBlock,
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
    reactionBlock,
    quoteBlock,
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
    preferenceBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

async function imageContentPart(imageRef, provider) {
  const record = await getImageRecord(imageRef.id);
  if (!record?.blob) return null;
  const dataUrl = await blobToDataUrl(record.blob);
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) return null;
  if (provider === 'anthropic') {
    return {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
    };
  }
  return { type: 'image_url', image_url: { url: dataUrl } };
}

function reactionNote(message) {
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const emojis = reactions
    .filter((reaction) => reaction.by === 'user' && reaction.emoji)
    .map((reaction) => reaction.emoji);
  return emojis.length ? `（对方给这条消息贴了 ${emojis.join(' ')}）\n` : '';
}

async function buildHistory(messages, provider) {
  const history = [];
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const quote = message.quote
      ? `（引用${message.quote.name}：${message.quote.content.slice(0, 120)}）\n`
      : '';
    const reactions = reactionNote(message);
    if (message.type === 'image') {
      const parts = [];
      if (quote.trim()) parts.push({ type: 'text', text: quote.trim() });
      if (reactions.trim()) parts.push({ type: 'text', text: reactions.trim() });
      let hasImage = false;
      for (const image of message.images || []) {
        const part = await imageContentPart(image, provider);
        if (part) {
          parts.push(part);
          hasImage = true;
        }
      }
      if (!hasImage) {
        history.push({
          role: message.role,
          content: `${quote}${reactions}${message.content?.trim() || '[图片]'}`,
        });
        continue;
      }
      if (message.content?.trim()) {
        parts.push({ type: 'text', text: message.content.trim().slice(0, 500) });
      }
      history.push({ role: message.role, content: parts });
      continue;
    }
    if (message.type === 'redpacket') {
      history.push({
        role: message.role,
        content: `${quote}${reactions}[发了一个红包：${message.note || '心意'}]`,
      });
      continue;
    }
    if (message.type === 'sticker') {
      const name = message.name ? `：${message.name}` : '';
      history.push({
        role: message.role,
        content: `${quote}${reactions}[发了一个表情${name}]`,
      });
      continue;
    }
    const content = `${quote}${reactions}${message.content || ''}`;
    if (content.trim()) history.push({ role: message.role, content });
  }
  return history;
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
  ambient = null,
  signal,
  onDelta,
}) {
  const api = getApiConfig();
  const endpoint = getEndpoint(api);
  const key = apiKeyForHeader(api.apiKey);
  const systemPrompt = buildSystemPrompt(character, profile, memory, ambient);
  const isAnthropic = api.provider === 'anthropic';
  const history = await buildHistory(messages, api.provider);

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

export function parsePreferenceResponse(text) {
  const raw = String(text || '').trim();
  let items = [];
  let parsedJson = false;
  const json = raw.match(/\[[\s\S]*\]/)?.[0] || raw.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json);
      items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.preferences)
          ? parsed.preferences
          : Array.isArray(parsed?.items)
            ? parsed.items
            : [];
      parsedJson = true;
    } catch {
      parsedJson = false;
    }
  }
  if (!parsedJson) {
    items = raw
      .replace(/```[a-z]*|```/gi, '')
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.、\s]+/, '').trim())
      .filter(
        (line) =>
          line &&
          line.length <= 60 &&
          !/[:：]$/.test(line) &&
          !/json/i.test(line),
      );
  }
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = String(
      typeof item === 'string'
        ? item
        : item?.content || item?.text || item?.preference || '',
    )
      .trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .slice(0, 60);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= 5) break;
  }
  return result;
}

/**
 * 从最近的聊天里提取「关于对方」的长期偏好。返回短句数组，
 * 由调用方负责去重、入库和推进检查点。
 */
export async function extractPreferences({
  character,
  profile,
  messages,
  existing = [],
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
    .filter((line) => line.trim())
    .join('\n');
  if (!transcript.trim()) throw new ApiRequestError('没有可以整理的聊天内容');

  const systemPrompt = [
    '你负责在一段恋人聊天里，悄悄整理「对方」的长期偏好和小习惯。',
    '只记录对方明确表达过、以后仍然可能有用的信息，例如喜欢的食物、讨厌的东西、喜欢的天气、作息、怕冷怕热、在意的小事。',
    '不要记录一次性安排、临时情绪、对 AI 的夸奖或你的推测。',
    '每条是不超过三十字的短句，直接陈述，例如“讨厌吃香菜”“喜欢下雨天”“习惯凌晨才睡”。',
    '只输出 JSON 字符串数组，最多五条；没有新的、值得记住的内容时输出 []。不要输出 Markdown 或任何解释。',
  ].join('\n');
  const remembered = existing
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(-30);
  const userPrompt = [
    remembered.length
      ? `已经记住的，不要重复：\n${remembered.map((item) => `- ${item}`).join('\n')}`
      : '',
    `请从下面这段聊天里提取关于对方的长期偏好：\n\n${transcript}`,
  ]
    .filter(Boolean)
    .join('\n\n');

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
        max_tokens: 300,
        temperature: 0.2,
        stream: false,
      }
    : {
        model: api.model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.2,
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
    throw new ApiRequestError('整理偏好时无法连接 API');
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
    throw new ApiRequestError('偏好整理返回了无法解析的内容');
  }
  const text = extractFullText(payload, api.provider).trim();
  if (!text) throw new ApiRequestError('偏好整理没有返回内容');
  return parsePreferenceResponse(text);
}
