const { askAI } = require('../ai');

// const ACTION_SYNONYMS = {
//   create: ['创建', '新增', '添加', '新建'],
//   update: ['修改', '更新', '编辑', '变更'],
//   delete: ['删除', '移除', '作废'],
//   aggregate: ['统计', '汇总', '分析', '合计'],
//   list: ['查', '查询', '看', '列出', '显示', '获取', '搜索'],
// };

function normalizeText(text = '') {
  return String(text || '').trim();
}

function buildActionKeywords(actions = {}) {
  const map = {};

  Object.entries(actions).forEach(([actionKey, actionDef]) => {
    const actionText = String(actionDef['@Action'] || '');
    const descText = String(actionDef['@Desc'] || '');

    const fromAction = actionText.split(/[，,、\s]+/).filter(Boolean);
    const fromDesc = descText.split(/[，,、\s]+/).filter(Boolean).slice(0, 8);
    // const common = ACTION_SYNONYMS[actionKey] || [];

    map[actionKey] = [...new Set([...fromAction, ...fromDesc, ...common])];
  });

  return map;
}

// function matchActionByRule(text, actions = {}) {
//   const normalized = normalizeText(text);
//   const keywordsMap = buildActionKeywords(actions);

//   for (const [actionKey, words] of Object.entries(keywordsMap)) {
//     if (words.some(word => normalized.includes(word))) {
//       return actionKey;
//     }
//   }

//   return null;
// }

async function matchActionByAI(text, actions = {}) {
  const actionDesc = Object.entries(actions).map(([key, def]) => {
    return `${key}: 动作=${def['@Action'] || ''}；描述=${def['@Desc'] || ''}`;
  }).join('\n');

  const systemPrompt = `
你是业务动作分类器。
请根据用户输入，在候选动作中选出最合适的一个。
只能返回动作 key，不要解释，不要多余文字。

候选动作:
${actionDesc}
`.trim();

  const result = await askAI(systemPrompt, text, { trace: 'layer2' });
  const key = String(result || '').trim();

  if (actions[key]) {
    console.log(`  ├─ 💡 AI匹配成功: ${key}`);
    return key;
  }

  console.log(`  ├─ ⚠️  AI返回不合法的key: "${key}"`);
  return null;
}

async function identifyAction(text, actions = {}) {
  // const byRule = matchActionByRule(text, actions);
  // if (byRule) {
  //   console.log(`  ├─ 🎯 规则匹配成功: ${byRule}`);
  //   return byRule;
  // }

  // console.log(`  ├─ 📡 规则匹配失败，尝试AI识别...`);
  return await matchActionByAI(text, actions);
}

module.exports = {
  identifyAction
};