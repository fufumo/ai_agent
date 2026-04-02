function detectCategory(text) {
  const t = String(text || '').trim();

  if (!t) {
    return { module: '' };
  }

  if (
    t.includes('订单') ||
    t.includes('单子') ||
    t.includes('待处理') ||
    t.includes('处理中') ||
    t.includes('已处理') ||
    t.includes('备注')
  ) {
    return {
      module: 'order',
      nextActions: ['list', 'create', 'updateMark', 'delete', 'remark']
    };
  }

  if (
    t.includes('用户') ||
    t.includes('账号') ||
    t.includes('人员')
  ) {
    return {
      module: 'user',
      nextActions: ['list', 'create']
    };
  }

  return {
    module: '',
    nextActions: []
  };
}

module.exports = {
  detectCategory
};