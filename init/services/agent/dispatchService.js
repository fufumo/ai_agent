const fs = require('fs');
const path = require('path');
const { detectCategory } = require('./layer1CategoryService');
const { detectAction } = require('./layer2ActionService');
const { extractArgs } = require('./layer3ArgsService');


const session = {
    lastResults: []
};

// 缓存已加载的插件
let pluginsCache = null;
let pluginsCacheTime = 0;
const CACHE_DURATION = 60 * 1000; // 缓存 60 秒

/**
 * 自动加载所有业务插件（带缓存）
 */
function loadPlugins() {
    const now = Date.now();
    
    // 从缓存中读取，如果还未过期
    if (pluginsCache && (now - pluginsCacheTime) < CACHE_DURATION) {
        return pluginsCache;
    }
    
    const plugins = [];
    const pluginPath = path.join(__dirname, '../plugins');
    
    if (!fs.existsSync(pluginPath)) {
        console.error("插件目录不存在:", pluginPath);
        return [];
    }

    try {
        const files = fs.readdirSync(pluginPath).filter(f => f.endsWith('.js'));
        
        files.forEach(file => {
            try {
                // 清理 require 缓存，确保热更新
                delete require.cache[path.resolve(pluginPath, file)];
                const plugin = require(path.resolve(pluginPath, file));
                
                // 验证插件格式
                if (plugin["@Module"] && plugin.actions) {
                    plugins.push(plugin);
                } else {
                    console.warn(`插件 ${file} 格式不正确，跳过`);
                }
            } catch (err) {
                console.error(`加载插件 ${file} 失败:`, err.message);
            }
        });
        
        // 更新缓存
        pluginsCache = plugins;
        pluginsCacheTime = now;
        
        console.log(`已加载 ${plugins.length} 个插件`);
    } catch (err) {
        console.error("加载插件目录失败:", err.message);
        return pluginsCache || [];
    }
    
    return plugins;
}

/**
 * 指令分发核心逻辑
 */
async function dispatch(text) {
    try {
        // 输入校验
        if (!text || !String(text).trim()) {
            return { success: false, msg: "输入内容不能为空" };
        }
        
        if (String(text).length > 500) {
            return { success: false, msg: "输入内容过长（最大 500 字符）" };
        }

        // 1. 加载所有可用插件
        const allPlugins = loadPlugins();
        if (allPlugins.length === 0) {
            return { success: false, msg: "系统尚未挂载任何业务插件" };
        }

        // 2. Layer 1: 识别业务模块
        const l1 = await detectCategory(text, allPlugins);
        if (!l1.module || !l1.plugin) {
            return { success: false, msg: "无法识别该指令属于哪个业务模块" };
        }

        // 3. Layer 2: 在模块内识别具体动作
        const l2 = await detectAction(l1.plugin, text);
        if (!l2) {
            return { success: false, msg: `在 ${l1.module} 模块中找不到对应的操作` };
        }

        // 4. Layer 3: 根据 @ArgTemp 提取参数
        const args = await extractArgs(l2.actionDef, text, session);
        
        // 参数验证
        const argTemp = l2.actionDef["@ArgTemp"] || {};
        Object.keys(argTemp).forEach(key => {
            if (args[key] === undefined) {
                args[key] = typeof argTemp[key] === 'number' ? 0 : 
                           Array.isArray(argTemp[key]) ? [] : '';
            }
        });

        // 5. 执行插件业务函数
        const result = await l2.actionDef.handler(args);

        // 6. 更新上下文
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
        return { 
            success: false, 
            msg: "指令执行期间发生错误: " + error.message 
        };
    }
}

module.exports = { dispatch };