const fs = require('fs');
const path = require('path');
const { detectCategory } = require('./layer1CategoryService');
const { detectAction } = require('./layer2ActionService');
const { extractArgs } = require('./layer3ArgsService');


const session = {
    lastResults: []
};

/**
 * 自动加载所有业务插件
 */
function loadPlugins() {
    const plugins = [];
    // 假设插件目录在项目根目录下的 plugins
    const pluginPath = path.join(__dirname, '../plugins');
    
    if (!fs.existsSync(pluginPath)) {
        console.error("插件目录不存在:", pluginPath);
        return [];
    }

    const files = fs.readdirSync(pluginPath);
    files.forEach(file => {
        if (file.endsWith('.js')) {
            const plugin = require(path.join(pluginPath, file));
            plugins.push(plugin);
        }
    });
    return plugins;
}

/**
 * 指令分发核心逻辑
 */
async function dispatch(text) {
    try {
        // 1. 加载当前所有可用插件
        const allPlugins = loadPlugins();
        if (allPlugins.length === 0) {
            return { success: false, msg: "系统尚未挂载任何业务插件" };
        }

        // 2. Layer 1: 识别业务模块 (Order/User/etc.)
        const l1 = await detectCategory(text, allPlugins);
        if (!l1.module || !l1.plugin) {
            return { success: false, msg: "AI 无法识别该指令属于哪个业务模块" };
        }

        // 3. Layer 2: 在模块内识别具体动作 (List/Update/etc.)
        const l2 = await detectAction(l1.plugin, text);
        if (!l2) {
            return { success: false, msg: `AI 无法在 ${l1.module} 模块中找到对应的操作` };
        }

        // 4. Layer 3: 根据 @ParamsExample 提取参数
        // 提示：插件中必须定义 @ParamsExample 字段供 AI 参考
        const args = await extractArgs(l2.actionDef, text, session);

        // 5. 执行插件中的业务函数
        const result = await l2.actionDef.handler(args);

        // 6. 更新上下文 (用于处理“第二个”这种指代)
        if (Array.isArray(result)) {
            session.lastResults = result;
        }

        return {
            success: true,
            analysis: {
                module: l1.module,
                action: l2.action,
                args: args
            },
            result: result
        };
    } catch (error) {
        console.error("Dispatch Error:", error);
        return { success: false, msg: "指令执行期间发生错误: " + error.message };
    }
}

// 导出对象，确保引用时 const { dispatch } 能正常解构
module.exports = { dispatch };