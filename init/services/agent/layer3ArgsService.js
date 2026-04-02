// services/agent/layer3ArgsService.js
const { askAI } = require('../ai');

async function extractArgs(actionDef, text, session = {}) {
  const schema = JSON.stringify(actionDef["@ArgTemp"] || {});
  const lastContext = session.lastResults ? `参考上下文（上一次查询结果）：${JSON.stringify(session.lastResults.slice(0,3))}` : '';

  const systemPrompt = `
    你是一个数据提取专家。请根据用户输入，按照给定的 JSON 格式提取参数。
    
    标准 JSON 模板：
    ${schema}
    
    ${lastContext}
    
    要求：
    1. 严格返回 JSON 格式，不要包含任何 Markdown 标识（如 \`\`\`json）。
    2. 如果用户说“第二个”或类似指代，请结合上下文中的数据提取对应的 ID。
    3. 如果某个字段没提到，保留模板中的默认值。
  `;

  const aiRaw = await askAI(systemPrompt, text);
  
  try {
    // 简单清理可能存在的 Markdown 标签
    const cleanJson = aiRaw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("AI 返回的 JSON 格式错误:", aiRaw);
    return {};
  }
}

module.exports = { extractArgs };