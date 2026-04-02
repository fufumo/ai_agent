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
    
    参数提取规则（必须遵守）：
    1. 严格返回 JSON 格式，不要包含任何 Markdown 标识（如 \`\`\`json）。
    2. 所有参数都可以为空！只有用户明确给出具体的搜索值时，才填充对应字段。
    3. 特别警告：这些词汇是业务流程词，不是参数值，必须忽略：
       - "查询"、"搜索"、"显示"、"列出"、"获取"、"找" （动词）
       - "订单"、"用户"、"产品" （业务实体，不是搜索关键词）
       - "所有"、"全部" （量词，表示无条件查询）
       - "的" （虚词）
    4. 参数填充案例：
       - 用户说"查询订单" → keyword = ""（空），这是查询所有，订单是实体而非搜索词
       - 用户说"查询所有订单" → keyword = ""（空），"所有" 表示无条件查询
       - 用户说"查询客户王五的订单" → keyword = "王五"（具体的人名）
       - 用户说"搜索订单号 ORD-123" → keyword = "ORD-123"（具体的订单号）
       - 用户说"找一个待处理的订单" → keyword = ""，mark = 1（状态明确，但没有搜索词）
    5. 如果用户说"第二个"或类似指代，请结合上下文中的数据提取对应的 ID。
    6. 如果某个字段用户没有明确提及，设其为空值（字符串字段为 ""，数字字段为 0）。
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