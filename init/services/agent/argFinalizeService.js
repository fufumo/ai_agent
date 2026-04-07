function cloneArgTemplate(argTemp = {}) {
  const result = {};

  Object.keys(argTemp).forEach(key => {
    const value = argTemp[key];

    if (Array.isArray(value)) {
      result[key] = [];
    } else if (typeof value === 'number') {
      result[key] = 0;
    } else if (typeof value === 'boolean') {
      result[key] = false;
    } else if (value && typeof value === 'object') {
      result[key] = null;
    } else {
      result[key] = '';
    }
  });

  return result;
}

function mergeWithTemplate(argTemp = {}, args = {}) {
  return {
    ...cloneArgTemplate(argTemp),
    ...(args || {})
  };
}

function toHalfWidth(str) {
  return String(str || '')
    .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
}

function normalizePrimitive(value) {
  if (typeof value === 'string') {
    return toHalfWidth(value).trim();
  }
  return value;
}

function extractOrdinalIndex(text) {
  const normalized = String(text || '');

  if (!normalized) return null;

  if (normalized.includes('最后一个') || normalized.includes('最后一条') || normalized.includes('最后一笔')) {
    return -1;
  }

  const reverseMatch = normalized.match(/倒数第\s*(\d+)\s*(个|条|笔|行)?/);
  if (reverseMatch) {
    return -Number(reverseMatch[1]);
  }

  const map = {
    '第一': 0,
    '第二': 1,
    '第三': 2,
    '第四': 3,
    '第五': 4,
    '第六': 5,
    '第七': 6,
    '第八': 7,
    '第九': 8,
    '第十': 9
  };

  for (const [key, index] of Object.entries(map)) {
    if (normalized.includes(key)) return index;
  }

  const match = normalized.match(/第\s*(\d+)\s*(个|条|笔|行)?/);
  if (match) {
    return Number(match[1]) - 1;
  }

  return null;
}

function tryResolveFromLastResults(text, session, currentArgs) {
  const list = session && Array.isArray(session.lastResults) ? session.lastResults : [];
  if (!list.length) return currentArgs;

  let index = extractOrdinalIndex(text);
  if (index === null) return currentArgs;

  if (index < 0) {
    index = list.length + index;
  }

  if (index < 0 || index >= list.length) return currentArgs;

  const target = list[index] || {};
  const nextArgs = { ...currentArgs };

  if ((nextArgs.id === '' || nextArgs.id === 0 || nextArgs.id == null) && target.id != null) {
    nextArgs.id = target.id;
  }

  if ((!nextArgs.number || nextArgs.number === '') && target.number) {
    nextArgs.number = target.number;
  }

  if ((!nextArgs.order_no || nextArgs.order_no === '') && (target.order_no || target.number)) {
    nextArgs.order_no = target.order_no || target.number;
  }

  if ((!nextArgs.client_name || nextArgs.client_name === '') && target.client_name) {
    nextArgs.client_name = target.client_name;
  }

  if (
    (nextArgs.total_amount === '' || nextArgs.total_amount == null || nextArgs.total_amount === 0) &&
    target.total_amount != null
  ) {
    nextArgs.total_amount = target.total_amount;
  }

  if ((!nextArgs.remark || nextArgs.remark === '') && target.remark) {
    nextArgs.remark = target.remark;
  }

  if ((nextArgs.mark === '' || nextArgs.mark == null || nextArgs.mark === 0) && target.mark != null) {
    nextArgs.mark = target.mark;
  }

  return nextArgs;
}

function applyEnumMap(args, enumMap = {}) {
  const nextArgs = { ...args };

  Object.entries(enumMap).forEach(([field, mapping]) => {
    const rawValue = nextArgs[field];
    if (rawValue == null || rawValue === '') return;

    if (typeof rawValue === 'number') return;

    const textValue = String(rawValue).trim();

    if (Object.prototype.hasOwnProperty.call(mapping, textValue)) {
      nextArgs[field] = mapping[textValue];
      return;
    }

    for (const [key, value] of Object.entries(mapping)) {
      if (textValue.includes(key)) {
        nextArgs[field] = value;
        return;
      }
    }
  });

  return nextArgs;
}

function applyTypeFixes(argTemp = {}, args = {}) {
  const nextArgs = { ...args };

  Object.entries(argTemp).forEach(([key, templateValue]) => {
    const rawValue = nextArgs[key];
    if (rawValue == null) return;

    if (typeof templateValue === 'number') {
      if (typeof rawValue === 'string') {
        const text = rawValue.trim();
        if (text === '') {
          nextArgs[key] = 0;
        } else {
          const parsed = Number(text);
          nextArgs[key] = Number.isNaN(parsed) ? 0 : parsed;
        }
      }
    }

    if (typeof templateValue === 'string') {
      nextArgs[key] = normalizePrimitive(rawValue);
    }

    if (typeof templateValue === 'boolean') {
      if (typeof rawValue === 'string') {
        const text = rawValue.trim().toLowerCase();
        if (['true', '1', '是', '对', '开启', '打开'].includes(text)) nextArgs[key] = true;
        if (['false', '0', '否', '错', '关闭', '关掉'].includes(text)) nextArgs[key] = false;
      }
    }

    if (Array.isArray(templateValue)) {
      if (!Array.isArray(rawValue)) {
        nextArgs[key] = [];
      }
    }
  });

  return nextArgs;
}

function normalizeDateRange(text, args = {}) {
  const nextArgs = { ...args };
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let start = null;
  let end = null;

  if (text.includes('今天') || text.includes('今日') || text.includes('该日')) {
    start = fmt(now);
    end = fmt(now);
  } else if (text.includes('昨天')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    start = fmt(d);
    end = fmt(d);
  } else if (text.includes('前天')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    start = fmt(d);
    end = fmt(d);
  } else if (text.includes('最近三天') || text.includes('近三天')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    start = fmt(d);
    end = fmt(now);
  } else if (
    text.includes('最近7天') ||
    text.includes('最近七天') ||
    text.includes('近7天') ||
    text.includes('近七天')
  ) {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    start = fmt(d);
    end = fmt(now);
  } else if (
    text.includes('本周') ||
    text.includes('这周') ||
    text.includes('这一周') ||
    text.includes('本周的') ||
    text.includes('这周的')
  ) {
    const d = new Date(now);
    const day = d.getDay();
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    const startDate = new Date(d);
    startDate.setDate(d.getDate() + offsetToMonday);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    start = fmt(startDate);
    end = fmt(endDate);
  } else if (text.includes('本月')) {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start = fmt(s);
    end = fmt(e);
  } else if (text.includes('上月')) {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    start = fmt(s);
    end = fmt(e);
  } else if (text.includes('本年') || text.includes('今年')) {
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now.getFullYear(), 11, 31);
    start = fmt(s);
    end = fmt(e);
  } 

  if (start && end) {
    if (Object.prototype.hasOwnProperty.call(nextArgs, 'create_time')) {
      nextArgs.create_time = [`${start} 00:00:00`, `${end} 23:59:59`];
    } else {
      if (!nextArgs.start_date) nextArgs.start_date = start;
      if (!nextArgs.end_date) nextArgs.end_date = end;
    }
  }

  return nextArgs;
}

function validateArgs(actionDef = {}, args = {}) {
  const required = actionDef['@Required'] || [];
  const missing = [];

  required.forEach(key => {
    const value = args[key];

    if (value === undefined || value === null || value === '') {
      missing.push(key);
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      missing.push(key);
    }
  });

  const enumMap = actionDef['@Enum'] || {};
  const argTemp = actionDef['@ArgTemp'] || {};
  const invalidEnums = [];

  Object.entries(enumMap).forEach(([field, mapping]) => {
    if (!Object.prototype.hasOwnProperty.call(args, field)) return;

    const value = args[field];
    const templateValue = argTemp[field];

    // 空值跳过
    if (value === '' || value == null) return;

    // ⭐ 如果当前值等于模板默认值，也跳过校验
    // 比如 mark 默认就是 0，说明用户没传状态条件
    if (value === templateValue) return;

    const validValues = new Set([...Object.keys(mapping), ...Object.values(mapping)]);
    if (!validValues.has(value)) {
      invalidEnums.push({
        field,
        value,
        allowed: Object.keys(mapping)
      });
    }
  });

  return {
    ok: missing.length === 0 && invalidEnums.length === 0,
    missing,
    invalidEnums
  };
}

function finalizeArgs(actionDef = {}, rawArgs = {}, text = '', session = {}) {
  const argTemp = actionDef['@ArgTemp'] || {};
  let args = mergeWithTemplate(argTemp, rawArgs);

  args = applyTypeFixes(argTemp, args);
  args = applyEnumMap(args, actionDef['@Enum'] || {});
  args = normalizeDateRange(text, args);
  args = tryResolveFromLastResults(text, session, args);

  if (typeof actionDef['@Normalize'] === 'function') {
    args = actionDef['@Normalize'](args, { text, session, actionDef }) || args;
  }

  return {
    args,
    validation: validateArgs(actionDef, args)
  };
}

module.exports = {
  cloneArgTemplate,
  mergeWithTemplate,
  finalizeArgs,
  validateArgs
};