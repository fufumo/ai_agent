// services/agent/layer1CategoryService.js
const { askAI } = require('../ai');

// 缓存插件映射表
let cachedPluginMap = null;
let cachedPluginInfo = null;

/**
 * 构建插件映射表（模块名 -> 插件），支持模糊匹配
 */
function buildPluginMap(plugins) {
  if (cachedPluginMap && cachedPluginInfo) {
    return { map: cachedPluginMap, info: cachedPluginInfo };
  }

  const map = new Map();
  const keywords = [];

  plugins.forEach(p => {
    const module = p["@Module"];
    const desc = p["@Desc"];
    
    // 存储原始模块和别名（支持中文、英文混合）
    map.set(module.toLowerCase(), p);
    
    // 从描述中提取关键词作为别名
    const aliases = desc.split('、').filter(Boolean);
    aliases.forEach(alias => {
      const key = alias.trim().toLowerCase();
      if (key.length > 0) {
        map.set(key, p);
      }
    });

    keywords.push(`- ${module}: ${desc}`);
  });

  cachedPluginMap = map;
  cachedPluginInfo = keywords.join('\n');
  
  return { map, info: cachedPluginInfo };
}

/**
 * 模糊匹配模块名
 */
function fuzzyMatchPlugin(text, pluginMap) {
  const normalizedText = text.toLowerCase().trim();
  
  // 精确匹配
  if (pluginMap.has(normalizedText)) {
    return pluginMap.get(normalizedText);
  }
  
  // 包含匹配（如果用户说"订单管理",应该匹配"订单"模块）
  for (const [key, plugin] of pluginMap) {
    if (normalizedText.includes(key) || key.includes(normalizedText)) {
      return plugin;
    }
  }
  
  return null;
}

async function detectCategory(text, plugins) {
  const { map: pluginMap, info: pluginInfo } = buildPluginMap(plugins);
  
  // 先尝试模糊匹配（快速路径，无需 AI）
  const fuzzyMatch = fuzzyMatchPlugin(text, pluginMap);
  if (fuzzyMatch) {
    return { module: fuzzyMatch["@Module"], plugin: fuzzyMatch };
  }
  
  // 如果模糊匹配失败，调用 AI
  const systemPrompt = `识别用户输入属于哪个业务模块，只返回模块名（如 订单、用户），不要其他内容。
模块列表：
${pluginInfo}`;

  try {
    const result = await askAI(systemPrompt, text);
    const aiResult = result.trim().toLowerCase();
    
    // AI 返回后再次尝试匹配
    for (const [key, plugin] of pluginMap) {
      if (key.includes(aiResult) || aiResult.includes(key)) {
        return { module: plugin["@Module"], plugin };
      }
    }
  } catch (err) {
    console.error('Layer1 AI Error:', err.message);
  }
  
  return { module: null, plugin: null };
}

module.exports = { detectCategory };