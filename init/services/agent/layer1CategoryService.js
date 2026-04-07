const { askAI } = require('../ai');

function normalizeText(text = '') {
  return String(text || '').trim();
}

function buildPluginMap(plugins = {}) {
  const map = {};
  const info = [];

  Object.entries(plugins).forEach(([key, plugin]) => {
    const moduleName = plugin['@Module'] || key;
    const aliases = Array.isArray(plugin['@Alias']) ? plugin['@Alias'] : [];
    const desc = plugin['@Desc'] || '';

    const keywords = [moduleName, ...aliases]
      .map(x => String(x || '').trim())
      .filter(Boolean);

    info.push({
      key,
      moduleName,
      aliases,
      desc
    });

    keywords.forEach(word => {
      map[word] = key;
    });
  });

  return { map, info };
}

function matchCategoryByRule(text, plugins = {}) {
  const normalized = normalizeText(text);
  const { map } = buildPluginMap(plugins);

  for (const [keyword, pluginKey] of Object.entries(map)) {
    if (normalized.includes(keyword)) {
      return pluginKey;
    }
  }

  return null;
}

async function matchCategoryByAI(text, plugins = {}) {
  const { info } = buildPluginMap(plugins);

  const pluginDesc = info.map(item => {
    return `${item.key}: 模块=${item.moduleName}；别名=${item.aliases.join('、') || '无'}；描述=${item.desc || '无'}`;
  }).join('\n');

  const systemPrompt = `
你是业务模块分类器。
请根据用户输入，在候选模块中选出最合适的一个。
只能返回模块 key，不要解释，不要多余文字。

候选模块:
${pluginDesc}
`.trim();

  const result = await askAI(systemPrompt, text, { trace: 'layer1' });
  const key = String(result || '').trim();

  if (plugins[key]) {
    console.log(`  ├─ 💡 AI匹配成功: ${key}`);
    return key;
  }

  console.log(`  ├─ ⚠️  AI返回不合法的key: "${key}"`);
  return null;
}

async function identifyCategory(text, plugins = {}) {
  const byRule = matchCategoryByRule(text, plugins);
  if (byRule) {
    console.log(`  ├─ 🎯 规则匹配成功: ${byRule}`);
    return byRule;
  }

  console.log(`  ├─ 📡 规则匹配失败，尝试AI识别...`);
  return await matchCategoryByAI(text, plugins);
}

module.exports = {
  identifyCategory,
  buildPluginMap
};