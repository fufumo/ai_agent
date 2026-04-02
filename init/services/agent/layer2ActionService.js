// services/agent/layer2ActionService.js
const { askAI } = require('./aiProvider');

async function detectAction(plugin, text) {
  const actions = plugin.actions;
  const actionInfo = Object.keys(actions).map(k => `- ${k}: ${actions[k]["@Desc"]}`).join('\n');

  const systemPrompt = `
    你是一个指令解析器。在“${plugin["@Module"]}”模块下，根据用户输入判断具体动作。
    可选动作：
    ${actionInfo}
    
    注意：只返回动作的 Key（如 list 或 update），不要解释。
  `;

  const actionKey = await askAI(systemPrompt, text);
  return actions[actionKey] ? { action: actionKey, actionDef: actions[actionKey] } : null;
}