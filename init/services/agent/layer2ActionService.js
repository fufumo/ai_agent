// services/agent/layer2ActionService.js
const { askAI } = require('../ai');

/**
 * 从 @Action 和 @Desc 中提取关键词用于模糊匹配
 */
function buildActionKeywords(actions) {
  const keywords = new Map();
  
  Object.entries(actions).forEach(([key, action]) => {
    const actionTags = (action["@Action"] || '').split('，');
    const desc = action["@Desc"] || '';
    
    // 存储主键
    keywords.set(key.toLowerCase(), key);
    
    // 存储所有别名
    actionTags.forEach(tag => {
      const normalized = tag.trim().toLowerCase();
      if (normalized) {
        keywords.set(normalized, key);
      }
    });
    
    // 从描述中提取简单关键词
    const descKeywords = desc.match(/[^、。，]+/g) || [];
    descKeywords.slice(0, 3).forEach(kw => {
      const normalized = kw.trim().toLowerCase();
      if (normalized.length > 0 && normalized.length < 10) {
        keywords.set(normalized, key);
      }
    });
  });
  
  return keywords;
}

/**
 * 模糊匹配动作
 */
function fuzzyMatchAction(text, keywords) {
  const normalizedText = text.toLowerCase();
  
  // 精确匹配
  if (keywords.has(normalizedText)) {
    return keywords.get(normalizedText);
  }
  
  // 包含匹配
  for (const [key, actionKey] of keywords) {
    if (normalizedText.includes(key)) {
      return actionKey;
    }
  }
  
  return null;
}

async function detectAction(plugin, text) {
  const actions = plugin.actions;
  const keywords = buildActionKeywords(actions);
  
  // 先尝试快速的模糊匹配
  const fuzzyKey = fuzzyMatchAction(text, keywords);
  if (fuzzyKey && actions[fuzzyKey]) {
    return { action: fuzzyKey, actionDef: actions[fuzzyKey] };
  }
  
  // 如果快速匹配失败，调用 AI
  const actionInfo = Object.keys(actions)
    .map(k => `${k}(${actions[k]["@Action"]}): ${actions[k]["@Desc"]}`)
    .join('\n');

  const systemPrompt = `在"${plugin["@Module"]}"模块中选择最匹配的操作，只返回操作的 Key（如 list、update、create），不要其他内容。
操作列表：
${actionInfo}`;

  try {
    const actionKey = await askAI(systemPrompt, text);
    const normalized = actionKey.trim().toLowerCase();
    
    // 尝试精确和模糊匹配
    if (actions[normalized]) {
      return { action: normalized, actionDef: actions[normalized] };
    }
    
    for (const key of Object.keys(actions)) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return { action: key, actionDef: actions[key] };
      }
    }
  } catch (err) {
    console.error('Layer2 AI Error:', err.message);
  }
  
  return null;
}
module.exports = { detectAction };