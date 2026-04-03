// services/agent/layer3ArgsService.js
const { askAI } = require('../ai');

/**
 * 清理并验证 JSON 字符串
 */
function parseJsonSafely(jsonStr) {
  try {
    // 清理 Markdown 标记和多余空格
    const cleaned = jsonStr
      .replace(/```json\n?|```\n?/g, '')
      .replace(/\\n/g, '\n')
      .trim();
    
    // 尝试提取 JSON（防止 AI 返回多余文字）
    const jsonMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON 解析错误:', jsonStr);
    return null;
  }
}

/**
 * 从 schema 生成简化的 Prompt
 */
function generateParamPrompt(argTemp) {
  const fields = Object.entries(argTemp || {})
    .map(([key, value]) => {
      const type = typeof value === 'number' ? 'number' : 
                   Array.isArray(value) ? 'array' : 'string';
      return `  "${key}" (${type}): // 如果用户未明确提及，设为空值`;
    })
    .join('\n');
  
  return `返回 JSON 格式（只包含这些字段）：\n{\n${fields}\n}`;
}

async function extractArgs(actionDef, text, session = {}) {
  const argTemp = actionDef["@ArgTemp"] || {};
  const paramPrompt = generateParamPrompt(argTemp);
  
  // 构造更紧凑的 Prompt
  const contextInfo = session.lastResults ? 
    `上次结果（用于"第二个"等指代）：${JSON.stringify(session.lastResults.slice(0, 2))}` : '';
  
  const systemPrompt = `你是参数提取专家。根据用户输入从给定模板中提取实际参数。

${paramPrompt}

规则：
1. 只返回 JSON，不包含任何文字或 Markdown
2. 用户未明确提及的字段设为空值（字符串=""、数字=0、数组=[]）
3. 忽略这些虚词：查询、搜索、列出、显示、所有、全部、的、等等
4. 只提取具体值：人名、订单号、金额、日期等
5. 如果用户说"第二个"，从上次结果中提取对应 ID
${contextInfo ? `\n参考上下文：${contextInfo}` : ''}`;

  try {
    const aiRaw = await askAI(systemPrompt, text);
    const parsed = parseJsonSafely(aiRaw);
    
    if (!parsed) {
      console.warn('参数提取失败，使用空参数');
      // 返回空模板
      const emptyArgs = {};
      Object.keys(argTemp).forEach(key => {
        emptyArgs[key] = typeof argTemp[key] === 'number' ? 0 : 
                        Array.isArray(argTemp[key]) ? [] : '';
      });
      return emptyArgs;
    }
    
    return parsed;
  } catch (err) {
    console.error('Layer3 处理错误:', err.message);
    return {};
  }
}

module.exports = { extractArgs };