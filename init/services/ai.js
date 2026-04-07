const fetch = require('node-fetch');
const crypto = require('crypto');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

const CACHE_DURATION = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 60 * 1000;
const MAX_CACHE_SIZE = 500;

const aiCache = new Map();

function generateCacheKey(systemPrompt, userMessage, extra = '') {
  const raw = JSON.stringify({
    systemPrompt: systemPrompt || '',
    userMessage: userMessage || '',
    extra: extra || '',
    model: MODEL
  });

  return crypto.createHash('md5').update(raw).digest('hex');
}

function getCache(key) {
  const cached = aiCache.get(key);
  if (!cached) return null;

  if ((Date.now() - cached.time) > CACHE_DURATION) {
    aiCache.delete(key);
    return null;
  }

  return cached.result;
}

function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of aiCache.entries()) {
    if ((now - value.time) > CACHE_DURATION) {
      aiCache.delete(key);
    }
  }
}

function setCache(key, result) {
  if (aiCache.size >= MAX_CACHE_SIZE) {
    clearExpiredCache();

    if (aiCache.size >= MAX_CACHE_SIZE) {
      const firstKey = aiCache.keys().next().value;
      if (firstKey) aiCache.delete(firstKey);
    }
  }

  aiCache.set(key, {
    result,
    time: Date.now()
  });
}

function extractContent(data) {
  if (!data) return '';

  if (data.message && typeof data.message.content === 'string') {
    return data.message.content.trim();
  }

  if (typeof data.response === 'string') {
    return data.response.trim();
  }

  return '';
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function askAI(systemPrompt, userMessage, options = {}) {
  const {
    trace = 'default',
    temperature = 0,
    useCache = true
  } = options;

  const cacheKey = generateCacheKey(systemPrompt, userMessage, trace);

  if (useCache) {
    const cached = getCache(cacheKey);
    if (cached !== null) {
      console.log(`[AI][${trace}] 缓存命中`);
      return cached;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: userMessage || '' }
        ],
        stream: false,
        options: { temperature }
      })
    });

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new Error(`Ollama请求失败: HTTP ${res.status} ${res.statusText} ${text}`);
    }

    const data = await res.json();
    const result = extractContent(data);

    if (!result) {
      throw new Error('Ollama返回内容为空或结构异常');
    }

    if (useCache) {
      setCache(cacheKey, result);
    }

    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`[AI][${trace}] 请求超时，超过 ${REQUEST_TIMEOUT / 1000} 秒`);
    }

    throw new Error(`[AI][${trace}] 调用失败: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function askAIForJSON(systemPrompt, userMessage, options = {}) {
  return await askAI(systemPrompt, userMessage, {
    ...options,
    temperature: 0
  });
}

function clearAICache() {
  aiCache.clear();
}

function getAICacheSize() {
  return aiCache.size;
}

module.exports = {
  askAI,
  askAIForJSON,
  clearAICache,
  getAICacheSize
};