// services/agent/layer3ArgsService.js
const { askAI } = require('../ai');

async function extractArgs(actionDef, text, session = {}) {
  const schema = JSON.stringify(actionDef["@ArgTemp"] || {});
  const lastContext = session.lastResults ? `参考上下文（上一次查询结果）：${JSON.stringify(session.lastResults.slice(0,3))}` : '';

  const systemPrompt = `
    你是一个严格的参数提取专家。请根据用户输入，按照给定的 JSON 格式提取参数。
    
    标准 JSON 模板：
    ${schema}
    
    ${lastContext}
    
    提取规则（重要）：
    1. 严格返回 JSON 格式，不要包含任何 Markdown 标识（如 \`\`\`json）。
    2. 参数都可以为空！只有当用户明确提及参数值时，才填充对应字段。
    3. 不要推断、猜测或曲解用户的输入。比如：用户说"查询订单"不代表 keyword 是"订单"。
    4. 如果用户说"第二个"或类似指代，请结合上下文中的数据提取对应的 ID。
    5. 如果某个字段用户没有明确提及，设其为空值（字符串字段为 ""，数字字段为 0，对象为 null）。
    6. 特别注意：不要将业务流程词（如"查询"、"显示"、"搜索"）当作参数值提取。
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