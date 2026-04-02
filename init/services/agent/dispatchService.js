const { detectCategory } = require('./layer1CategoryService');
const { detectAction } = require('./layer2ActionService');
const { extractArgs } = require('./layer3ArgsService');

const orderService = require('../orderService');
const userService = require('../userService');

async function dispatch(text) {
  const layer1 = detectCategory(text);
  if (!layer1.module) {
    return {
      success: false,
      stage: 1,
      msg: '无法识别类别',
      data: layer1
    };
  }

  const layer2 = detectAction(layer1.module, text);
  if (!layer2.action) {
    return {
      success: false,
      stage: 2,
      msg: '无法识别动作',
      data: {
        module: layer1.module,
        nextActions: layer1.nextActions
      }
    };
  }

  const args = extractArgs(layer1.module, layer2.action, text);

  const analysis = {
    module: layer1.module,
    action: layer2.action,
    args
  };

  let result = null;

  if (layer1.module === 'order') {
    switch (layer2.action) {
      case 'list':
        result = await orderService.list(args);
        break;
      case 'create':
        result = await orderService.create(args);
        break;
      case 'updateMark':
        result = await orderService.updateMark(args);
        break;
      case 'delete':
        result = await orderService.remove(args);
        break;
      case 'remark':
        result = await orderService.remark(args);
        break;
      default:
        return { success: false, msg: 'order action 不支持', analysis };
    }
  }

  if (layer1.module === 'user') {
    switch (layer2.action) {
      case 'list':
        result = await userService.list(args);
        break;
      case 'create':
        result = await userService.create(args);
        break;
      default:
        return { success: false, msg: 'user action 不支持', analysis };
    }
  }

  return {
    success: true,
    analysis,
    result
  };
}

module.exports = {
  dispatch
};