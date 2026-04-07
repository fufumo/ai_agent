const path = require('path');
const fs = require('fs');

const { preprocessText } = require('./preprocessService');
const { getSession, updateSession } = require('./sessionStore');
const { identifyCategory } = require('./layer1CategoryService');
const { identifyAction } = require('./layer2ActionService');
const { extractArgs } = require('./layer3ArgsService');
const { finalizeArgs } = require('./argFinalizeService');

function loadPlugins() {
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

  return plugins;
}

async function dispatch(text, context = {}) {
  const sessionId = context.sessionId || 'default';
  const session = getSession(sessionId);
  const normalizedText = preprocessText(text);
  const plugins = loadPlugins();

  try {
    const categoryKey = await identifyCategory(normalizedText, plugins);
    if (!categoryKey || !plugins[categoryKey]) {
      return {
        success: false,
        msg: '未识别到业务模块'
      };
    }

    const plugin = plugins[categoryKey];
    const actions = plugin.actions || {};

    const actionKey = await identifyAction(normalizedText, actions);
    if (!actionKey || !actions[actionKey]) {
      return {
        success: false,
        msg: '未识别到业务动作',
        category: categoryKey
      };
    }

    const actionDef = actions[actionKey];

    const rawArgs = await extractArgs(actionDef, normalizedText, session);
    const { args, validation } = finalizeArgs(actionDef, rawArgs, normalizedText, session);

    if (!validation.ok) {
      return {
        success: false,
        msg: '参数校验失败',
        category: categoryKey,
        action: actionKey,
        rawArgs,
        args,
        missing: validation.missing,
        invalidEnums: validation.invalidEnums
      };
    }

    const result = await actionDef.handler(args, {
      text: normalizedText,
      session,
      sessionId,
      categoryKey,
      actionKey
    });

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

    return {
      success: true,
      category: categoryKey,
      action: actionKey,
      args,
      data: result
    };
  } catch (err) {
    console.error('[dispatch] 错误:', err);
    return {
      success: false,
      msg: err.message || '系统处理失败'
    };
  }
}

module.exports = {
  dispatch
};