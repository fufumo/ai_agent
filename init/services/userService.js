const { sql, query } = require('../db/sqlserver');

async function list(args) {
  let sqlText = `
    SELECT id, user_name, login_name, phone, state, create_time
    FROM dbo.tb_User
    WHERE 1=1
  `;
  const params = [];

  if (args.showDeleted !== true) {
    sqlText += ` AND state <> -1 `;
  }

  if (args.keyword) {
    sqlText += ` AND (user_name LIKE @keyword OR login_name LIKE @keyword OR phone LIKE @keyword) `;
    params.push({ name: 'keyword', type: sql.NVarChar(100), value: `%${args.keyword}%` });
  }

  sqlText += ` ORDER BY id DESC `;

  return await query(sqlText, params);
}

async function create(args) {
  const sqlText = `
    INSERT INTO dbo.tb_User(user_name, login_name, phone, state, create_time)
    VALUES(@user_name, @login_name, @phone, 0, GETDATE());

    SELECT TOP 1 *
    FROM dbo.tb_User
    WHERE login_name = @login_name
    ORDER BY id DESC;
  `;

  return await query(sqlText, [
    { name: 'user_name', type: sql.NVarChar(50), value: args.user_name },
    { name: 'login_name', type: sql.NVarChar(50), value: args.login_name },
    { name: 'phone', type: sql.NVarChar(20), value: args.phone || '' }
  ]);
}

module.exports = {
  list,
  create
};