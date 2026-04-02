function extractArgs(module, action, text) {
  const t = String(text || '').trim();

  if (module === 'order' && action === 'list') {
    const args = {};

    if (t.includes('待处理')) args.mark = 1;
    if (t.includes('处理中')) args.mark = 2;
    if (t.includes('已处理')) args.mark = 3;
    if (t.includes('备注')) args.mark = 4;

    const keywordMatch = t.match(/订单([A-Za-z0-9]+)/i);
    if (keywordMatch) {
      args.keyword = keywordMatch[1];
    }

    return args;
  }

  if (module === 'order' && action === 'create') {
    const orderNoMatch = t.match(/单号[:：]?\s*([A-Za-z0-9\-]+)/i);
    const clientMatch = t.match(/客户[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9]+)/i);
    const amountMatch = t.match(/金额[:：]?\s*([0-9]+(?:\.[0-9]+)?)/i);

    return {
      order_no: orderNoMatch ? orderNoMatch[1] : '',
      client_name: clientMatch ? clientMatch[1] : '',
      total_amount: amountMatch ? Number(amountMatch[1]) : 0,
      remark: ''
    };
  }

  if (module === 'order' && action === 'updateMark') {
    const idMatch = t.match(/订单\s*([0-9]+)/i) || t.match(/id\s*([0-9]+)/i);
    let mark = null;

    if (t.includes('待处理')) mark = 1;
    if (t.includes('处理中')) mark = 2;
    if (t.includes('已处理')) mark = 3;
    if (t.includes('备注')) mark = 4;

    return {
      id: idMatch ? Number(idMatch[1]) : 0,
      mark: mark
    };
  }

  if (module === 'order' && action === 'delete') {
    const idMatch = t.match(/订单\s*([0-9]+)/i) || t.match(/id\s*([0-9]+)/i);

    return {
      id: idMatch ? Number(idMatch[1]) : 0
    };
  }

  if (module === 'order' && action === 'remark') {
    const idMatch = t.match(/订单\s*([0-9]+)/i) || t.match(/id\s*([0-9]+)/i);
    const remarkMatch = t.match(/备注[:：]?\s*(.+)$/i);

    return {
      id: idMatch ? Number(idMatch[1]) : 0,
      remark: remarkMatch ? remarkMatch[1].trim() : ''
    };
  }

  if (module === 'user' && action === 'list') {
    const args = {};
    return args;
  }

  if (module === 'user' && action === 'create') {
    const userNameMatch = t.match(/姓名[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9]+)/i);
    const loginNameMatch = t.match(/账号[:：]?\s*([A-Za-z0-9_]+)/i);
    const phoneMatch = t.match(/电话[:：]?\s*([0-9]+)/i);

    return {
      user_name: userNameMatch ? userNameMatch[1] : '',
      login_name: loginNameMatch ? loginNameMatch[1] : '',
      phone: phoneMatch ? phoneMatch[1] : ''
    };
  }

  return {};
}

module.exports = {
  extractArgs
};