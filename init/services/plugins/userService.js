const { query, sql } = require('../../db/sqlserver');

module.exports = {
  "@Module": "user",
  "@Desc": "用户权限与个人资料管理。处理账号搜索、联系电话查询及新用户入库。",

  actions: {
    // 1. 用户列表
    list: {
      "@Action": "list",
      "@Desc": "查找用户信息。支持姓名、账号、手机号模糊搜索。",
      "@ArgTemp": {
        "keyword": "" // 可选，仅当用户提到具体的姓名、账号或手机号时填充
      },
      handler: async (args) => {
        let sqlText = `SELECT id, user_name, login_name, phone FROM dbo.tb_User WHERE state <> -1`;
        const params = [];
        if (args.keyword) {
          sqlText += ` AND (user_name LIKE @kw OR login_name LIKE @kw OR phone LIKE @kw)`;
          params.push({ name: 'kw', type: sql.NVarChar(100), value: `%${args.keyword}%` });
        }
        return await query(sqlText + " ORDER BY id DESC", params);
      }
    },

    // 2. 创建用户
    create: {
      "@Action": "create",
      "@Desc": "添加一名新的后台工作人员或客户账号。",
      "@ArgTemp": {
        "user_name": "",   // 必需，真实姓名（用户明确提供）
        "login_name": "",  // 必需，登录账号（用户明确提供）
        "phone": ""        // 必需，手机号码（用户明确提供）
      },
      handler: async (args) => {
        const sqlText = `
          INSERT INTO dbo.tb_User (user_name, login_name, phone, state, create_time)
          VALUES (@name, @login, @phone, 0, GETDATE());
          SELECT TOP 1 * FROM dbo.tb_User ORDER BY id DESC;
        `;
        return await query(sqlText, [
          { name: 'name', type: sql.NVarChar(50), value: args.user_name },
          { name: 'login', type: sql.NVarChar(50), value: args.login_name },
          { name: 'phone', type: sql.NVarChar(20), value: args.phone }
        ]);
      }
    }
  }
};