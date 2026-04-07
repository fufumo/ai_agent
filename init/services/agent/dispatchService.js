const path = require('path');
const fs = require('fs');

const { preprocessText } = require('./preprocessService');
const { getSession, updateSession } = require('./sessionStore');
const { identifyCategory } = require('./layer1CategoryService');
const { identifyAction } = require('./layer2ActionService');
const { extractArgs } = require('./layer3ArgsService');
const { finalizeArgs } = require('./argFinalizeService');

// 插件缓存
let pluginsCache = null;
let pluginsCacheTime = 0;
const PLUGINS_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 加载插件（带缓存）
 * @param {boolean} forceRefresh - 是否强制刷新缓存
 * @returns {Object} 插件对象
 */
function loadPlugins(forceRefresh = false) {
  const now = Date.now();
  
  // 缓存未过期且非强制刷新，直接返回
  if (!forceRefresh && pluginsCache && (now - pluginsCacheTime) < PLUGINS_CACHE_DURATION) {
    console.log(`[Plugins] 💾 使用缓存插件: ${Object.keys(pluginsCache).length}个`);
    return pluginsCache;
  }

  console.log(`[Plugins] 🔄 重新加载插件...`);
  const startTime = Date.now();
  
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  const files = fs.readdirSync(pluginsDir).filter(name => name.endsWith('.js'));

  const plugins = {};

  files.forEach(file => {
    const fullPath = path.join(pluginsDir, file);
    delete require.cache[require.resolve(fullPath)];
    const plugin = require(fullPath);
    const key = file.replace(/\.js$/, '');
    plugins[key] = plugin;
  });

  // 更新缓存
  pluginsCache = plugins;
  pluginsCacheTime = now;

  const duration = Date.now() - startTime;
  console.log(`[Plugins] ✅ 加载成功: ${Object.keys(plugins).length}个 (${duration}ms)`);

  return plugins;
}

/**
 * 强制刷新插件缓存（热更新时使用）
 */
function refreshPlugins() {
  return loadPlugins(true);
}

async function dispatch(text, context = {}) {
  const sessionId = context.sessionId || 'default';
  const startTime = Date.now();
  const requestId = context.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[DISPATCH] 📥 新请求开始`);
  console.log(`  ├─ requestId: ${requestId}`);
  console.log(`  ├─ sessionId: ${sessionId}`);
  console.log(`  └─ 原始输入: "${text}"`);
  
  const session = getSession(sessionId);
  const normalizedText = preprocessText(text);
  console.log(`  └─ 规范化后: "${normalizedText}"\n`);
  
  const plugins = loadPlugins();

  try {
    // Layer 1: 识别模块
    console.log(`[Layer1] 🔍 识别业务模块...`);
    const t1 = Date.now();
    const categoryKey = await identifyCategory(normalizedText, plugins);
    const layer1Time = Date.now() - t1;
    
    if (!categoryKey || !plugins[categoryKey]) {
      console.log(`  └─ ❌ 模块识别失败（${layer1Time}ms）\n`);
      return {
        success: false,
        msg: '未识别到业务模块',
        requestId
      };
    }
    
    console.log(`  ├─ ✅ 识别模块: ${categoryKey} (${layer1Time}ms)`);
    
    // Layer 2: 识别动作
    const plugin = plugins[categoryKey];
    const actions = plugin.actions || {};
    
    console.log(`[Layer2] 🔍 识别业务动作...`);
    const t2 = Date.now();
    const actionKey = await identifyAction(normalizedText, actions);
    const layer2Time = Date.now() - t2;
    
    if (!actionKey || !actions[actionKey]) {
      console.log(`  └─ ❌ 动作识别失败（${layer2Time}ms）\n`);
      return {
        success: false,
        msg: '未识别到业务动作',
        category: categoryKey,
        requestId
      };
    }
    
    console.log(`  ├─ ✅ 识别动作: ${actionKey} (${layer2Time}ms)`);
    
    // Layer 3: 提取参数
    const actionDef = actions[actionKey];
    
    console.log(`[Layer3] 🔍 提取业务参数...`);
    const t3 = Date.now();
    const rawArgs = await extractArgs(actionDef, normalizedText, session);
    const layer3Time = Date.now() - t3;
    
    console.log(`  ├─ ✅ 参数提取完成 (${layer3Time}ms)`);
    console.log(`  └─ 提取结果: ${JSON.stringify(rawArgs)}\n`);
    
    // 参数最终化和验证
    console.log(`[Finalize] 🔎 参数最终化与验证...`);
    const { args, validation } = finalizeArgs(actionDef, rawArgs, normalizedText, session);
    
    if (!validation.ok) {
      console.log(`  ├─ ❌ 参数校验失败`);
      console.log(`  ├─ 缺失字段: ${validation.missing.join(', ') || '无'}`);
      console.log(`  └─ 枚举异常: ${validation.invalidEnums.length > 0 ? JSON.stringify(validation.invalidEnums) : '无'}\n`);
      
      return {
        success: false,
        msg: '参数校验失败',
        category: categoryKey,
        action: actionKey,
        rawArgs,
        args,
        missing: validation.missing,
        invalidEnums: validation.invalidEnums,
        requestId
      };
    }
    
    console.log(`  ├─ ✅ 参数验证通过`);
    console.log(`  └─ 最终参数: ${JSON.stringify(args)}\n`);
    
    // 执行业务handler
    console.log(`[Handler] ⚙️  执行业务逻辑...`);
    const tHandler = Date.now();
    const result = await actionDef.handler(args, {
      text: normalizedText,
      session,
      sessionId,
      categoryKey,
      actionKey
    });
    const handlerTime = Date.now() - tHandler;
    
    console.log(`  ├─ ✅ 业务执行完成 (${handlerTime}ms)`);
    console.log(`  ├─ 结果类型: ${Array.isArray(result) ? `数组(${result.length}条)` : '对象'}`);
    
    // 更新session
    if (Array.isArray(result)) {
      updateSession(sessionId, {
        lastResults: result,
        lastModule: categoryKey,
        lastAction: actionKey,
        lastArgs: args
      });
    } else {
      updateSession(sessionId, {
        lastModule: categoryKey,
        lastAction: actionKey,
        lastArgs: args
      });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[SUCCESS] ✅ 请求执行成功`);
    console.log(`  ├─ requestId: ${requestId}`);
    console.log(`  ├─ 整个流程耗时: ${totalTime}ms`);
    console.log(`  │  ├─ Layer1: ${layer1Time}ms`);
    console.log(`  │  ├─ Layer2: ${layer2Time}ms`);
    console.log(`  │  ├─ Layer3: ${layer3Time}ms`);
    console.log(`  │  └─ Handler: ${handlerTime}ms`);
    console.log(`  └─ 返回数据行数: ${Array.isArray(result) ? result.length : 1}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      category: categoryKey,
      action: actionKey,
      args,
      data: result,
      requestId,
      timing: {
        total: totalTime,
        layer1: layer1Time,
        layer2: layer2Time,
        layer3: layer3Time,
        handler: handlerTime
      }
    };
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`[ERROR] ❌ 请求执行失败`);
    console.error(`  ├─ requestId: ${requestId}`);
    console.error(`  ├─ 耗时: ${totalTime}ms`);
    console.error(`  ├─ 错误信息: ${err.message}`);
    console.error(`  └─ 堆栈: ${err.stack}`);
    console.error(`${'='.repeat(60)}\n`);
    
    return {
      success: false,
      msg: err.message || '系统处理失败',
      requestId,
      error: err.message,
      timing: { total: totalTime }
    };
  }
}

module.exports = {
  dispatch,
  refreshPlugins
};