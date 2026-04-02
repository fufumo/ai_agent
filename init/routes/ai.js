// services/agent/aiProvider.js
const fetch = require('node-fetch');
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'qwen2.5:3b'; // 或你正在使用的模型

async function askAI(systemPrompt, userMessage) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      options: { temperature: 0 } // 设为 0 保证输出结果稳定，不乱回复
    })
  });
  const data = await res.json();
  return data.message.content.trim();
}

module.exports = { askAI };