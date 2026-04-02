async function dispatch(text) {
  // 1. 加载所有插件 (逻辑同前)
  const allPlugins = loadPlugins(); 

  // Layer 1: AI 识别模块
  const l1 = await detectCategory(text, allPlugins);
  if (!l1.module) return { success: false, msg: "AI 无法识别业务模块" };

  // Layer 2: AI 识别动作
  const l2 = await detectAction(l1.plugin, text);
  if (!l2) return { success: false, msg: "AI 无法识别具体操作" };

  // Layer 3: AI 自动填充标准示例参数
  const args = await extractArgs(l2.actionDef, text, session);

  // 执行业务逻辑
  const result = await l1.plugin.actions[l2.action].handler(args);

  // 存入上下文，方便下次“第几个”的操作
  if (Array.isArray(result)) session.lastResults = result;

  return {
    success: true,
    analysis: { module: l1.module, action: l2.action, args },
    result
  };
}