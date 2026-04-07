const { askAIForJSON } = require('../ai');
const { cloneArgTemplate } = require('./argFinalizeService');

function parseJsonSafely(jsonStr) {
  try {
    const cleaned = String(jsonStr || '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[Layer3] JSON解析错误:', jsonStr);
    return null;
  }
}

function generateParamPrompt(argTemp = {}) {
  return Object.entries(argTemp)
    .map(([key, value]) => {
      let type = 'string';

      if (typeof value === 'number') {
        type = 'number';
      } else if (Array.isArray(value)) {
        type = 'array';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
      } else if (value && typeof value === 'object') {
        type = 'object';
      }

      return `"${key}"(${type})`;
    })
    .join(', ');
}

function buildEmptyArgs(argTemp = {}) {
  return cloneArgTemplate(argTemp || {});
}

function generateEnumPrompt(enumMap = {}) {
  const entries = Object.entries(enumMap);
  if (!entries.length) return '';

  return entries
    .map(([field, mapping]) => {
      const text = Object.entries(mapping)
        .map(([k, v]) => `${k}=>${v}`)
        .join('，');
      return `${field}: ${text}`;
    })
    .join('\n');
}

function generateExamplesPrompt(examples = []) {
  if (!Array.isArray(examples) || !examples.length) return '';

  return examples
    .map(item => `输入: ${item.input}\n输出: ${JSON.stringify(item.output)}`)
    .join('\n');
}

async function extractArgs(actionDef, text, session = {}) {
  const argTemp = actionDef['@ArgTemp'] || {};
  const required = actionDef['@Required'] || [];
  const enumMap = actionDef['@Enum'] || {};
  const examples = actionDef['@Examples'] || [];

  const emptyArgs = buildEmptyArgs(argTemp);
  const paramPrompt = generateParamPrompt(argTemp);
  const enumPrompt = generateEnumPrompt(enumMap);
  const examplesPrompt = generateExamplesPrompt(examples);

  const systemPrompt = `
你是一个业务参数提取器。
你的任务是：从用户输入中提取参数，并且只返回 JSON 对象。
不要解释，不要回答多余内容，不要 markdown，不要代码块。

字段定义:
{ ${paramPrompt} }

必填字段:
${required.length ? required.join(', ') : '无'}

枚举映射:
${enumPrompt || '无'}

规则:
1. 只能输出一个合法 JSON 对象
2. 用户未提及的字段，保留为空值
3. 不要臆造数据库中不存在的数据
4. 忽略无意义虚词，例如：查询、搜索、列出、显示、帮我、请、一下、等等
5. 如果用户说“第二个/第三个/最后一个”，不要猜 id，相关字段先留空
6. 如果用户输入的是状态文本，可直接保留原文本，例如“已处理”、“处理中”
7. 如果字段是数组，例如 create_time，只有在用户明确给出范围时才填写
8. 输出必须严格匹配字段，不要增加额外字段
${examplesPrompt ? `\n示例:\n${examplesPrompt}` : ''}
`.trim();

  try {
    console.log(`  ├─ 📡 AI提取参数中...`);
    const aiRaw = await askAIForJSON(systemPrompt, text, { trace: 'layer3' });
    const parsed = parseJsonSafely(aiRaw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.log(`  ├─ ⚠️  JSON解析失败，返回空参数`);
      return emptyArgs;
    }

    console.log(`  ├─ ✅ 参数提取成功`);
    return {
      ...emptyArgs,
      ...parsed
    };
  } catch (err) {
    console.error(`  ├─ ❌ Layer3处理错误: ${err.message}`);
    return emptyArgs;
  }
}

module.exports = {
  extractArgs,
  parseJsonSafely,
  generateParamPrompt,
  buildEmptyArgs
};