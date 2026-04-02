// services/agent/layer1CategoryService.js
const { askAI } = require('./aiProvider');

async function detectCategory(text, plugins) {
  const pluginInfo = plugins.map(p => `- ${p["@Module"]}: ${p["@Desc"]}`).join('\n');
  
  const systemPrompt = `
    你是一个意图识别助手。根据以下模块列表，判断用户的输入属于哪个模块。
    模块列表：
    ${pluginInfo}
    
    注意：只返回模块名称（如 order 或 user），不要解释，不要输出多余内容。如果都不匹配，返回 none。
  `;

  const result = await askAI(systemPrompt, text);
  const matchedPlugin = plugins.find(p => p["@Module"] === result.toLowerCase());
  
  return matchedPlugin ? { module: result, plugin: matchedPlugin } : { module: null };
}