function detectAction(module, text) {
  const t = String(text || '').trim();

  if (module === 'order') {
    if (t.includes('创建') || t.includes('新增') || t.includes('添加订单')) {
      return { action: 'create' };
    }

    if (t.includes('删除')) {
      return { action: 'delete' };
    }

    if (t.includes('备注')) {
      return { action: 'remark' };
    }

    if (t.includes('改状态') || t.includes('标记') || t.includes('处理成') || t.includes('改成已处理')) {
      return { action: 'updateMark' };
    }

    return { action: 'list' };
  }

  if (module === 'user') {
    if (t.includes('创建') || t.includes('新增') || t.includes('添加用户')) {
      return { action: 'create' };
    }

    return { action: 'list' };
  }

  return { action: '' };
}

module.exports = {
  detectAction
};