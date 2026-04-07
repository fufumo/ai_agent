const { query, sql } = require('../../db/sqlserver');

/**
 * 用户查询
 */
const list = {
  "@Action": "列表，记录，查询，查找，搜索，获取",
  "@Desc": "查找用户信息。支持姓名、账号、手机号模糊搜索。",
  "@Required": [],
  "@ArgTemp": {
    keyword: "",
    create_time: []
  },
  "@Examples": [
    {
      input: "查询张三这个用户",
      output: {
        keyword: "张三"
      }
    },
    {
      input: "查最近七天创建的用户",
      output: {
        create_time: ["2026-04-01 00:00:00", "2026-04-07 23:59:59"]
      }
    }
  ],
  handler: async (args) => {
    let sqlText = `
      SELECT
        id,
        user_name,
        login_name,
        phone,
        state,
        create_time
      FROM dbo.tb_User
      WHERE state <> -1
    `;

    const params = [];

    if (args.keyword) {
      sqlText += ` AND (user_name LIKE @kw OR login_name LIKE @kw OR phone LIKE @kw)`;
      params.push({
        name: 'kw',
        type: sql.NVarChar(100),
        value: `%${args.keyword}%`
      });
    }

    if (Array.isArray(args.create_time) && args.create_time.length === 2) {
      sqlText += ` AND create_time BETWEEN @start AND @end`;
      params.push(
        { name: 'start', type: sql.DateTime, value: args.create_time[0] },
        { name: 'end', type: sql.DateTime, value: args.create_time[1] }
      );
    }

    sqlText += ` ORDER BY id DESC`;

    return await query(sqlText, params);
  }
};

/**
 * 新增用户
 */
const create = {
  "@Action": "增加，新建，创建，新增，添加",
  "@Desc": "添加一名新的后台工作人员或客户账号。",
  "@Required": ["user_name", "login_name", "phone"],
  "@ArgTemp": {
    user_name: "",
    login_name: "",
    phone: ""
  },
  "@Examples": [
    {
      input: "新增用户 张三 登录名 zhangsan 手机 13800138000",
      output: {
        user_name: "张三",
        login_name: "zhangsan",
        phone: "13800138000"
      }
    }
  ],
  handler: async (args) => {
    if (!args.user_name) throw new Error("操作失败：缺少用户名");
    if (!args.login_name) throw new Error("操作失败：缺少登录账号");
    if (!args.phone) throw new Error("操作失败：缺少手机号");

    const sqlText = `
      INSERT INTO dbo.tb_User (user_name, login_name, phone, state, create_time)
      VALUES (@name, @login, @phone, 0, GETDATE());

      SELECT TOP 1 *
      FROM dbo.tb_User
      ORDER BY id DESC;
    `;

    return await query(sqlText, [
      { name: 'name', type: sql.NVarChar(50), value: args.user_name },
      { name: 'login', type: sql.NVarChar(50), value: args.login_name },
      { name: 'phone', type: sql.NVarChar(20), value: args.phone }
    ]);
  }
};

/**
 * 修改用户
 */
const update = {
  "@Action": "修改，更新，编辑，变更",
  "@Desc": "修改用户姓名、登录账号、手机号。",
  "@Required": ["id"],
  "@ArgTemp": {
    id: 0,
    user_name: "",
    login_name: "",
    phone: ""
  },
  "@Examples": [
    {
      input: "把第二个用户手机号改成 13900001111",
      output: {
        id: 0,
        phone: "13900001111"
      }
    }
  ],
  handler: async (args) => {
    if (!args.id) throw new Error("操作失败：未识别到目标用户 ID");

    const sqlText = `
      UPDATE dbo.tb_User
      SET
        user_name = CASE WHEN @user_name = '' THEN user_name ELSE @user_name END,
        login_name = CASE WHEN @login_name = '' THEN login_name ELSE @login_name END,
        phone = CASE WHEN @phone = '' THEN phone ELSE @phone END
      WHERE id = @id;

      SELECT * FROM dbo.tb_User WHERE id = @id;
    `;

    return await query(sqlText, [
      { name: 'id', type: sql.Int, value: Number(args.id) },
      { name: 'user_name', type: sql.NVarChar(50), value: args.user_name || "" },
      { name: 'login_name', type: sql.NVarChar(50), value: args.login_name || "" },
      { name: 'phone', type: sql.NVarChar(20), value: args.phone || "" }
    ]);
  }
};

/**
 * 修改用户状态
 */
const update_state = {
  "@Action": "修改状态，更新状态，启用，禁用，删除，作废",
  "@Desc": "根据用户 ID 修改用户状态。state=-1 表示删除，0 表示正常。",
  "@Required": ["state"],
  "@Enum": {
    state: {
      "正常": 0,
      "启用": 0,
      "可用": 0,
      "删除": -1,
      "作废": -1,
      "禁用": -1
    }
  },
  "@ArgTemp": {
    id: 0,
    state: 0
  },
  "@Examples": [
    {
      input: "把第二个用户删除",
      output: {
        id: 0,
        state: -1
      }
    },
    {
      input: "把 12 号用户启用",
      output: {
        id: 12,
        state: 0
      }
    }
  ],
  handler: async (args) => {
    if (!args.id) throw new Error("操作失败：未识别到目标用户 ID");
    if (![0, -1].includes(Number(args.state))) {
      throw new Error("操作失败：无效的状态值");
    }

    const sqlText = `
      UPDATE dbo.tb_User
      SET state = @state
      WHERE id = @id;

      SELECT * FROM dbo.tb_User WHERE id = @id;
    `;

    return await query(sqlText, [
      { name: 'id', type: sql.Int, value: Number(args.id) },
      { name: 'state', type: sql.Int, value: Number(args.state) }
    ]);
  }
};

/**
 * 用户统计
 */
const aggregate = {
  "@Action": "统计，汇总，分析，聚合",
  "@Desc": "统计用户数量，可按状态或时间范围汇总。",
  "@Required": [],
  "@Enum": {
    groupBy: {
      "状态": "state",
      "按状态": "state"
    },
    state: {
      "正常": 0,
      "启用": 0,
      "可用": 0,
      "删除": -1,
      "作废": -1,
      "禁用": -1
    }
  },
  "@ArgTemp": {
    groupBy: "",
    state: 0,
    create_time: []
  },
  "@Examples": [
    {
      input: "按状态统计本月用户数量",
      output: {
        groupBy: "state",
        create_time: ["2026-04-01 00:00:00", "2026-04-30 23:59:59"]
      }
    }
  ],
  handler: async (args) => {
    let sqlText = '';
    const params = [];

    if (args.groupBy === 'state') {
      sqlText = `
        SELECT
          state,
          COUNT(*) AS user_count
        FROM dbo.tb_User
        WHERE 1 = 1
      `;

      if (args.state === 0 || args.state === -1) {
        sqlText += ` AND state = @state`;
        params.push({
          name: 'state',
          type: sql.Int,
          value: Number(args.state)
        });
      }

      if (Array.isArray(args.create_time) && args.create_time.length === 2) {
        sqlText += ` AND create_time BETWEEN @start AND @end`;
        params.push(
          { name: 'start', type: sql.DateTime, value: args.create_time[0] },
          { name: 'end', type: sql.DateTime, value: args.create_time[1] }
        );
      }

      sqlText += ` GROUP BY state ORDER BY state DESC`;
    } else {
      sqlText = `
        SELECT
          COUNT(*) AS user_count
        FROM dbo.tb_User
        WHERE 1 = 1
      `;

      if (args.state === 0 || args.state === -1) {
        sqlText += ` AND state = @state`;
        params.push({
          name: 'state',
          type: sql.Int,
          value: Number(args.state)
        });
      }

      if (Array.isArray(args.create_time) && args.create_time.length === 2) {
        sqlText += ` AND create_time BETWEEN @start AND @end`;
        params.push(
          { name: 'start', type: sql.DateTime, value: args.create_time[0] },
          { name: 'end', type: sql.DateTime, value: args.create_time[1] }
        );
      }
    }

    return await query(sqlText, params);
  }
};

module.exports = {
  "@Module": "用户",
  "@Alias": ["账号", "人员", "用户管理", "后台用户"],
  "@Desc": "用户权限与个人资料管理。处理账号搜索、联系电话查询、新用户新增、用户修改和状态变更。",
  actions: {
    list,
    create,
    update,
    update_state,
    aggregate
  }
};