const Router = require('koa-router');
const fetch = require('node-fetch');

const router = new Router();

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'qwen2.5:3b';

// 检测模型
router.get('/ping', async (ctx) => {
  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'user', content: '你好' }
        ],
        stream: false,
        options: {
          num_predict: 1
        }
      })
    });

    const data = await res.json();

    ctx.body = {
      ok: true,
      model: MODEL,
      reply: data?.message?.content || ''
    };
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      ok: false,
      error: err.message
    };
  }
});

// 聊天接口
router.post('/chat', async (ctx) => {
  try {
    const { message, history = [], systemPrompt = '' } = ctx.request.body || {};

    if (!message || !String(message).trim()) {
      ctx.status = 400;
      ctx.body = { error: 'message不能为空' };
      return;
    }

    const messages = [];

    if (systemPrompt && String(systemPrompt).trim()) {
      messages.push({
        role: 'system',
        content: String(systemPrompt).trim()
      });
    }

    history.slice(-10).forEach(item => {
      if (
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string'
      ) {
        messages.push({
          role: item.role,
          content: item.content
        });
      }
    });

    messages.push({
      role: 'user',
      content: String(message).trim()
    });

    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.2
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      ctx.status = 500;
      ctx.body = {
        error: data?.error || 'Ollama调用失败',
        raw: data
      };
      return;
    }

    ctx.body = {
      reply: data?.message?.content || '',
      usage: {
        prompt_eval_count: data?.prompt_eval_count || 0,
        eval_count: data?.eval_count || 0,
        total_duration: data?.total_duration || 0
      }
    };
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      error: err.message
    };
  }
});

module.exports = router;